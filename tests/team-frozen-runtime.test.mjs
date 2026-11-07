import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {advanceFrozenAura,emptyFrozenAura} from '../beta-data/team-engine/frozen-aura.mjs';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createReactionEmitter} from '../beta-data/team-engine/reaction-events.mjs';
import {scalarMath as m} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {elementalApplication as app} from '../beta-data/team-engine/ice-electro-reactions.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const hit=(id,time,role,element,gauge=1,extra={})=>({kind:'hit',eventId:id,time,role,rootOrder:20,order:0,element,application:app(gauge),...extra});
const sample=(id,time)=>({kind:'sample',eventId:id,time,rootOrder:100});
function run(events,{math=m,stellarEnabled=false,frozen=true,actorIds=['a','b','c','d'],targetCount=1,horizon=8,watchUntil}={}){
 const queue=createEventScheduler(events.map((e,order)=>({...e,order}))),facts=[],samples=[],damage=[],delivered=[];
 const enqueue=e=>{if(e.time<=horizon)queue.enqueue(e);},emitReaction=createReactionEmitter({actorIds,math,enqueue,record:e=>facts.push(e)}),runtime=createElementalRuntime({math,actorIds,stellarEnabled,settings:{frozen,enemy_count:targetCount},enqueue,emitReaction});
 if(watchUntil!==undefined)runtime.watchFrozen(Array.from({length:targetCount},(_,i)=>i),watchUntil);
 for(const e of queue.events()){runtime.prepare(e);delivered.push(e);if(e.kind==='sample')samples.push(runtime.view());if(e.reactionDamage)damage.push(e);runtime.after(e);}
 return {facts,samples,damage,delivered,runtime,values:samples.flatMap(s=>[s.coefficient,s.pending,...s.targets.flatMap(t=>[t.Cryo,t.Hydro,t.Electro,t.Frozen,math.choose(t.cryoAffected,1,0)])])};
}
test('Frozen batched frame integration matches independent per-frame decay, depletion and recovery in scalar/compiled paths',()=>{
 const reference=(state,frames)=>{state={...state};for(let i=0;i<frames;i++){if(state.amount>0){state.decay+=1/36000;state.amount=Math.max(0,state.amount-state.decay);}else state.decay=Math.max(1/150,state.decay-2/36000);}return state;};
 const graph=createNumericProgram(),symbolic=advanceFrozenAura({amount:graph.input(0),decay:1/150},600,graph.math),program=graph.finish([symbolic.amount,symbolic.decay]);
 for(const amount of [0,1.6,3.2,8]){
  const state={...emptyFrozenAura(),amount},expected=reference(state,600),actual=advanceFrozenAura(state,600,m),split=advanceFrozenAura(advanceFrozenAura(state,173,m),427,m);
  for(const key of ['amount','decay']){near(actual[key],expected[key]);near(split[key],expected[key]);}
  const values=executeNumericProgram(program,[amount]);near(values[0],expected.amount);near(values[1],expected.decay);
 }
 const continued=advanceFrozenAura({amount:2,decay:.015},60,m);near(continued.amount,2-60*.015-60*61/72000);
});
test('Freeze consumes only the opposite aura, keeps hidden Hydro, refreshes by maximum and respects nonfreezable enemies',()=>{
 const forward=[hit('water',0,0,'Hydro',2),hit('ice',0,1,'Cryo'),sample('first',0),hit('ice2',.1,1,'Cryo'),sample('refresh',.1),sample('end',5)];
 const r=run(forward);near(r.samples[0].targets[0].Hydro,.6);near(r.samples[0].targets[0].Frozen,2);near(r.samples[0].targets[0].Cryo,0);assert.equal(r.samples[0].targets[0].cryoAffected,true);
 near(r.samples[1].targets[0].Frozen,2-6/150-6*7/72000);near(r.samples[1].targets[0].Hydro,0);assert.equal(r.samples[2].targets[0].frozen,false);
 const reverse=run([hit('ice',0,0,'Cryo'),hit('water',0,1,'Hydro',2),sample('s',0)]);near(reverse.samples[0].targets[0].Frozen,1.6);near(reverse.samples[0].targets[0].Hydro,0);
 const boss=run(forward,{frozen:false});assert.ok(boss.samples.every(s=>s.targets[0].Frozen===0));near(boss.samples[0].targets[0].Hydro,.6);assert.ok(boss.facts.some(e=>e.reactionType==='Frozen'));
});
test('Electro consumes underlying Cryo before Frozen once, preserves Hydro, and candidate Freeze does not leak across histories or party permutations',()=>{
 const under=run([hit('water',0,0,'Hydro'),hit('freeze',0,1,'Cryo'),hit('under-ice',.1,1,'Cryo'),hit('electro',.2,2,'Electro'),sample('s',.2)]).samples[0].targets[0];
 near(under.Cryo,0);near(under.Frozen,1.6-12/150-12*13/72000-(1-(.8-.1*.8/9.5)));
 const events=gate=>[hit('water',0,0,'Hydro',2),hit('freeze',0,1,'Cryo',1,{enabled:gate}),sample('before',.1),hit('electro',.2,2,'Electro'),sample('after',.2),hit('record',.3,3,'Hydro'),sample('settled',4.2)];
 for(const stellarEnabled of [false,true]){
  const b=createNumericProgram(),compiled=run(events(b.input(0)),{math:createNativeGraphCompiler(b,{funcs:{}}).math,stellarEnabled}),program=b.finish(compiled.values);
  for(const gate of [0,1,0]){
   const r=run(events(gate),{stellarEnabled}),values=executeNumericProgram(program,[gate]);values.forEach((v,i)=>near(v,r.values[i]));
   const reactions=r.facts.filter(e=>e.reactionType.includes('conduct')||e.reactionType==='StellarConduct');assert.equal(reactions.length,gate?1:0);
   if(gate){const before=r.samples[0].targets[0],after=r.samples[1].targets[0];near(after.Cryo,0);near(after.Hydro,before.Hydro-.1*(1.6/12));assert.ok(after.Frozen>0);assert.equal(r.samples[2].pending,0);}
   const permuted=run(events(gate).map(e=>e.role===undefined?e:{...e,role:3-e.role}),{stellarEnabled,actorIds:['d','c','b','a']});assert.deepEqual(permuted.values,r.values);
   const old=r.runtime.at({time:.1,rootOrder:Infinity});near(old.targets[0].Frozen,r.samples[0].targets[0].Frozen);
  }
 }
});

