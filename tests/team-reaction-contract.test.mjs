import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createReactionEmitter,reactionDamageEvent} from '../beta-data/team-engine/reaction-events.mjs';
import {eventKey,compareEventPosition} from '../beta-data/team-engine/event-order.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {equipmentReactionFacts} from '../beta-data/equipment-reaction-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createEquipmentHealingDamage} from '../beta-data/equipment-healing-damage-rules.mjs';
import {reactionInput,reactionTeams} from './helpers/team-onboarding-input.mjs';
import {installReactionFixture,reactionEvaluator,reactionModelId} from './helpers/team-reaction-definition.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`),actorIds=['a','b','c','d'];
const seed=(extra={})=>({kind:'hit',eventId:'seed',time:1,rootOrder:0,order:0,role:0,category:'normal',element:'Hydro',...extra});
const definition={reactionType:'Frozen',elements:['Hydro','Cryo'],sourceActorId:'b',triggerActorId:'c',ownerActorId:'d',targetIds:[2,0],contributors:[{actorId:'b'},{actorId:'c'}]};

test('reaction fact gates, explicit ownership and child damage remain in one scalar/numeric contract',()=>{
 const run=(m,values)=>{const records=[],queued=[],emit=createReactionEmitter({actorIds,math:m,observeHit:()=>values[2],record:e=>records.push(e),enqueue:e=>queued.push(e)}),cause=seed({enabled:values[0]}),fact=emit(cause,{...definition,enabled:values[1]}),damage=reactionDamageEvent(fact,{damageModel:'test',element:'Cryo'},{actorIds,math:m});
  assert.equal(fact.role,2);assert.equal(damage.role,3);assert.equal(damage.sourceActorId,'b');assert.equal(damage.triggerActorId,'c');assert.deepEqual(damage.contributors,definition.contributors);assert.ok(compareEventPosition(cause,fact)<0);assert.ok(compareEventPosition(fact,damage)<0);assert.equal(records.length,1);assert.equal(queued.length,1);
  assert.throws(()=>emit(cause,definition),/身份重复/);return [fact.enabled,damage.enabled];};
 const b=createNumericProgram(),program=b.finish(run(b.math,[b.input(0),b.input(1),b.input(2)]));
 for(let mask=0;mask<8;mask++){const values=[0,1,2].map(i=>(mask>>i)&1),n=values[0]*values[1]*values[2];assert.deepEqual(run(scalarMath,values),[n,n]);assert.deepEqual(executeNumericProgram(program,values),[n,n]);}
 let observations=0;const emit=createReactionEmitter({actorIds,record:()=>{},enqueue:()=>{},observeHit:()=>{observations++;return 1;}});emit(seed({enabled:0}),definition);assert.equal(observations,0);
 for(const reactionType of ['test.star','test.moon'])assert.equal(emit(seed(),{...definition,reactionType}).reactionType,reactionType);
});

test('resolved false facts suppress only their matching legacy assumption; reaction damage never reinfers a reaction',()=>{
 const cause=seed(),records=[],emit=createReactionEmitter({actorIds,record:e=>records.push(e),enqueue:()=>{}}),fact=emit(cause,{...definition,enabled:0});
 const old=equipmentReactionFacts([cause],['Hydro','Cryo']);assert.equal(old.filter(f=>f.reaction==='Frozen').length,1);
 const damage=reactionDamageEvent(fact,{damageModel:'test',element:'Cryo'},{actorIds}),facts=equipmentReactionFacts([cause,damage],['Hydro','Cryo'],[],records);
 assert.equal(facts.length,1);assert.equal(facts[0],fact);assert.equal(facts[0].enabled,0);assert.equal(facts[0].role,2);
 assert.deepEqual(equipmentReactionFacts([cause],['Hydro','Cryo'],[],[]),old);
});

test('same-time source parts deliver fact and damage children in causal order without consuming Song twice',()=>{
 const parts=[seed({part:0}),seed({part:1,order:1})],queue=createEventScheduler(parts),seen=[],emit=createReactionEmitter({actorIds,record:()=>{},enqueue:queue.enqueue});
 for(const e of queue.events()){
  seen.push([e.kind,e.part??0]);
  if(e.kind==='hit'&&!e.reactionDamage)emit(e,definition);
  else if(e.kind==='reaction')queue.enqueue(reactionDamageEvent(e,{damageModel:'test',element:'Cryo'},{actorIds}));
 }
 assert.deepEqual(seen.map(([kind])=>kind),['hit','reaction','hit','hit','reaction','hit']);
 const rotation={slots:actorIds,activeRole:()=>0},state=createEquipmentHealingDamage(Array(4).fill({}),rotation,()=>15000,(_r,s)=>s==='SongOfDaysPast',{enemy_count:1},scalarMath),pending=[];
 state.afterEvent({kind:'heal',time:0,role:0},e=>pending.push(e));state.afterEvent(pending[0],()=>{});
 const parent=seed({time:6,onField:true}),child={...parent,eventId:'different-hit',step:1};state.beforeHit(parent);state.beforeHit(child);
 assert.equal(state.usage.get(eventKey(parent)).before,5);assert.equal(state.usage.get(eventKey(child)).before,4);
 assert.equal(state.flatFor(parent,[0]),1200);assert.equal(state.flatFor(child,[0]),1200);
});

