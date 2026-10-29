import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {royalHit} from '../beta-data/team-dps-public-stats.mjs';
import {equipmentDamageEvents} from '../beta-data/equipment-damage-events.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
import {teamDpsWeaponAvailable} from '../beta-data/team-dps-equipment-support.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import * as stellar from '../src/algorithms/stellar-detail.mjs';
import {damageReactionOptions,defaultDamageReaction} from '../src/algorithms/reaction-labels.mjs';
import {eventBefore} from '../beta-data/team-engine/event-order.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function sample(){const p=TEAM_DPS_ROLES.map((n,r)=>{const x=fixture(n);x.artifacts.forEach(a=>a.id+=r*100);return x;});return {single_interfaces:p,team_dps:{axis:importedAxis(),enemy:{level:100,cryo_res:.1,hydro_res:.1,physical_res:.3},initial_ids:p.map(p=>p.artifacts.map(a=>a.id)),max_evaluations:4,result_count:2}};}
const builds=x=>x.single_interfaces.map(p=>p.artifacts),run=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
const add=(x,e)=>x.team_dps.axis.timeline.push({id:'new-'+x.team_dps.axis.timeline.length,...e});

test('remaining V1: healing recipients, Maiden, current-candidate bonds, C4 and C6',async()=>{
 const x=sample();x.single_interfaces[2].artifacts.forEach(a=>a.set_name='MaidenBeloved');
 const full=run(x),y=structuredClone(x);y.single_interfaces[2].artifacts.slice(2).forEach(a=>a.set_name='Adventurer');const two=run(y);
 const heal=o=>o.heals.find(h=>h.role===2&&h.time===5.5),outgoing=sum(two.panels[2].healing_bonus),incoming=o=>o.health.findLast(h=>eventBefore(h,heal(o))).fanfare*(o.profiles[1].character.skill3+1)*.0001;
 near(heal(full).rawAmounts[0]/heal(two).rawAmounts[0],(1+outgoing+incoming(full)+.2)/(1+outgoing+incoming(two)));assert.ok(heal(full).amount<=sum(heal(full).rawAmounts));
 assert.ok(full.heals.some(h=>h.healing==='furina_a1'));assert.equal(new Set(full.heals.filter(h=>h.healing==='furina_a1').map(h=>h.time)).size,full.heals.filter(h=>h.healing==='furina_a1').length);
 for(const [r,n]of [[1,'FinaleOfTheDeep'],[3,'FlowingPurity']]){
  const z=sample();z.single_interfaces[r].weapon=weapon(n);const saved=JSON.stringify(z),ev=createTeamDpsEvaluator(api,z),a=builds(z),out=ev.evaluate(a,true);
  assert.ok(out.bonds.some(b=>b.role===r&&b.change==='increase'));assert.ok(out.bonds.some(b=>b.role===r&&b.change==='clear'));
  const clear=out.bonds.find(b=>b.role===r&&b.change==='clear');assert.ok(clear.amount>0);
  const hit=out.hits.find(h=>h.role===r&&h.time>clear.time);assert.ok(Object.keys(n==='FinaleOfTheDeep'?hit.analysis.atk:hit.analysis.bonus).some(k=>k.includes('清契')));
  if(n==='FinaleOfTheDeep')near(hit.analysis.atk['海渊终曲·清契'],Math.min(150,clear.amount*.024));else near(hit.analysis.bonus['纯水流华·清契'],Math.min(.12,clear.amount/1000*.02));
  const changed=structuredClone(a);changed[r][0].id+=5000;changed[r][0].sub_stats.push(['HPFixed',8000]);const high=ev.evaluate(changed,true);
  assert.ok(high.bonds.find(b=>b.role===r&&b.change==='increase').amount>out.bonds.find(b=>b.role===r&&b.change==='increase').amount);
  near(ev.evaluate(a).expectation,out.expectation);near(high.expectation,createTeamDpsEvaluator(api,z).evaluate(changed).expectation);assert.equal(JSON.stringify(z),saved);
 }
 const c=sample(),plain=run(c);c.single_interfaces[2].character.constellation=4;const four=(await nodeTeamDps(c,builds(c).flat(),{mode:'evaluate'})).results[0];
 const ordinary=plain.heals.find(h=>h.role===2&&h.time===6.5),first=four.eventTrace.events.find(e=>e.channel==='heals'&&e.states[0].value.role===2&&e.states[0].value.time===6.5),critical=Math.min(1,Math.max(0,sum(four.panels[2].critical)));
 assert.ok(first);near(first.probability,1);let doubled=0,raw=0;
 for(const state of first.states){const ratio=state.value.rawAmounts[0]/ordinary.rawAmounts[0];near(ratio,ratio>1.5?2:1);if(ratio>1.5)doubled+=state.probability;raw+=state.probability*state.value.rawAmounts[0];}
 near(doubled,critical);near(raw/ordinary.rawAmounts[0],1+critical);
 const f=sample();f.single_interfaces[1].character.constellation=6;f.team_dps.axis.timeline=f.team_dps.axis.timeline.filter(e=>e.action!=='furina.c6.normal');
 for(const t of [1000,1100,1200,1300,1400,1500,1700])add(f,{kind:'hit',actor:'hydro',timeMs:t,action:'furina.c6.normal'});
 const c6=run(f);assert.equal(c6.hits.filter(h=>h.role===1&&h.category==='normal'&&h.furinaC6).length,6);assert.ok(c6.heals.some(h=>h.healing==='furina_c6'));assert.equal(c6.hits.find(h=>h.time===1.7&&h.role===1&&h.category==='normal').analysis.element,'Physical');
 const d=sample();d.single_interfaces[0].artifacts.forEach(a=>a.set_name='TravelingDoctor');assert.ok(run(d).heals.some(h=>h.healing==='traveling_doctor'&&h.role===0));
 const b=sample();b.single_interfaces[0].weapon=weapon('TheBlackSword');const black=(await nodeTeamDps(b,builds(b).flat(),{mode:'evaluate'})).results[0];
 const blackHeals=black.eventTrace.events.filter(e=>e.channel==='heals'&&e.states[0].value.healing==='black_sword'),firstHit=black.eventTrace.events.find(e=>e.channel==='hits'&&e.states[0].value.role===0);assert.ok(blackHeals.length);
 near(blackHeals[0].probability,Math.min(1,Math.max(0,firstHit.states[0].value.crit)));near(blackHeals[0].states[0].value.time,firstHit.states[0].value.time);
});

