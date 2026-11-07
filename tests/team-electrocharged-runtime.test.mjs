import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createReactionEmitter} from '../beta-data/team-engine/reaction-events.mjs';
import {elementalApplication as app} from '../beta-data/team-engine/ice-electro-reactions.mjs';
import {scalarMath as m} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
const hit=(id,time,role,element,gauge=1,extra={})=>({kind:'hit',eventId:id,time,role,rootOrder:20,element,application:app(gauge),...extra});
const sample=time=>({kind:'sample',eventId:'s/'+time,time,rootOrder:100});
function run(events,{math=m,targetCount=1,horizon=3,actorIds=['a','b','c','d'],zeroDamage=false,refillBetweenEarly=false}={}){
 const queue=createEventScheduler(events.map((e,order)=>({...e,order}))),facts=[],damage=[],samples=[],timers=[];
 const enqueue=e=>{if(e.time<=horizon)queue.enqueue(e);};
 const emitReaction=createReactionEmitter({actorIds,settings:{enemy_count:targetCount},math,enqueue,record:e=>facts.push(e)});
 const runtime=createElementalRuntime({actorIds,settings:{enemy_count:targetCount},math,enqueue,emitReaction});
 for(const e of queue.events()){
  runtime.prepare(e);if(e.kind==='sample')samples.push(runtime.view());if(e.kind==='timer')timers.push(e);
  if(refillBetweenEarly&&e.mechanic==='reaction.ec.early'&&e.time===4.75){
   enqueue(hit('same-time-water',e.time,2,'Hydro',1,{rootOrder:-Infinity,order:1,step:1}));
   enqueue(hit('same-time-electro',e.time,3,'Electro',1,{rootOrder:-Infinity,order:1,step:1.5}));
  }
  if(e.damageModel==='reaction.electroCharged'){damage.push({...e});if(zeroDamage)e.damage={expectation:0};}
  runtime.after(e);
 }
 const byActor=actorIds.map(id=>damage.filter(e=>e.ownerActorId===id).reduce((n,e)=>math.add(n,e.enabled??1),0));
 return {facts,damage:damage.filter(e=>typeof e.enabled==='object'||e.enabled),samples,timers,values:[...byActor,...samples.flatMap(s=>s.targets.flatMap(t=>[t.Hydro,t.Electro,t.Frozen]))]};
}
test('EC uses latest successful application for subsequent ticks, separate first snapshot, one-second clock and delayed gauge wane',()=>{
 const r=run([hit('h',0,0,'Hydro'),hit('e',.1,1,'Electro'),sample(.3),sample(.4),hit('h2',.8,2,'Hydro'),hit('zero',.9,3,'Electro',0),sample(1.4)]);
 assert.equal(r.facts.length,2);assert.deepEqual(r.damage.map(e=>e.ownerActorId),['b','c']);
 r.damage.forEach((e,i)=>{near(e.time,.1+10/60+i);near(e.reactionSnapshot.time,i?.8:.1);assert.equal(e.hitTriggers,false);assert.deepEqual(e.targetIds,[0]);});
 near(r.samples[0].targets[0].Hydro,.8-.3*.8/9.5);near(r.samples[1].targets[0].Hydro,.8-.4*.8/9.5-.4);
 near(r.samples[2].targets[0].Electro,0);assert.ok(r.samples[2].targets[0].Hydro>0);
 const reverse=run([hit('e',0,0,'Electro'),hit('h',.1,1,'Hydro',2),sample(.1)]);near(reverse.samples[0].targets[0].Hydro,1.6);
 const capped=run([hit('h',0,0,'Hydro'),hit('e',1,1,'Electro',4),sample(1)]);near(capped.samples[0].targets[0].Electro,.8-.8/9.5);
 // Damage reporting does not replace the actual eligibility/ICD gate.
 const zero=run([hit('h',0,0,'Hydro'),hit('e',0,1,'Electro'),sample(1.5)],{zeroDamage:true}),normal=run([hit('h',0,0,'Hydro'),hit('e',0,1,'Electro'),sample(1.5)]);
 assert.deepEqual(zero.samples,normal.samples);
 const disabled=run([hit('h',0,0,'Hydro'),hit('e',0,1,'Electro',1,{enabled:0}),sample(1.5)]);assert.equal(disabled.damage.length,0);near(disabled.samples[0].targets[0].Hydro,.8-1.5*.8/9.5);
});
test('EC secondary arcs hit wet targets once, share target damage ICD, take ownership and do not apply Electro or emit extra reactions',()=>{
 const r=run([hit('water',0,0,'Hydro',4),hit('e1',0,1,'Electro',4,{targetIds:[0]}),hit('e2',.3,2,'Electro',4,{targetIds:[1]}),sample(.5),sample(2.3)],{targetCount:3});
 assert.equal(r.facts.length,2);assert.equal(r.damage.filter(e=>e.time<.5).length,3);
 const next=r.damage.filter(e=>e.time>1&&e.time<1.3);assert.equal(next.length,3);assert.ok(next.every(e=>e.ownerActorId==='b'));
 assert.ok(r.damage.filter(e=>e.time>2).every(e=>e.ownerActorId==='b'));near(r.samples[0].targets[2].Electro,0);near(r.samples[0].targets[2].Hydro,3.2-.5*3.2/17);
 for(let id=0;id<3;id++){const rows=r.damage.filter(e=>e.targetIds[0]===id);rows.slice(1).forEach((e,i)=>assert.ok(e.time-rows[i].time>=.5-1e-9));}
});
test('EC natural depletion gives a final tick only after half a second, and replenishment restores the normal deadline',()=>{
 // Hydro 1U lasts 9.5s. The first wane removes 4.75s, leaving
 // expiry at 4.75s; application at 3.85 yields first damage at 4.0167.
 const events=[hit('water',0,0,'Hydro'),hit('electro',3.85,1,'Electro')];
 const early=run(events,{horizon:6});assert.equal(early.damage.length,2);near(early.damage[1].time,4.75);
 const late=run([events[0],hit('electro',4.2,1,'Electro')],{horizon:6});assert.equal(late.damage.length,1);
 const refill=run([...events,hit('refill',4.5,2,'Hydro'),hit('refill-e',4.5,3,'Electro')],{horizon:6});assert.equal(refill.damage.length,2);near(refill.damage[1].time,3.85+10/60+1);assert.equal(refill.damage[1].ownerActorId,'d');
});
test('candidate EC state and ownership compile once, preserve early ticks and remain invariant under A/B/A and party permutations',t=>{
 const events=gate=>[hit('water',0,0,'Hydro'),hit('electro',3.85,1,'Electro'),hit('refill',4.5,2,'Hydro',1,{enabled:gate}),hit('refill-e',4.5,3,'Electro',1,{enabled:gate}),sample(4.6),sample(5.5)];
 const graph=createNumericProgram(),math=createNativeGraphCompiler(graph,{funcs:{}}).math;
 const compiled=run(events(graph.input(0)),{math,horizon:5.5}),program=graph.finish(compiled.values);t.diagnostic('EC state graph: '+program.nodes.length+' nodes');
 for(const gate of [0,1,0]){
  const r=run(events(gate),{horizon:5.5});executeNumericProgram(program,[gate]).forEach((v,i)=>near(v,r.values[i]));
  const reorder=run(events(gate).map(e=>e.role===undefined?e:{...e,role:3-e.role}),{horizon:5.5,actorIds:['d','c','b','a']});
  assert.deepEqual(reorder.damage.map(e=>[e.time,e.ownerActorId]),r.damage.map(e=>[e.time,e.ownerActorId]));assert.deepEqual(reorder.samples,r.samples);
 }
});

