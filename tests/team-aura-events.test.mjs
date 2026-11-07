import test from 'node:test';import assert from 'node:assert/strict';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createReactionEmitter} from '../beta-data/team-engine/reaction-events.mjs';
import {elementalApplication as application} from '../beta-data/team-engine/ice-electro-reactions.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {equipmentEffects} from '../beta-data/team-engine/equipment-effects.mjs';
import {actionTime} from '../beta-data/team-engine/rule-utils.mjs';
const hit=(id,time,element,targetIds,extra={})=>({kind:'hit',eventId:id,role:0,time,rootOrder:20,order:0,element,category:'skill',targetIds,application:application(),...extra});
const app=(id,time,element,targetIds,extra={})=>hit(id,time,element,targetIds,{kind:'application',...extra});
const frameLife=amount=>{let n=0,rate=1/150;while(amount>0){rate+=1/36000;amount=Math.max(0,amount-rate);n++;}return n;};
function run(events,{math=scalarMath,watch=true,horizon=6}={}){
 const queue=createEventScheduler(events),facts=[],expired=[],seen=[],timers=[];
 const enqueue=e=>{if(e.time<=horizon)queue.enqueue(e);},actorIds=['source'];
 const emitReaction=createReactionEmitter({actorIds,math,enqueue,record:e=>facts.push(e)}),runtime=createElementalRuntime({math,actorIds,settings:{enemy_count:2},enqueue,emitReaction});
 const source={definition:equipmentEffects[0],role:0,actorId:'source',key:'tenacity'},state=createEffectState({sources:[source],settings:{enemy_count:2},schedule:[],rotation:{model:'actions',activeRole:()=>0}},{math,enabled:()=>1,trace:true});
 for(const e of queue.events()){
  runtime.prepare(e);state.publish(e);runtime.after(e);
  if(watch&&e.eventId==='water')runtime.watchFrozen([0,1],horizon);
  if(e.kind==='aura_change')expired.push(e);
  if(e.mechanic==='aura.Frozen.expiry')timers.push(e);
  seen.push(e);
 }
 return {facts,expired,seen,timers,runtime,state};
}
const seed=gate=>[app('weak',0,'Cryo',[0],{enabled:gate}),app('strong',0,'Cryo',[1],{order:1,application:application(2)}),app('water',0,'Hydro',[0,1],{order:2,application:application(2)})];
test('non-damage applications use real ICD/reactions but never activate hit-trigger effects; natural Frozen expiry precedes equal-time hits',()=>{
 const a=actionTime(frameLife(1.6)/60),b=actionTime(frameLife(3.2)/60),r=run([...seed(1),hit('at-expiry',a,'Physical',[0],{application:undefined})]);
 assert.equal(r.facts.filter(e=>e.reactionType==='Frozen').length,2);
 assert.deepEqual(r.expired.map(e=>[e.targetIds[0],e.time,e.reason]),[[0,a,'decay'],[1,b,'decay']]);
 assert.equal(r.state.changes.filter(e=>e.kind==='activate').length,1);assert.equal(r.state.changes[0].activationId.startsWith('at-expiry/'),true);
 assert.ok(r.seen.indexOf(r.expired[0])<r.seen.findIndex(e=>e.eventId==='at-expiry'));assert.equal(r.timers.length,2);
 const unobserved=run(seed(1),{watch:false});assert.equal(unobserved.timers.length,0);assert.equal(unobserved.expired.length,0);
});
test('watched refresh, reaction consumption and shatter each publish one actual loss with independent target identity',()=>{
 const refreshed=run([...seed(1),app('cryo-refresh',1,'Cryo',[0],{application:application(2)}),app('water-refresh',1,'Hydro',[0],{order:1,application:application(2)})]);
 assert.equal(refreshed.expired.filter(e=>e.targetIds[0]===0).length,1);assert.ok(refreshed.expired.find(e=>e.targetIds[0]===0).time>frameLife(1.6)/60);
 const reactions=run([...seed(1),hit('electro',.1,'Electro',[0],{application:application(2)}),hit('blunt',.2,'Physical',[1],{application:undefined,blunt:true})]);
 assert.deepEqual(reactions.expired.map(e=>[e.targetIds[0],e.time,e.reason]),[[0,.1,'reaction'],[1,.2,'shatter']]);
});
test('candidate-dependent expiry slots are bounded and A/B/A values match independent scalar lifetimes',()=>{
 const builder=createNumericProgram(),math=createNativeGraphCompiler(builder,{funcs:{}}).math,r=run(seed(builder.input(0)),{math});
 const outputs=[0,1].flatMap(id=>{const rows=r.expired.filter(e=>e.targetIds[0]===id);return [rows.reduce((v,e)=>math.add(v,e.enabled),0),rows.reduce((v,e)=>math.add(v,math.mul(e.time,e.enabled)),0)];});
 const program=builder.finish(outputs);
 for(const gate of [1,0,1]){
  const scalar=run(seed(gate)),expected=[0,1].flatMap(id=>{const rows=scalar.expired.filter(e=>e.targetIds[0]===id);return [rows.length,rows.reduce((n,e)=>n+e.time,0)];});
  const actual=executeNumericProgram(program,[gate]);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10,`${v} != ${expected[i]}`));
 }
 assert.ok(r.timers.length<=6*60+1);assert.ok(r.timers.every(e=>e.time<=6));
});