test('remaining V2: intervals, short swaps, refreshes, zero energy and recasts',()=>{
 const x=sample(),p=x.single_interfaces,base=compileTeamDpsAxis(x.team_dps.axis,p);
 const hps=[0,.1,.2,.3].map((time,i)=>({kind:'hp_change',change:'increase',role:3,time,rootOrder:i}));
 const simple={...base,roots:[],events:[],heals:[],hpEvents:hps.map(h=>({...h,order:0,amount:100,ratio:.01})),switches:[],activeRole:()=>3};
 for(const n of ['CashflowSupervision','TomeOfTheEternalFlow']){p[3].weapon=weapon(n);const r=createEquipmentAxisRules(p,simple);const at=t=>r.prepare(structuredClone(p[3]),3,{time:t,rootOrder:99,order:99}).weapon.params[n].stack;assert.equal(at(.21),1);assert.equal(at(.31),2);}
 assert.equal(createEquipmentAxisRules(p,{...simple,activeRole:()=>0}).prepare(structuredClone(p[3]),3,{time:.31,rootOrder:99,order:99}).weapon.params.TomeOfTheEternalFlow.stack,0);
 p[3].weapon=weapon('SacrificialJade');const switches=[{time:6,from:0,role:3,rootOrder:0},{time:8,from:3,role:0,rootOrder:1},{time:9,from:0,role:3,rootOrder:2}].map(s=>({...s,kind:'switch'}));
 const jade={...simple,roots:[],switches,activeRole:t=>switches.filter(s=>s.time<=t).at(-1)?.role??0};const jr=createEquipmentAxisRules(p,jade),jp=t=>jr.prepare(structuredClone(p[3]),3,{time:t,rootOrder:99,order:99}).weapon.params.SacrificialJade.rate;
 assert.equal(jp(6.1),1);assert.equal(jp(9.1),1);assert.equal(jp(19),0);
 p[3].weapon=weapon('KagurasVerity');const casts=[0,8,17].map((time,i)=>({kind:'cast',action:'skill',role:3,time,rootOrder:i}));
 const kr=createEquipmentAxisRules(p,{...simple,roots:casts});const kp=kr.prepare(structuredClone(p[3]),3,{time:18,rootOrder:99,order:99});assert.equal(kp.weapon.params.KagurasVerity.stack,3);
 p[1].artifacts.forEach(a=>a.set_name='FinaleOfTheDeepGalleries');const dr=createEquipmentAxisRules(p,base);const dp=dr.prepare(structuredClone(p[1]),1,{time:1,rootOrder:99,order:99});assert.equal(dp.artifact_config.config_finale_of_the_deep_galleries.rate2,1);
 for(const n of ['Azurelight','MistsplitterReforged']){p[0].weapon=weapon(n);p[1].weapon=weapon(n);const rules=createEquipmentAxisRules(p,base),at=r=>rules.prepare(structuredClone(p[r]),r,{time:0,rootOrder:-1,order:-1}).weapon.params[n];assert.equal(Number(at(0)[n==='Azurelight'?'zero_energy':'emblem_level']),1);assert.equal(Number(at(1)[n==='Azurelight'?'zero_energy':'emblem_level']),0);}
 p[3].artifacts.forEach(a=>a.set_name='HuskOfOpulentDreams');const husk=createEquipmentAxisRules(p,jade),hp=husk.prepare(structuredClone(p[3]),3,{time:11.9,rootOrder:99,order:99});assert.equal(hp.artifact_config.config_husk_of_opulent_dreams.level,2);
 const repeat=sample();repeat.single_interfaces[2].character.constellation=6;repeat.team_dps.axis.durationMs=42000;
 repeat.team_dps.axis.timeline.push(...repeat.team_dps.axis.timeline.map(e=>({...e,id:'repeat-'+e.id,timeMs:e.timeMs+21000})));
 const rr=compileTeamDpsAxis(repeat.team_dps.axis,repeat.single_interfaces);assert.equal(rr.events.filter(e=>e.action===undefined&&e.label.includes('六命追加')).length,12);
 assert.ok(rr.covered('vodyFlat',29));assert.equal(rr.events.filter(e=>e.escoFlat).length,10);
 // The accepted multi-hit approximation keeps a template's sub-hits at one timestamp.
 const pair=rr.events.filter(e=>e.eventId==='event-30');if(pair.length>1)assert.equal(pair[0].time,pair[1].time);
});