test('runtime reaction facts reach effects and shared damage with live source HP, candidate reset and zero decisions',()=>{
 const input=reactionInput(),teams=reactionTeams(input),restore=installReactionFixture();
 try{for(const [i,team]of teams.entries()){
  let rotation;const ev=reactionEvaluator(api,{...input,testReactionEnabled:i===0?1:0},{captureRotation:r=>{rotation=r;}}),result=ev.evaluate(team,true),facts=rotation.reactionFacts;
  assert.equal(facts.length,1);assert.equal(facts[0].enabled,i===0?1:0);
  const applied=result.effects.filter(e=>e.effectId==='test.reaction.buff');assert.equal(applied.length,i===0?1:0);
  const hits=result.hits.filter(h=>h.damageModel===reactionModelId);assert.equal(hits.length,i===0?1:0);
  if(hits.length){const hp=Object.values(result.panels[1].hp).reduce((a,b)=>a+b,0);near(hits[0].expectation,(105+hp*.001)*3);assert.equal(hits[0].role,0);assert.equal(hits[0].sourceActorId,'Furina');assert.equal(hits[0].triggerActorId,'Escoffier');}
  const reactions=equipmentReactionFacts(rotation.events,['Cryo','Hydro','Cryo','Hydro'],rotation.roots,facts);assert.equal(reactions.filter(e=>e.reaction==='Frozen').length,1);assert.deepEqual(ev.evaluate(team,true),result);
 }}finally{restore();}
});

test('preview and candidate runtime deliver equal causal child order for simultaneous source parts',()=>{
 const input=reactionInput('dual'),restore=installReactionFixture('dual');
 try{
  const preview=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),captured=[];
  reactionEvaluator(api,input,{captureCombatEvent:e=>captured.push(e)}).evaluate(reactionTeams(input)[0],true);
  const hits=rows=>rows.filter(e=>e.kind==='hit').map(e=>[e.eventId,e.part??0,e.parentEventId]);
  assert.deepEqual(hits(preview.events),hits(captured));assert.equal(preview.reactionFacts.length,2);
 }finally{restore();}
});

test('explicit reaction source, trigger and damage owner survive all 24 party permutations',()=>{
 const input=reactionInput(),restore=installReactionFixture(),builds=reactionTeams(input)[0];
 function* orders(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*orders(a.filter((_,j)=>j!==i),[...p,a[i]]);}
 try{const baseline=reactionEvaluator(api,input).evaluate(builds,true);
  for(const order of orders([0,1,2,3])){const x=structuredClone(input);x.single_interfaces=order.map(i=>input.single_interfaces[i]);x.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);x.team_dps.initial_ids=order.map(i=>input.team_dps.initial_ids[i]);x.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
   const result=reactionEvaluator(api,x).evaluate(order.map(i=>builds[i]),true),hit=result.hits.find(e=>e.damageModel===reactionModelId);near(result.expectation,baseline.expectation);assert.equal(x.team_dps.axis.members[hit.role].slot,'Skirk');assert.equal(hit.sourceActorId,'Furina');assert.equal(hit.triggerActorId,'Escoffier');
  }
 }finally{restore();}
});

test('explicit reaction gates and observed random parent procs match separate numeric Workers',async()=>{
 for(const mode of ['regular','dual','proc']){
  const input=reactionInput(mode),teams=reactionTeams(input),restore=installReactionFixture(mode);let native;
  try{native=teams.map((team,i)=>reactionEvaluator(api,{...input,testReactionEnabled:i===0?1:0}).evaluate(team,true));}finally{restore();}
  const worker=new Worker(new URL('./helpers/team-reaction-worker.mjs',import.meta.url));
  try{
   const output=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input,teams,mode});});assert.equal(output.error,undefined,output.error);
   for(let i=0;i<2;i++){near(output.results[i].expectation,native[i].expectation);compareEventValues(output.results[i].eventTrace,nativeEventTrace(native[i]));}
   assert.deepEqual(output.results[2],output.results[0]);
   if(mode==='proc'){const events=output.results[0].eventTrace.events.filter(e=>e.channel==='hits'&&e.states[0].value.damageModel===reactionModelId);assert.equal(events.length,1);near(events[0].probability,.5);}
  }finally{await worker.terminate();}
 }
});
