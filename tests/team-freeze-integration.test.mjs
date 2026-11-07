import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {freezeInput,freezeTeams,gatedFreezeEvaluator} from './helpers/team-freeze-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Furina Salon members have independent two-hit clocks, no Arkhe aura and only C6 infuses normals',()=>{
 const input=freezeInput();input.team_dps.axis.timeline=[input.team_dps.axis.timeline[0],...Array.from({length:7},(_,i)=>({id:'n'+i,actor:'member1',kind:'action',action:'normal.1',timeMs:500+100*i})),{id:'end',actor:'member1',kind:'switch',timeMs:12000}];
 for(const cons of [0,6]){
  input.single_interfaces[0].character.constellation=cons;const p=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),hits=p.events.filter(e=>e.role===0);
  assert.equal(hits.filter(e=>e.index===0&&e.element==='Hydro').length,cons===6?6:0);assert.ok(hits.filter(e=>e.arkheStrike).every(e=>!e.application));
  const runtime=createElementalRuntime({actorIds:p.slots,enqueue:()=>{},emitReaction:()=>{throw Error('Hydro-only replay');}});
  for(const h of hits){runtime.prepare(h);runtime.after(h);}
  for(const index of [10,11,12]){const ids=new Set(hits.filter(h=>h.index===index).map(h=>h.eventId)),rows=runtime.applications.filter(a=>ids.has(a.eventId));assert.ok(rows.length>=2);assert.deepEqual(rows.map(r=>Number(r.enabled)),rows.map((_,i)=>index===12||i%2===0?1:0));}
 }
});
test('real Furina/Escoffier freeze grants Qiqi Cryo condition, respects boss setting and compiles once for reordered A/B/A candidates',async()=>{
 const input=freezeInput(),p=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),state=p.reactionAt({time:1,rootOrder:Infinity}).targets[0];
 assert.ok(state.Frozen>0);near(state.Cryo,0);assert.equal(state.cryoAffected,true);assert.ok(p.reactionFacts.some(e=>e.reactionType==='Frozen'));
 const teams=freezeTeams(input),native=teams.map((t,i)=>gatedFreezeEvaluator(api,{...input,testFirstBubble:i===1?0:1}).evaluate(t,true));
 const normal=native[0].hits.find(h=>h.role===2&&h.category==='normal');near(normal.analysis.bonus['七七·冰寒蚀骨·冰附着'],.15);
 const boss={...input,team_dps:{...input.team_dps,frozen:false}},bossHit=createTeamDpsEvaluator(api,boss).evaluate(teams[0],true).hits.find(h=>h.role===2&&h.category==='normal');near(bossHit.analysis.bonus['七七·冰寒蚀骨·冰附着']??0,0);
 const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(createTeamDpsEvaluator(api,permuted).evaluate(permuted.single_interfaces.map(p=>p.artifacts),true).expectation,native[0].expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedFreezeEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
});
