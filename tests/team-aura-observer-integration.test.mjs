import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {auraObserverInput,auraObserverTeams,installAuraObserver,gatedAuraEvaluator} from './helpers/team-aura-observer-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('application and role-less aura facts traverse preview, health and compiled candidate combat without becoming contact damage',async()=>{
 const restore=installAuraObserver();try{
  const input=auraObserverInput(),teams=auraObserverTeams(input),plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),events=[];
  assert.equal(plan.applications.length,1);assert.ok(plan.events.every(e=>e.kind==='hit'));
  const native=teams.map((t,i)=>gatedAuraEvaluator(api,{...input,testIce:i===1?0:1},{captureCombatEvent:e=>{if(i===0)events.push(e);}}).evaluate(t,true));
  const followups=native[0].hits.filter(e=>e.label==='冻结结束订阅测试');assert.equal(followups.length,1);assert.deepEqual(followups[0].targetIds,[0]);
  let amount=2,decay=1/150,frames=0;while(amount>0){decay+=1/36000;amount=Math.max(0,amount-decay);frames++;}near(followups[0].time,(107+frames+1)/60);
  assert.equal(native[1].hits.filter(e=>e.label==='冻结结束订阅测试').length,0);assert.equal(events.filter(e=>e.kind==='application').length,1);assert.equal(events.filter(e=>e.kind==='aura_change').length,1);
  assert.ok(native[0].hits.every(e=>!e.eventId.includes('/application')));assert.ok(native[0].heals.every(e=>e.kind==='heal'));
  const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);
  near(gatedAuraEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedAuraEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
 }finally{restore();}
});