test('remaining V3: real WASM weapon procs, Royal probability, reductions, multi-target and Worker',async()=>{
 const names=['FinaleOfTheDeep','FlowingPurity','RoyalLongsword','RoyalSpear','RoyalGrimoire','TheBlackSword','PrizedIsshinBlade','SwordOfNarzissenkreuz','SkywardAtlas','EyeOfPerception','Frostbearer','SkywardSpine','DragonspineSpear','Halberd'];assert.ok(names.every(teamDpsWeaponAvailable));
 let state=[1,0,0,0,0,0],brute=[{mass:1,stacks:0}];for(const cr of [.1,.2,.15,.3]){const step=royalHit(state,cr,1);let expected=0;const next=[];for(const b of brute){const q=Math.min(1,cr+.08*b.stacks);expected+=b.mass*q;next.push({mass:b.mass*q,stacks:0},{mass:b.mass*(1-q),stacks:Math.min(5,b.stacks+1)});}near(step.critical,expected);state=step.state;brute=next;}
 for(const [r,n]of [[0,'RoyalLongsword'],[2,'RoyalSpear'],[3,'RoyalGrimoire']]){const x=sample();x.single_interfaces[r].weapon=weapon(n);const out=run(x),first=out.hits.find(h=>h.role===r);near(first.analysis.critical['宗室·逐击概率'],0);assert.equal('宗室被动等效'in first.analysis.critical,false);}
 for(const [r,n]of [[0,'PrizedIsshinBlade'],[0,'SwordOfNarzissenkreuz'],[2,'SkywardSpine'],[2,'DragonspineSpear'],[2,'Halberd'],[3,'SkywardAtlas'],[3,'EyeOfPerception'],[3,'Frostbearer']]){
  const x=sample();x.single_interfaces[r].weapon=weapon(n);add(x,{kind:'switch',actor:x.team_dps.axis.members[r].slot,timeMs:600});
  const action=r===0?'skirk.normal.1':r===2?'escoffier.normal.1':'vodyanitsa.normal.1';
  for(const t of [700,1000,1500])add(x,{kind:'hit',actor:x.team_dps.axis.members[r].slot,timeMs:t,action});
  const a=run(x),proc=a.hits.find(h=>h.category==='equipment'&&h.role===r);assert.ok(proc,n);
  x.single_interfaces[r].buffs.push({name:'ExtensionEffect',config:{ExtensionEffect:{label:'reduction',values:{DefMinus:.3,ResMinusPhysical:.2}}}});const b=run(x),changed=b.hits.find(h=>h.category==='equipment'&&h.role===r);
  near(changed.def,190/(190+200*.7));near(changed.res,.9);assert.ok(changed.expectation>proc.expectation);
  if(n==='SwordOfNarzissenkreuz'){x.team_dps.narzissenkreuz_enabled=false;assert.equal(run(x).hits.some(h=>h.category==='equipment'&&h.role===r),false);}
  if(n==='PrizedIsshinBlade')assert.ok(a.heals.some(h=>h.healing==='isshin'));
  if(n!=='PrizedIsshinBlade'&&n!=='SwordOfNarzissenkreuz'){x.single_interfaces[r].weapon.refine=5;const five=run(x).hits.find(h=>h.category==='equipment'&&h.role===r);near(sum(five.analysis.atk_ratio),{SkywardSpine:1,DragonspineSpear:3.6,Halberd:3.2,SkywardAtlas:3.2,EyeOfPerception:3.6,Frostbearer:3.6}[n]);}
 }
 const eye=sample();eye.single_interfaces[3].weapon=weapon('EyeOfPerception');const rot=compileTeamDpsAxis(eye.team_dps.axis,eye.single_interfaces);rot.events=[{role:3,time:0,category:'normal',onField:true,order:0,rootOrder:0}];rot.heals=[];
 const es=n=>equipmentDamageEvents(eye.single_interfaces,builds(eye),rot,()=>0,{enemy_count:n,damage_scope:'all'}).procs;
 assert.equal(es(1).length,1);assert.equal(es(2).length,2);assert.equal(es(4).length,5);near(es(1)[0].ratio,2.4);near(es(1)[0].probability,.5);
 const multi=sample();multi.team_dps.enemy_count=3;multi.team_dps.damage_scope='all';multi.single_interfaces[0].weapon=weapon('SwordOfDescension');const mo=run(multi);
 const uiCode=fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysis.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =');
 const ui={...stellar,damageReactionOptions,defaultDamageReaction,DamageAnalysisUtil:{},StellarDamageDetail:{},LEVEL_MULTIPLIER:[],console};vm.runInNewContext(uiCode,ui);
 for(const h of [mo.hits.find(h=>h.role===0),mo.hits.find(h=>h.category==='equipment')]){const d={...ui.component.data(),enemyConfig:mo.enemy,characterLevel:90,characterName:mo.profiles[h.role].character.name};for(const [k,f]of Object.entries(ui.component.methods))d[k]=f.bind(d);for(const [k,f]of Object.entries(ui.component.computed))Object.defineProperty(d,k,{get:()=>f.call(d)});d.setValue(h.analysis);near(d.selectedActualResult.expectation,h.expectation);assert.equal(d.targetCount,3);assert.ok(d.eventProbability<=1);d.setValue({...h.analysis,team_hit:false});assert.equal(d.targetCount,1);}
 const x=sample();x.single_interfaces[1].weapon=weapon('FinaleOfTheDeep');const saved=JSON.stringify(x),result=await nodeTeamDps(x,builds(x).flat(),{threads:4});
 assert.equal(result.evaluated_teams,4);assert.equal(JSON.stringify(x),saved);compareEventValues(result.baseline.eventTrace,nativeEventTrace(run(x)));
});
