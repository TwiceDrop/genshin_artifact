import test from 'node:test';import assert from 'node:assert/strict';
import {createCharacterCombat} from '../beta-data/team-engine/character-combat.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {eventKey,compareEvents} from '../beta-data/team-engine/event-order.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
test('incremental combat history preserves complete ordering and only rebuilds equipment for contacts',()=>{
 const hit=(id,time,extra={})=>({eventId:id,kind:'hit',role:0,time,rootOrder:0,order:0,index:0,category:'normal',element:'Hydro',...extra});
 const initial=[hit('initial0',0),hit('initial2',2),hit('initial4',4)],dynamic=[hit('d1',1,{runtimeHit:true}),hit('z2',2,{runtimeHit:true,order:1}),hit('tick',2,{runtimeHit:true,order:1,hitTriggers:false}),hit('a2',2,{runtimeHit:true,order:1}),hit('d5',5,{runtimeHit:true})];
 const plan={events:initial,slots:['v'],windows:{},runtimeRoles:[],combatCompletions:[],covered:()=>false,activeRole:()=>0},profiles=[{character:{name:'Vodyanitsa'}}];let refreshed=0;
 const combat=createCharacterCombat(profiles,plan,{math:scalarMath,settings:{},observeHit:()=>1,refresh:()=>{refreshed++;}});
 for(const e of createEventScheduler([...dynamic,...initial]).events()){
  const before=refreshed;combat.prepare(e,()=>{throw Error('no child expected');});
  assert.deepEqual(combat.rotation.events.map(eventKey),[...combat.rotation.events].sort(compareEvents).map(eventKey));
  if(e.eventId==='tick')assert.equal(refreshed,before);
 }
 assert.deepEqual(combat.rotation.events.map(eventKey),[...initial,...dynamic].sort(compareEvents).map(eventKey));assert.equal(refreshed,4);
});