test('all six Hydro/Cryo/Electro orders preserve gauge priority and delivered fact order for scalar/compiled targets',()=>{
 const cases=[
  [['Hydro','Electro','Cryo'],[0,.6,0,.4],['ElectroCharged','conduct','Frozen']],
  [['Electro','Hydro','Cryo'],[0,.6,0,.4],['ElectroCharged','conduct','Frozen']],
  [['Hydro','Cryo','Electro'],[0,0,0,.6],['Frozen','conduct']],
  [['Cryo','Hydro','Electro'],[0,0,0,.6],['Frozen','conduct']],
  [['Electro','Cryo','Hydro'],[0,.8,0,0],['conduct']],
  [['Cryo','Electro','Hydro'],[0,.8,0,0],['conduct']],
 ];
 for(const stellarEnabled of [false,true])for(const [elements,expected,types]of cases){
  const conduct=stellarEnabled?'StellarConduct':'Superconduct',events=gate=>[
   ...elements.map((element,i)=>hit('hit'+i,0,['Hydro','Cryo','Electro'].indexOf(element),element,1,element==='Hydro'?{enabled:gate,targetIds:[0]}:{})),sample('end',0),
  ];
  const options={stellarEnabled,targetCount:2,horizon:0},b=createNumericProgram(),math=createNativeGraphCompiler(b,{funcs:{}}).math;
  const compiled=run(events(b.input(0)),{...options,math}),compiledFacts=compiled.delivered.filter(e=>e.kind==='reaction'),program=b.finish([...compiled.values,...compiledFacts.map(e=>e.enabled)]);
  for(const gate of [1,0,1]){
   const result=run(events(gate),options),state=result.samples[0].targets[0];
   [state.Cryo,state.Hydro,state.Electro,state.Frozen].forEach((v,i)=>near(v,gate?expected[i]:0));
   const other=result.samples[0].targets[1];[other.Cryo,other.Hydro,other.Electro,other.Frozen].forEach(v=>near(v,0));
   const delivered=result.delivered.filter(e=>e.kind==='reaction'&&e.enabled&&e.targetIds.includes(0));
   assert.deepEqual(delivered.map(e=>e.reactionType),gate?types.map(t=>t==='conduct'?conduct:t):[conduct]);
   const trigger=delivered.find(e=>e.reactionType===conduct);assert.equal(trigger.ownerActorId,elements.indexOf('Cryo')>elements.indexOf('Electro')?'b':'c');
   const values=executeNumericProgram(program,[gate]);values.slice(0,compiled.values.length).forEach((v,i)=>near(v,result.values[i]));
   const identity=e=>[e.reactionType,e.ownerActorId,e.targetIds,e.step];
   assert.deepEqual(compiledFacts.filter((_,i)=>values[compiled.values.length+i]).map(identity),result.delivered.filter(e=>e.kind==='reaction'&&e.enabled).map(identity));
   const permuted=run(events(gate).map(e=>e.role===undefined?e:{...e,role:3-e.role}),{...options,actorIds:['d','c','b','a']});
   assert.deepEqual(permuted.values,result.values);
   assert.deepEqual(permuted.delivered.filter(e=>e.kind==='reaction').map(e=>[e.reactionType,e.ownerActorId,e.targetIds]),result.delivered.filter(e=>e.kind==='reaction').map(e=>[e.reactionType,e.ownerActorId,e.targetIds]));
  }
 }
 // A stronger Electro aura consumes all triggering Cryo: no invented Freeze.
 const strong=run([hit('h',0,0,'Hydro',4),hit('e',0,2,'Electro',2),hit('c',0,1,'Cryo'),sample('s',0)],{horizon:0});
 near(strong.samples[0].targets[0].Electro,.6);near(strong.samples[0].targets[0].Hydro,3.2);near(strong.samples[0].targets[0].Frozen,0);
 // Nonfreezable enemies still consume Hydro/Cryo but do not retain Frozen
 // shielding: residual Hydro can therefore react with the following Electro.
 for(const hydro of [1,2]){
  const boss=run([hit('h',0,0,'Hydro',hydro),hit('c',0,1,'Cryo'),hit('e',0,2,'Electro'),sample('s',0)],{horizon:0,frozen:false});
  assert.deepEqual(boss.facts.map(e=>e.reactionType),hydro===1?['Frozen']:['Frozen','ElectroCharged']);
  near(boss.samples[0].targets[0].Frozen,0);near(boss.samples[0].targets[0].Hydro,hydro===1?0:.6);near(boss.samples[0].targets[0].Electro,hydro===1?.8:.6);
 }
});

