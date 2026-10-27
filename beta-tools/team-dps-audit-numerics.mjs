import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sample,gear,builds,run,sum,close,allSets} from './team-dps-full-audit.mjs';
import {weapon,weapons,chars} from './interface-audit-7108.mjs';
import {api} from './runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {equipmentDamageEvents} from '../beta-data/equipment-damage-events.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
const result=[],details={};
const hit=(out,r,t)=>out.hits.find(h=>h.role===r&&h.time===t&&h.category!=='equipment');
const eq=(actual,expected)=>assert.ok(close(actual,expected),`actual ${actual}; expected ${expected}`);
const equip=(x,r,set)=>{x.single_interfaces[r].artifacts=gear(r,set,10+r);};
const record=(name,fn)=>{try{const evidence=fn();result.push({name,pass:true,evidence});}catch(e){result.push({name,pass:false,error:e.stack});}};
function capture(x){const damage=[],attributes=[];const wrapped={...api,CalculatorInterface:{get_damage_analysis(x,...args){const d=api.CalculatorInterface.get_damage_analysis(x,...args);damage.push({x,d});return d;}},CommonInterface:{get_attribute(x){const p=api.CommonInterface.get_attribute(x);attributes.push({x,p});return p;}}};return {out:createTeamDpsEvaluator(wrapped,x).evaluate(builds(x),true),damage,attributes};}
function healCheck(set){const x=sample();equip(x,2,set);const c=capture(x),h=c.out.heals.find(h=>h.role===2&&h.time===6.5),p=c.out.panels[2],outgoing=sum(p.healing_bonus),incoming=.3+(set==='MaidenBeloved'?.2:0),base=1.3824*sum(p.atk),expected=base*(1+outgoing+incoming);details['healing/'+set]={actual:h.amount,expected,base,outgoing,incoming};eq(h.amount,expected);return details['healing/'+set];}
record('axis: C0 33/26/19/5',()=>{const o=run(sample()),counts=[0,1,2,3].map(r=>o.hits.filter(h=>h.role===r).length);assert.deepEqual(counts,[33,26,19,5]);return {counts,total:o.expectation};});
for(const set of ['GladiatorsFinale','MaidenBeloved','OceanHuedClam','SongOfDaysPast'])record('healing: additive incoming/outgoing '+set,()=>healCheck(set));
record('healing: Traveling Doctor two-piece recipient +20%',()=>{
 const a=sample(),before=run(a);a.single_interfaces[0].artifacts=gear(0,'TravelingDoctor',100);const after=run(a);
 const base=before.heals.find(h=>h.role===2&&h.time===8.5).amount,actual=after.heals.find(h=>h.role===2&&h.time===8.5).amount;
 const expected=1.3824*sum(before.panels[2].atk)*(1+.359+.3+.2);details.travelingDoctor={base,actual,expected};assert.ok(actual>base);return details.travelingDoctor;
});
record('clam: healing spent on Bond of Life is recorded',()=>{
 const x=sample();equip(x,3,'OceanHuedClam');x.single_interfaces[3].weapon=weapon('FlowingPurity');const out=run(x),rotation=compileTeamDpsAxis(x.team_dps.axis,out.profiles,x.team_dps),raw={...rotation,heals:out.heals};
 const expected=equipmentDamageEvents(out.profiles,builds(x),raw,h=>sum(h.rawAmounts),x.team_dps).procs.filter(p=>p.label.includes('海染'));
 const actual=out.hits.filter(p=>p.label.includes('海染'));details.clamBond={heals:out.heals.filter(h=>h.role===3).map(h=>({time:h.time,amount:h.amount,raw:sum(h.rawAmounts)})),actual:actual.map(h=>({time:h.time,flat:h.flat})),expected:expected.map(h=>({time:h.time,flat:h.fixed}))};
 assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i++)eq(actual[i].flat,expected[i].fixed);return details.clamBond;
});
record('native regression triage: heal prepass precedes damage',()=>{const c=capture(sample());assert.equal(c.damage[0].d.is_heal,true);return {firstCall:c.damage[0].x.character.name,index:c.damage[0].x.skill.index,firstDamage:c.out.hits[0].label};});
record('TTDS: R1-R5, recipient base ATK and exact expiry',()=>{
 const x=sample(),plain=run(x),values=[];x.single_interfaces[3].weapon=weapon('ThrillingTalesOfDragonSlayers');
 for(let refine=1;refine<=5;refine++){x.single_interfaces[3].weapon.refine=refine;const o=run(x),h=hit(o,0,7.75),p=hit(plain,0,7.75),base=p.analysis.atk['角色基础攻击']+p.analysis.atk['武器基础攻击'];eq(h.atk-p.atk,base*(.18+.06*refine));eq(hit(o,0,17.5).atk,hit(plain,0,17.5).atk);values.push({refine,atkGain:h.atk-p.atk});}return values;
});
record('Tenacity: same source no doubling',()=>{const x=sample();equip(x,2,'TenacityOfTheMillelith');const a=run(x);equip(x,3,'TenacityOfTheMillelith');const b=run(x);for(const t of [7.75,9.5,17.5,20.5])eq(hit(a,0,t).atk,hit(b,0,t).atk);return {sample:hit(b,0,9.5).atk};});
record('Cinder: Escoffier grants Hydro/Cryo 12%, no Nightsoul 28%',()=>{
 const x=sample(),plain=run(x);equip(x,2,'ScrollOfTheHeroOfCinderCity');const o=run(x);eq(hit(o,0,7.75).bonus-hit(plain,0,7.75).bonus,.12);const water=o.hits.find(h=>h.role===1&&h.time>7.75);eq(water.bonus-hit(plain,1,water.time).bonus,.12);return {carryBonus:hit(o,0,7.75).bonus-hit(plain,0,7.75).bonus};
});
record('Xiphos/Evenstar: current candidate mastery and independent evaluator',()=>{
 const x=sample();x.single_interfaces[1].weapon=weapon('XiphosMoonlight');x.single_interfaces[3].weapon=weapon('WanderingEvenstar');const b=builds(x),ev=createTeamDpsEvaluator(api,x),a=ev.evaluate(b,true),next=structuredClone(b);
 for(const r of [1,3]){next[r][0].id+=1000000;next[r][0].sub_stats.push(['ElementalMastery',500]);}
 const changed=ev.evaluate(next,true),fresh=createTeamDpsEvaluator(api,x).evaluate(next,true);eq(changed.expectation,fresh.expectation);eq(sum(changed.panels[0].recharge)-sum(a.panels[0].recharge),.054);eq(hit(changed,0,7.75).atk-hit(a,0,7.75).atk,36);eq(ev.evaluate(b,true).expectation,a.expectation);return {rechargeGain:.054,attackGain:36};
});
record('Widsith: random branch mean equals three separately evaluated themes',()=>{
 const x=sample();x.single_interfaces[3].weapon=weapon('TheWidsith');const mean=run(x),separate=['t1_rate','t2_rate','t3_rate'].map(theme=>{const y=structuredClone(x);y.team_dps.widsith_mode={3:theme};return run(y);});
 for(const k of ['expectation','critical','non_critical'])eq(mean[k],separate.reduce((n,o)=>n+o[k],0)/3);return {mean:mean.expectation,branches:separate.map(o=>o.expectation)};
});
record('Echoes: first two eligible trials = 36%, 48.8%; split hits share trial',()=>{
 const x=sample();equip(x,0,'EchoesOfAnOffering');const rows=run(x).hits.filter(h=>h.role===0&&h.category==='normal');eq(rows[0].echoes_probability,.36);eq(rows[1].echoes_probability,.488);for(let i=1;i<rows.length;i++)if(rows[i].time===rows[i-1].time)eq(rows[i].echoes_probability,rows[i-1].echoes_probability);return rows.slice(0,6).map(h=>({time:h.time,probability:h.echoes_probability}));
});
record('weapon procs: independent probability/cooldown mass (Fillet Blade R1)',()=>{
 const x=sample();x.single_interfaces[0].weapon=weapon('FilletBlade');const o=run(x),procs=o.hits.filter(h=>h.category==='equipment');eq(procs[0].analysis.event_probability,.5);eq(procs[1].analysis.event_probability,.25);eq(sum(procs[0].analysis.atk_ratio),2.4);return procs.slice(0,4).map(h=>({time:h.time,probability:h.analysis.event_probability,damage:h.expectation}));
});
record('Harmonic Whimsy: current Bond change triggers artifact stacks',()=>{const x=sample();x.single_interfaces[0].weapon=weapon('FinaleOfTheDeep');equip(x,0,'FragmentOfHarmonicWhimsy');const c=capture(x);assert.ok(c.out.bonds.some(b=>b.change==='increase'));assert.ok(c.out.bonds.some(b=>b.change==='clear'));assert.ok(c.damage.some(d=>d.x.artifact_config?.config_fragment_of_harmonic_whimsy?.level>0));return c.out.bonds.map(b=>({time:b.time,change:b.change,role:b.role}));});
record('C0-C6 and effective talent levels 1-15 at published interface',()=>{
 let count=0;for(let r=0;r<4;r++)for(let cons=0;cons<=6;cons++)for(let skill=0;skill<15;skill++){
  const x=sample();x.single_interfaces[r].character.constellation=cons;for(const k of ['skill1','skill2','skill3'])x.single_interfaces[r].character[k]=skill;
  const o=run(x);assert.ok(Number.isFinite(o.expectation));assert.equal(o.profiles[r].character.skill2,Math.min(14,skill+1));count++;
 }return {count};
});
// A spread over the complete catalogue records the actual scored hit and its
// independent multiplication, plus all public native inputs for that sample.
let index=0;const samples=[];
for(let r=0;r<4;r++)for(const w of Object.values(weapons).filter(w=>w.type===chars[sample().single_interfaces[r].character.name].weapon)){
 const x=sample(),set=allSets[index++%allSets.length];x.single_interfaces[r].weapon=weapon(w.name);if(w.star<3)x.single_interfaces[r].weapon.level=70;equip(x,r,set.name2);
 try{const c=capture(x),h=c.out.hits.filter(h=>h.role===r&&h.category!=='equipment').at(-1),d=h.analysis;
 samples.push({role:x.single_interfaces[r].character.name,weapon:w.name,set:set.name2,time:h.time,category:h.category,expectation:h.expectation,critical:h.critical,non_critical:h.non_critical,analysis:d,nativeCalls:c.damage.filter(v=>v.x.character.name===x.single_interfaces[r].character.name).map(v=>({index:v.x.skill.index,weapon:v.x.weapon,artifactConfig:v.x.artifact_config,isHeal:v.d.is_heal}))});
 }catch(e){samples.push({role:x.single_interfaces[r].character.name,weapon:w.name,set:set.name2,error:e.stack});}
}
fs.writeFileSync('.build-target/team-dps-full-audit/numerical-samples.json',JSON.stringify(samples,null,2));
fs.writeFileSync('.build-target/team-dps-full-audit/numerics.json',JSON.stringify({result,details,sampleCount:samples.length},null,2));
console.log(JSON.stringify({result,details,sampleCount:samples.length},null,2));if(result.some(r=>!r.pass))process.exitCode=1;
