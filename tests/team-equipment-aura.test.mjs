import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {equipmentAuraInput,equipmentAuraTeams,equipmentAuraEvaluator,stellarEquipmentInput,stellarEquipmentTeams} from './helpers/team-equipment-aura-fixture.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {equipmentReactionFacts} from '../beta-data/equipment-reaction-rules.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),part=(h,field,label)=>Object.entries(h.analysis[field]).filter(([key])=>key.includes(label)).reduce((n,[,v])=>n+v,0);
test('authoritative equipment reactions never infer missing reactions from party composition or duplicate stellar into ordinary superconduct',()=>{
 const hit={kind:'hit',eventId:'h',role:0,time:1,rootOrder:0,order:0,element:'Cryo'},elements=['Cryo','Hydro','Electro'];
 assert.ok(equipmentReactionFacts([hit],elements).length>0);assert.deepEqual(equipmentReactionFacts([hit],elements,[],[],{resolvedOnly:true}),[]);
 const fact={...hit,kind:'reaction',reaction:'StellarConduct',reactionType:'StellarConduct',elements:['Cryo','Electro'],enabled:0};
 assert.deepEqual(equipmentReactionFacts([hit],elements,[],[fact],{resolvedOnly:true}),[fact]);
});
test('real Stellar Conduct includes attacking-only Shadow crit without admitting category-specific crit',()=>{
 const input=stellarEquipmentInput(),teams=stellarEquipmentTeams(input),a=createTeamDpsEvaluator(api,input).evaluate(teams[0],true),b=createTeamDpsEvaluator(api,input).evaluate(teams[1],true);
 const rows=a.hits.filter(h=>h.role===2&&h.damageModel==='reaction.stellarConduct');assert.ok(rows.length>0);
 for(const h of rows){const control=b.hits.find(v=>v.eventId===h.eventId&&v.targetIds[0]===h.targetIds[0]);near(part(h,'critical','影中沉凝'),.16);near(h.crit-control.crit,.16);}
});
test('real multi-target aura gates native equipment, resonance and Qiqi C2 at impact, including source snapshots and compiled candidates',async()=>{
 const input=equipmentAuraInput(),teams=equipmentAuraTeams(input),native=teams.map((t,i)=>equipmentAuraEvaluator(api,{...input,testHydro:i===1?0:1}).evaluate(t,true));
 for(const [i,result]of native.entries()){
  const rows=id=>result.hits.filter(h=>h.eventId===id||h.eventId.startsWith(id+'/')),one=(id,target)=>rows(id).find(h=>h.targetIds[0]===target);
  assert.ok(one('n2/normal.1',0).statSnapshot);
  for(const h of rows('n0/normal.1')){near(part(h,'critical','冰风'),0);near(part(h,'critical','双冰'),0);near(part(h,'bonus','冷刃'),0);}
  near(part(one('n1/normal.1',0),'critical','冰风'),.2);near(part(one('n1/normal.1',1),'critical','冰风'),0);
  for(const id of ['n1/normal.1','n2/normal.1','n3/normal.1']){
   near(part(one(id,0),'critical','双冰'),.15);near(part(one(id,1),'critical','双冰'),0);
   near(part(one(id,0),'bonus','冷刃'),.12);near(part(one(id,1),'bonus','冷刃'),0);
   near(part(one(id,0),'bonus','七七·冰寒蚀骨·冰附着'),.15);near(part(one(id,1),'bonus','七七·冰寒蚀骨·冰附着'),0);
  }
  near(part(one('n2/normal.1',0),'critical','冰风'),i===1?.2:.4);
  const yae=result.hits.filter(h=>h.role===1&&h.category==='normal').at(-1);assert.ok(yae);
  const later=result.hits.filter(h=>h.role===1&&h.category==='normal'&&h.time===yae.time),electro=later.find(h=>h.targetIds[0]===1),cryo=later.find(h=>h.targetIds[0]===0);
  // Salon Hydro lands before the later same-time normal on target 0.
  near(part(electro,'bonus','魔导绪论'),.12);near(part(cryo,'bonus','魔导绪论'),i===1?0:.12);
  if(i!==1){near(part(electro,'bonus','平息鸣雷'),.35);near(part(cryo,'bonus','平息鸣雷'),0);}else{near(part(cryo,'critical','影中沉凝'),.16);near(part(electro,'critical','影中沉凝'),0);}
  for(const h of result.hits)if(h.time<.6)near(part(h,'em','教官'),0);
  assert.ok(result.hits.every(h=>part(h,'em','饰金之梦4')===0));
  for(const h of rows('equipment/physical')){
   const target=h.targetIds[0];near(h.res,target===0?1.15:.9);near(h.crit,target===0?(i===1?.4:.6):.05);
   near(h.non_critical,h.atk*(1+h.bonus)*h.def*h.res);
  }
  for(const h of rows('equipment/fixed')){near(h.expectation,h.targetIds[0]===0?1150:900);near(h.crit,0);near(h.def,1);}
 }
 const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(equipmentAuraEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,equipmentAuraEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
});