test('same-time heavy/light Electro and natural thaw keep target-local reaction and expiration boundaries',()=>{
 const events=[hit('h',0,0,'Hydro',2),hit('c',0,1,'Cryo'),hit('heavy',.1,2,'Electro',1,{blunt:true,targetIds:[0]}),hit('light',.1,2,'Electro',1,{targetIds:[1]}),sample('s',.1)];
 const result=run(events,{targetCount:2,horizon:.1,watchUntil:1}),[heavy,light]=result.samples[0].targets;
 near(heavy.Frozen,0);near(heavy.Hydro,.6-.1*1.6/12);near(heavy.Electro,heavy.Hydro);
 near(light.Frozen,2-6/150-6*7/72000-1);near(light.Hydro,heavy.Hydro);near(light.Electro,0);
 assert.deepEqual(result.delivered.filter(e=>e.kind==='reaction'&&e.time===.1).map(e=>[e.reactionType,e.targetIds]),[['Shatter',[0]],['ElectroCharged',[0]],['Superconduct',[1]]]);
 assert.deepEqual(result.delivered.filter(e=>e.kind==='aura_change').map(e=>[e.reason,e.targetIds]),[['shatter',[0]]]);
 let amount=1.6,decay=1/150,frames=0;while(amount>0){frames++;decay+=1/36000;amount=Math.max(0,amount-decay);}
 const expiry=frames/60;
 for(const delta of [-1,0]){
  const time=(frames+delta)/60,r=run([hit('h',0,0,'Hydro'),hit('c',0,1,'Cryo'),hit('electro',time,2,'Electro'),sample('s',time)],{horizon:expiry,watchUntil:expiry});
  assert.equal(r.facts.filter(e=>e.reactionType==='Superconduct').length,delta<0?1:0);
  near(r.samples[0].targets[0].Frozen,0);near(r.samples[0].targets[0].Electro,delta<0?0:.8);
  const notice=r.delivered.findIndex(e=>e.kind==='aura_change'),contact=r.delivered.findIndex(e=>e.eventId==='electro');
  assert.ok(delta<0?notice>contact:notice<contact);
 }
});