test('candidate depletion ticks terminate their own clock without inventing subsequent periodic deadlines',()=>{
 const events=gate=>[hit('water',0,0,'Hydro'),hit('electro',3.85,1,'Electro'),hit('refill',4.5,2,'Hydro',1,{enabled:gate}),hit('refill-e',4.5,3,'Electro',1,{enabled:gate}),sample(6.3)];
 const b=createNumericProgram(),compiled=run(events(b.input(0)),{math:createNativeGraphCompiler(b,{funcs:{}}).math,horizon:6.3}),program=b.finish(compiled.values);
 const periodic=compiled.timers.filter(e=>e.mechanic==='reaction.ec.tick');assert.ok(periodic.length>0);
 for(const e of periodic)assert.ok([3.85,4.5].some(start=>Math.abs((e.time-start-10/60)-Math.round(e.time-start-10/60))<1e-8),`depletion must not start a periodic clock at ${e.time}`);
 for(const g of [0,1,0])executeNumericProgram(program,[g]).forEach((v,i)=>near(v,run(events(g),{horizon:6.3}).values[i]));
});

test('reapplication between the depletion timer and its hit preserves the replenished clock',()=>{
 const result=run([hit('water',0,0,'Hydro'),hit('electro',3.85,1,'Electro')],{horizon:6,refillBetweenEarly:true});
 assert.equal(result.damage.length,3);[3.85+10/60,4.75,5.75].forEach((time,i)=>near(result.damage[i].time,time));
});
