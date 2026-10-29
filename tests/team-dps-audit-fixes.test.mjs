import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sample,gear,builds,run,sum,inspect} from '../beta-tools/team-dps-full-audit.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
import * as stellar from '../src/algorithms/stellar-detail.mjs';
import {damageReactionOptions,defaultDamageReaction} from '../src/algorithms/reaction-labels.mjs';
import {eventBefore} from '../beta-data/team-engine/event-order.mjs';

const eq=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hit=(o,r,t)=>o.hits.find(h=>h.role===r&&h.time===t&&h.category!=='equipment');
const incomingAt=(out,h)=>out.health.findLast(row=>eventBefore(row,h)).fanfare*(out.profiles.find(p=>p.character.name==='Furina').character.skill3+1)*.0001;
const directory=process.env.TEAM_DPS_TEST_OUTPUT_DIR||'.build-target/team-dps-tests/audit-fixes';
const record=(name,data)=>{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/'+name+'.json',JSON.stringify(data,null,2));};

export async function workerCheck(){
 const x=sample();x.single_interfaces[2].weapon=weapon('CrescentPike');x.single_interfaces[1].weapon=weapon('XiphosMoonlight');x.single_interfaces[3].artifacts=gear(3,'SongOfDaysPast');
 x.team_dps.initial_ids=builds(x).map(b=>b.map(a=>a.id));x.team_dps.max_evaluations=4;x.team_dps.result_count=2;
 const saved=JSON.stringify(x),native=api.CalculatorInterface.get_damage_analysis(x.single_interfaces[2],null),updates=[];
 const optimized=await nodeTeamDps(x,builds(x).flat(),{threads:4,onProgress:p=>updates.push(p)});assert.equal(optimized.evaluated_teams,4);assert.equal(optimized.results.length,2);assert.ok(updates.length>0);
 const direct=await nodeTeamDps(x,builds(x).flat(),{mode:'evaluate'}),reference=run(x);
 for(const metric of ['expectation','critical','non_critical'])eq(direct.results[0][metric],reference[metric]);
 compareEventValues(direct.results[0].eventTrace,nativeEventTrace(reference));
 assert.equal(JSON.stringify(x),saved);
 const after=api.CalculatorInterface.get_damage_analysis(x.single_interfaces[2],null);
 for(const metric of ['expectation','critical','non_critical'])eq(after.normal[metric],native.normal[metric]);
 assert.deepEqual({...after,normal:null},{...native,normal:null});
 return {workerEvaluated:4,resultCount:2,evaluateMatched:true,singleHitUnchanged:true};
}

test('V1 healing: additive bonuses, recipient two-piece, and pre-Bond Clam/Song recording',()=>{
 const rows=[];
 for(const set of ['GladiatorsFinale','MaidenBeloved','OceanHuedClam','SongOfDaysPast']){
  const x=sample();x.single_interfaces[2].artifacts=gear(2,set);const calls=[];
  const wrapped={...api,CalculatorInterface:{get_damage_analysis(input,...args){const d=api.CalculatorInterface.get_damage_analysis(input,...args);if(d.is_heal)calls.push({input,d});return d;}}};
  const out=createTeamDpsEvaluator(wrapped,x).evaluate(builds(x),true),h=out.heals.find(h=>h.role===2&&h.time===6.5),outgoing=sum(out.panels[2].healing_bonus),incoming=incomingAt(out,h)+(set==='MaidenBeloved'?.2:0);
  eq(h.rawAmounts[0],1.3824*sum(out.panels[2].atk)*(1+outgoing+incoming));assert.ok(h.amount<=h.rawAmounts[0]);
  const d=calls.find(c=>c.input.character.name==='Escoffier').d,base=sum(d.atk)*sum(d.atk_ratio)+sum(d.extra_damage);
  const burst=out.heals.find(h=>h.role===2&&h.time===5.5),burstIncoming=incomingAt(out,burst)+(set==='MaidenBeloved'?.2:0);
  for(const amount of burst.rawAmounts)eq(amount,base*(1+sum(d.healing_bonus)+burstIncoming));
  rows.push({set,hotRaw:h.rawAmounts[0],hotEffective:h.amount,burstPerRecipient:base*(1+sum(d.healing_bonus)+burstIncoming)});
 }
 const x=sample(),plain=run(x),original=builds(x)[0],base=1.3824*sum(plain.panels[2].atk);
 for(const count of [1,2,4]){
  x.single_interfaces[0].artifacts=structuredClone(original);x.single_interfaces[0].artifacts.slice(0,count).forEach(a=>a.set_name='TravelingDoctor');
  const out=run(x),h=out.heals.find(h=>h.role===2&&h.time===8.5);
  eq(h.rawAmounts[0],base*(1+sum(plain.panels[2].healing_bonus)+incomingAt(out,h)+(count>=2?.2:0)));
  rows.push({doctorPieces:count,healRaw:h.rawAmounts[0],healEffective:h.amount});
 }
 for(const set of ['OceanHuedClam','SongOfDaysPast']){
  const y=sample();y.single_interfaces[3].artifacts=gear(3,set);y.single_interfaces[3].weapon=weapon('FlowingPurity');const o=run(y),heals=o.heals.filter(h=>h.role===3),first=heals[0];
  assert.ok(sum(first.rawAmounts)>first.amount);assert.ok(o.bonds.some(b=>b.role===3&&b.change==='clear'));
  const end=first.time+(set==='OceanHuedClam'?3:6),raw=heals.filter(h=>h.time<end).reduce((n,h)=>n+sum(h.rawAmounts),0);
  if(set==='OceanHuedClam')eq(o.hits.find(h=>h.label.includes('海染')).flat,.9*Math.min(30000,raw));
  else {
   const control=structuredClone(y);control.single_interfaces[3].artifacts.forEach(a=>a.set_name=a.set_name==='SongOfDaysPast'?'OceanHuedClam':a.set_name);const without=run(control);
   for(const h of o.hits.filter(h=>h.onField&&h.time>=end).slice(0,5))eq(h.flat-hit(without,h.role,h.time).flat,.08*Math.min(15000,raw));
  }
  assert.deepEqual(inspect(o),[]);rows.push({set,firstRaw:sum(first.rawAmounts),firstEffective:first.amount,recorded:raw});
 }
 record('V1',rows);
});

test('V2 Escoffier C1: E/Q refresh, expiry and same-time root order',()=>{
 const check=(x,times,expected)=>{const a=run(x);x.single_interfaces[2].character.constellation=1;const b=run(x);for(let i=0;i<times.length;i++)eq(hit(b,0,times[i]).crit_damage-hit(a,0,times[i]).crit_damage,expected[i]);return {times,gains:times.map(t=>hit(b,0,t).crit_damage-hit(a,0,t).crit_damage),total:b.expectation};};
 const rows=[check(sample(),[17.5,18.5,19,19.5,20,20.5],[.6,.6,.6,.6,.6,0])];
 const e=sample();
 // Actor names come from the imported configuration, allowing a different author label.
 const escoSlot=e.team_dps.axis.members[2].slot;
 e.team_dps.axis.timeline.find(h=>h.actor===escoSlot&&h.kind==='cast'&&h.action==='burst').timeMs=0;
 rows.push(check(e,[17.5,18.5,20.5],[.6,0,0]));
 const q=sample();q.team_dps.axis.timeline.find(h=>h.actor===escoSlot&&h.kind==='cast'&&h.action==='skill').timeMs=0;
 rows.push(check(q,[18.5,20,20.5],[.6,.6,0]));
 for(const before of [false,true]){
  const x=sample();x.team_dps.axis.timeline.find(h=>h.actor===escoSlot&&h.kind==='cast'&&h.action==='burst').timeMs=0;
  const at=x.team_dps.axis.timeline.findIndex(h=>h.timeMs===18500&&h.kind==='hit'&&h.actor===x.team_dps.axis.members[0].slot);
  x.team_dps.axis.timeline.splice(at+(before?0:1),0,{id:'c1-refresh',kind:'cast',timeMs:18500,actor:escoSlot,action:'burst'});
  rows.push(check(x,[18.5,19],[before?.6:0,.6]));
 }
 record('V2',rows);
});

test('V3 weapon fixes: native Pike contract, converted ER channel, and one marked target',()=>{
 const rows=[];
 for(const refine of [1,5])for(const set of ['GladiatorsFinale','EmblemOfSeveredFate','OceanHuedClam','SongOfDaysPast']){
  const x=sample();x.single_interfaces[2].weapon=weapon('CrescentPike');x.single_interfaces[2].weapon.refine=refine;x.single_interfaces[2].artifacts=gear(2,set);
  const native=api.CommonInterface.get_attribute(x.single_interfaces[2]),saved=JSON.stringify(x),out=run(x);
  eq(sum(native.atk),sum(out.panels[2].atk));assert.deepEqual(inspect(out),[]);assert.equal(JSON.stringify(x),saved);assert.equal(x.single_interfaces[2].weapon.params,'NoConfig');rows.push({pike:refine,set,total:out.expectation});
 }
 for(const extraER of [0,1.15,1.5]){
  const x=sample();x.single_interfaces[1].weapon=weapon('XiphosMoonlight');x.single_interfaces[1].artifacts=gear(1,'EmblemOfSeveredFate');x.single_interfaces[1].artifacts[0].sub_stats.push(['Recharge',extraER]);x.single_interfaces[2].weapon=weapon('EngulfingLightning');
  const saved=JSON.stringify(x),b=builds(x),e=createTeamDpsEvaluator(api,x),a=e.evaluate(b,true),next=structuredClone(b);next[1][0].id+=1000000;next[1][0].sub_stats.push(['ElementalMastery',500]);const c=e.evaluate(next,true);
  eq(sum(c.panels[1].recharge)-sum(a.panels[1].recharge),.18);eq(sum(c.panels[2].recharge)-sum(a.panels[2].recharge),.054);
  if(extraER===1.15){assert.ok(sum(a.panels[1].recharge)<3);assert.ok(sum(c.panels[1].recharge)>3);}
  eq(sum(e.constraints(1,next).recharge),sum(c.panels[1].recharge));eq(c.expectation,a.expectation);
  for(const t of [3,6,15]){const ha=hit(a,2,t),hc=hit(c,2,t);if(ha){eq(hc.atk,ha.atk);eq(hc.expectation,ha.expectation);}}
  eq(c.expectation,createTeamDpsEvaluator(api,x).evaluate(next).expectation);eq(e.evaluate(b).expectation,a.expectation);assert.equal(JSON.stringify(x),saved);
  rows.push({extraER,recharge:sum(c.panels[1].recharge),burstBonus:c.hits.find(h=>h.role===1&&h.category==='burst').bonus,total:c.expectation});
 }
 const stacked=sample();for(const r of [0,1])stacked.single_interfaces[r].weapon=weapon('XiphosMoonlight');const se=createTeamDpsEvaluator(api,stacked),sb=builds(stacked),sa=se.evaluate(sb);const sc=structuredClone(sb);for(const r of [0,1]){sc[r][0].id+=1000000;sc[r][0].sub_stats.push(['ElementalMastery',500]);}const so=se.evaluate(sc);eq(sum(so.panels[0].recharge)-sum(sa.panels[0].recharge),.234);eq(sum(so.panels[2].recharge)-sum(sa.panels[2].recharge),.108);
 for(const refine of [1,5])for(const enemies of [1,3])for(const coverage of [.5,1])for(const scope of ['single','all']){
  const x=sample();x.single_interfaces[0].weapon=weapon('ToukabouShigure');x.single_interfaces[0].weapon.refine=refine;Object.assign(x.team_dps,{enemy_count:enemies,damage_scope:scope});
  x.team_dps.weapon_conditions[0].ToukabouShigure.rate=0;const a=run(x);x.team_dps.weapon_conditions[0].ToukabouShigure.rate=coverage;const b=run(x),targets=scope==='all'?enemies:1;
  for(const ha of a.hits.filter(h=>h.role===0)){const hb=b.hits.find(h=>h.order===ha.order);for(const metric of ['expectation','critical','non_critical'])eq(hb[metric]-ha[metric],ha[metric]/(1+ha.bonus)*(.12+.04*refine)*coverage/targets);}
  assert.deepEqual(inspect(b),[]);rows.push({parasol:refine,enemies,coverage,scope,gain:b.character_damage[0].expectation-a.character_damage[0].expectation});
 }
 record('V3',rows);
});

test('V4 joint search: converted ER eligibility, top K and selected-hit dialog consistency',async()=>{
 const x=sample(),mains=[['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],['CryoBonus','HydroBonus','ATKPercentage','HPPercentage'],['CriticalRate','CriticalDamage','HealingBonus','HPPercentage']];
 const sets=['GladiatorsFinale','EmblemOfSeveredFate','OceanHuedClam','SongOfDaysPast'];
 for(let r=0;r<4;r++){
  const p=x.single_interfaces[r];p.artifacts=gear(r,sets[r]);p.weapon=weapon(['ToukabouShigure','XiphosMoonlight','CrescentPike','FlowingPurity'][r]);
  for(let k=2;k<5;k++)p.artifacts[k].main_stat=[mains[k-2][r],.2];
  p.filter=Object.fromEntries(['sand_main_stat','goblet_main_stat','head_main_stat'].map((key,k)=>[key,[mains[k][r]]]));
 }
 x.single_interfaces[2].character.constellation=1;x.single_interfaces[2].constraint.set_mode={Set4:'OceanHuedClam'};
 // Distinct flower mastery makes candidate-derived ER decide which assignments pass.
 builds(x).forEach((b,r)=>b[0].sub_stats.push(['ElementalMastery',r*100]));
 const ev=createTeamDpsEvaluator(api,x),baseline=ev.evaluate(builds(x));x.single_interfaces[2].constraint.recharge_min=sum(baseline.panels[2].recharge)+.005;
 x.team_dps.initial_ids=builds(x).map(b=>b.map(a=>a.id));Object.assign(x.team_dps,{max_evaluations:65536,result_count:5,enemy_count:3,damage_scope:'all'});
 const inventory=builds(x).flat(),saved=JSON.stringify({x,inventory}),oracle=[];
 function* perm(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*perm(a.filter((_,j)=>j!==i),[...p,a[i]]);}
 const oracleEvaluator=createTeamDpsEvaluator(api,x);
 for(const f of perm(inventory.filter(a=>a.slot==='Flower')))for(const g of perm(inventory.filter(a=>a.slot==='Feather'))){
  const b=builds(x).map((a,r)=>[f[r],g[r],...a.slice(2)]);
  if(b[2].filter(a=>a.set_name==='OceanHuedClam').length<4||sum(oracleEvaluator.constraints(2,b).recharge)<x.single_interfaces[2].constraint.recharge_min)continue;
  oracle.push({key:b.flat().map(a=>a.id).join(','),...oracleEvaluator.evaluate(b)});
 }
 assert.ok(oracle.length>=5);const outputs=[];
 for(const metric of ['expectation','critical','non_critical']){
  x.team_dps.metric=metric;const out=optimizeTeamDps(api,x,inventory),expected=oracle.slice().sort((a,b)=>b[metric]-a[metric]).slice(0,5);
  assert.equal(out.search_complete,true);assert.equal(out.legal_teams,oracle.length);assert.ok(out.evaluated_teams>=oracle.length&&out.evaluated_teams<=576);assert.ok(out.search_stats.pruned_nodes>0);assert.equal(out.results.length,5);
  out.results.forEach((r,i)=>{eq(r[metric],expected[i][metric]);assert.equal(new Set(r.artifacts.flatMap(Object.values)).size,20);assert.ok(oracle.some(o=>o.key===r.artifacts.flatMap(b=>['flower','feather','sand','goblet','head'].map(k=>b[k])).join(',')&&Math.abs(o[metric]-r[metric])<1e-6));});
  outputs.push(out);
 }
 x.team_dps.metric='expectation';assert.equal(JSON.stringify({x,inventory}),saved);
 const code=fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysis.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =');
 const env={...stellar,damageReactionOptions,defaultDamageReaction,DamageAnalysisUtil:{},StellarDamageDetail:{},LEVEL_MULTIPLIER:[],console};vm.createContext(env);vm.runInContext(code,env);
 let details=0;
 for(const out of outputs){const best=out.results[0];assert.deepEqual(inspect(best),[]);
  for(const h of best.hits){const state={...env.component.data(),enemyConfig:best.enemy,characterLevel:best.profiles[h.role].character.level,characterName:best.profiles[h.role].character.name};for(const [k,f]of Object.entries(env.component.methods))state[k]=f.bind(state);for(const [k,f]of Object.entries(env.component.computed))Object.defineProperty(state,k,{get:()=>f.call(state)});state.setValue(h.analysis);for(const metric of ['expectation','critical','non_critical'])eq(state.selectedActualResult[metric],h[metric]);details++;}
 }
 record('V4',{enumeratedPerMetric:576,evaluatedPerMetric:outputs.map(o=>({metric:o.metric,count:o.evaluated_teams})),legal:oracle.length,retainedPerMetric:5,dialogHits:details,best:outputs.map(o=>({metric:o.metric,value:o.results[0][o.metric]})),...await workerCheck()});
});
