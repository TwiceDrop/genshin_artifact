import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createReactionEmitter} from '../beta-data/team-engine/reaction-events.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {elementalApplication as application} from '../beta-data/team-engine/ice-electro-reactions.mjs';
const hit=(id,time,role,element,extra={})=>({kind:'hit',eventId:id,time,role,rootOrder:20,order:0,element,application:application(),...extra});
const probe=(time,id='probe/'+time)=>({kind:'sample',eventId:id,time,rootOrder:100,order:0});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function run(events,{math:m=scalarMath,stellarEnabled=false,targetCount=1,horizon=14,actorIds=['a','b','c','d']}={}){
 const queue=createEventScheduler(events),facts=[],damage=[],samples=[];
 const enqueue=e=>{if(e.time<=horizon)queue.enqueue(e);};
 const emitReaction=createReactionEmitter({actorIds,settings:{enemy_count:targetCount},math:m,enqueue,record:e=>facts.push(e)});
 const runtime=createElementalRuntime({actorIds,settings:{enemy_count:targetCount},math:m,stellarEnabled,enqueue,emitReaction});
 for(const e of queue.events()){
  runtime.prepare(e);
  if(e.kind==='sample')samples.push({id:e.eventId,...runtime.view()});
  if(e.damageModel==='reaction.superconduct')damage.push(e);
  runtime.after(e);
 }
 const values=samples.flatMap(s=>[s.fieldActive,s.radiance,s.count,s.coefficient,s.pending,...s.targets.flatMap(t=>[t.Cryo,t.Electro,t.physicalResMinus])]);
 values.push(facts.reduce((n,e)=>m.add(n,e.enabled??1),0),damage.reduce((n,e)=>m.add(n,m.mul(e.enabled??1,e.targetIds.length)),0));
 return {samples,facts,damage,values,applications:runtime.applications};
}
test('numeric aura preserves tax/decay and ICD hit counters without counting disabled candidate hits',()=>{
 const app=application(1,'shared',3,2.5);
 const events=gate=>[...['0','1','2','3','4','5'].map((id,i)=>hit(id,[0,.1,.2,.3,2.4,2.5][i],0,'Cryo',{application:app,enabled:i===0?gate:1})),probe(2.5)];
 const b=createNumericProgram(),compiled=run(events(b.input(0)),{math:createNativeGraphCompiler(b,{funcs:{}}).math});
 const output=compiled.applications.map(e=>e.enabled),program=b.finish([...output,...compiled.values]);
 for(const gate of [0,1,0]){
  const scalar=run(events(gate)),applied=scalar.applications.map(e=>Number(e.enabled));
  assert.deepEqual(applied,gate?[1,0,0,1,0,1]:[1,0,0,1,0]);
  // The disabled first contact may remain in the compiled static event list.
  const expected=gate?applied:[0,...applied];
  executeNumericProgram(program,[gate]).forEach((v,i)=>near(v,[...expected,...scalar.values][i]));
 }
 const aura=run([hit('strong',0,0,'Cryo',{application:application(2)}),hit('consume',0,1,'Electro',{order:1}),probe(0),hit('clear',1,1,'Electro'),hit('new',2,1,'Electro'),probe(11.5)]);
 near(aura.samples[0].targets[0].Cryo,.6);near(aura.samples[1].targets[0].Electro,0);
});
test('field settles before equal-time contacts, excludes its creation application and refreshes lifetime without moving the clock',()=>{
 const result=run([hit('electro',0,0,'Electro'),hit('create',1,1,'Cryo'),probe(1),hit('record-a',2,2,'Cryo'),hit('blocked-record',2.05,2,'Cryo'),hit('record-b',2.05,3,'Cryo'),hit('record-c',2.1,2,'Cryo'),hit('refresh',5,0,'Electro'),probe(5),probe(9),probe(11),probe(13)],{stellarEnabled:true});
 assert.deepEqual(result.samples.map(s=>[s.fieldActive,s.radiance,s.count,s.coefficient,s.pending]),[[true,true,0,1,0],[true,true,3,1.55,1],[true,true,1,1.45,0],[false,true,1,1.45,0],[false,false,0,1,0]]);
 assert.equal(result.damage.length,0);
});
test('candidate field creation and per-actor recording compile once and do not leak between A/B/A runs',()=>{
 const events=gate=>[hit('electro',0,0,'Electro',{enabled:gate}),hit('create',1,1,'Cryo'),hit('record',2,2,'Cryo'),probe(5),probe(7),probe(9)];
 const b=createNumericProgram(),compiled=run(events(b.input(0)),{stellarEnabled:true,targetCount:3,math:createNativeGraphCompiler(b,{funcs:{}}).math}),program=b.finish(compiled.values);
 for(const gate of [0,1,0,1]){
  const scalar=run(events(gate),{stellarEnabled:true,targetCount:3});
  executeNumericProgram(program,[gate]).forEach((v,i)=>near(v,Number(scalar.values[i])));
  assert.equal(scalar.samples[0].coefficient,gate?1.45:1);assert.equal(scalar.facts.length,gate?3:0);
 }
});
test('multi-target ordinary superconduct keeps owner/victim two-hit cap and stable actor identity under party permutations',()=>{
 const events=gate=>[hit('ice',0,0,'Cryo'),hit('electro',1,1,'Electro',{enabled:gate}),probe(1.1),probe(13)];
 const b=createNumericProgram(),compiled=run(events(b.input(0)),{math:createNativeGraphCompiler(b,{funcs:{}}).math,targetCount:3}),program=b.finish(compiled.values);
 for(const gate of [0,1,0]){
  const scalar=run(events(gate),{targetCount:3});executeNumericProgram(program,[gate]).forEach((v,i)=>near(v,Number(scalar.values[i])));
  assert.equal(scalar.damage.reduce((n,e)=>n+e.targetIds.length,0),gate?6:0);
  const permuted=run(events(gate).map(e=>e.role===undefined?e:{...e,role:3-e.role}),{targetCount:3,actorIds:['d','c','b','a']});
  assert.deepEqual(permuted.values,scalar.values);assert.deepEqual(permuted.damage.map(e=>e.ownerActorId),scalar.damage.map(e=>e.ownerActorId));
 }
});
