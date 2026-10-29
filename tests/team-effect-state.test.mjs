import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {afterEvent} from '../beta-data/team-engine/event-order.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {equipmentEffects} from '../beta-data/team-engine/equipment-effects.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';

const event=(id,time,role=0,extra={})=>({eventId:id,time,role,rootOrder:0,order:0,kind:'hit',category:'normal',element:'Cryo',...extra});
const source=(definition,role=0)=>({definition,role,actorId:'actor'+role,key:definition.id+'/'+role});
const plan=(sources,schedule,settings={enemy_count:3,damage_scope:'all'})=>({sources,schedule,settings,rotation:{model:'actions',activeRole:()=>1}});
const value=(resolver,stage,e,read=()=>0)=>resolver.resolve(stage,1,e,read).reduce((sum,b)=>sum+(b.config.ExtensionEffect.values.ExtraDmgBase??b.config.ExtensionEffect.values.ATKFixed??b.config.ExtensionEffect.values.ATKPercentage??0),0);

test('scheduler orders child chains independently of insertion order and rejects travel into the past',()=>{
 for(const reverse of [false,true]){
  const roots=[event('a',1),event('b',2)];if(reverse)roots.reverse();
  const queue=createEventScheduler(roots),seen=[];
  for(const e of queue.events()){
   seen.push(e.eventId);
   if(e.eventId==='a')queue.enqueue({...afterEvent(e),eventId:'a-child'});
   if(e.eventId==='a-child')queue.enqueue({...afterEvent(e),eventId:'a-grandchild'});
  }
  assert.deepEqual(seen,['a','a-child','a-grandchild','b']);
 }
 const queue=createEventScheduler([event('now',2)]);
 for(const _ of queue.events())assert.throws(()=>queue.enqueue(event('past',1)),/早于/);
});

test('Tenacity activates after its hit, respects 0.5s refresh and exclusive expiry, and does not stack across providers',()=>{
 const hits=[event('first',0,0,{category:'skill'}),event('too-early',.49,0,{category:'skill'}),event('refresh',.5,0,{category:'skill'}),event('second-owner',1,2,{category:'skill'})];
 const p=plan([source(equipmentEffects[0]),source(equipmentEffects[0],2)],hits);
 const state=createEffectState(p,{math:scalarMath,enabled:()=>1,trace:true}),r=createEffectResolver(p,state,scalarMath);
 assert.equal(value(r,'base',hits[0]),0);
 assert.equal(value(r,'base',afterEvent(hits[0])),.2);
 assert.equal(value(r,'base',event('query',3.49,1)),.2);
 assert.equal(value(r,'base',event('query',4,1)),0);
 assert.equal(state.changes.filter(e=>e.kind==='activate').length,3);
 assert.equal(r.resolve('base',1,event('query',2,1))[0].config.ExtensionEffect.values.ShieldStrength,.3);
});

test('C1 reads live source HP only after healing, refreshes to five seconds, and queries are pure',()=>{
 const def=characterPackages.Vodyanitsa.effects({character:{constellation:1}})[0],p=plan([source(def)],[]),state=createEffectState(p,{math:scalarMath,enabled:()=>1}),r=createEffectResolver(p,state,scalarMath);
 const heal=event('heal',1,0,{kind:'heal'});state.publish(heal);
 assert.equal(value(r,'attack',heal,()=>50000),0);
 assert.equal(value(r,'attack',afterEvent(heal),()=>50000),400);
 assert.equal(value(r,'attack',event('query',5,1),()=>60000),480);
 assert.equal(value(r,'attack',event('query',6,1),()=>60000),0);
 state.publish(event('heal2',5,0,{kind:'heal'}));
 assert.equal(value(r,'attack',event('query',6,1),()=>50000),400);
 assert.equal(value(r,'attack',event('query',6,1),()=>50000),400);
});

test('C2 consumption is chronological per actual target, independent of scoring scope and display reads',()=>{
 const def=characterPackages.Escoffier.effects({character:{constellation:2}},{elements:[]})[0];
 const hits=[event('cast',0,0,{kind:'cast',action:'skill'}),event('own',.5,0),event('wrong-element',.7,1,{element:'Hydro'}),event('one',1,1),event('two',2,1),event('three',3,1)];
 for(const damage_scope of ['all','single']){
  const p=plan([source(def)],hits,{enemy_count:3,damage_scope}),state=createEffectState(p,{math:scalarMath,enabled:()=>1,trace:true}),r=createEffectResolver(p,state,scalarMath);
  assert.deepEqual(state.changes.filter(e=>e.kind==='consume').map(e=>[e.used,e.before,e.after]),[[3,5,2],[2,2,0]]);
  assert.equal(value(r,'damage',hits[3],()=>1000),2400);
  assert.equal(value(r,'damage',hits[4],()=>1000),damage_scope==='all'?1600:2400);
  assert.equal(value(r,'damage',hits[5],()=>1000),0);
  assert.equal(value(r,'damage',hits[3],()=>1000),2400);
 }
});

test('numeric enabled gates preserve activation, refresh and finite consumption in the same program',()=>{
 const def=characterPackages.Escoffier.effects({character:{constellation:2}},{elements:[]})[0],builder=createNumericProgram();
 const hits=[event('cast',0,0,{kind:'cast',action:'skill',enabled:builder.input(0)}),event('one',1,1,{enabled:builder.input(1)}),event('two',2,1)];
 const p=plan([source(def)],hits),state=createEffectState(p,{math:builder.math,enabled:()=>1});
 const outputs=hits.slice(1).map(e=>state.at(p.sources[0],e).usage.used);
 const program=builder.finish(outputs);
 assert.deepEqual(executeNumericProgram(program,[0,1]),[0,0]);
 assert.deepEqual(executeNumericProgram(program,[1,0]),[0,3]);
 assert.deepEqual(executeNumericProgram(program,[1,1]),[3,2]);
});
