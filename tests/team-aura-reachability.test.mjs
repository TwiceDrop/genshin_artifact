import test from 'node:test';import assert from 'node:assert/strict';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createReactionEmitter} from '../beta-data/team-engine/reaction-events.mjs';
import {elementalApplication as application} from '../beta-data/team-engine/ice-electro-reactions.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
const hit=(id,time,role,element,enabled=1)=>({kind:'hit',eventId:id,time,role,rootOrder:20,order:0,element,enabled,application:application()});
function run(electro,hydro,{math:m=scalarMath}={}){
 const events=[hit('e0',0,0,'Electro',electro),hit('c1',.5,1,'Cryo'),...(hydro===undefined?[]:[hit('h',.7,2,'Hydro',hydro)]),hit('e1',1,0,'Electro',electro),hit('c2',1.5,1,'Cryo'),{kind:'sample',eventId:'end',time:2,rootOrder:100}],queue=createEventScheduler(events),facts=[],damage=[],timers=[],actorIds=['a','b','c','d'];
 const enqueue=e=>{if(e.time<=2)queue.enqueue(e);},emitReaction=createReactionEmitter({actorIds,math:m,enqueue,record:e=>facts.push(e)}),runtime=createElementalRuntime({math:m,actorIds,stellarEnabled:true,enqueue,emitReaction});
 for(const e of queue.events()){runtime.prepare(e);if(e.damageModel)damage.push(e);if(e.kind==='timer')timers.push(e);runtime.after(e);}
 const state=runtime.view(),values=[state.targets[0].Cryo,state.targets[0].Electro,state.targets[0].Hydro,state.targets[0].Frozen,state.radiance,...['Frozen','StellarConduct','ElectroCharged'].map(type=>facts.filter(e=>e.reactionType===type).reduce((n,e)=>m.add(n,e.enabled??1),0)),damage.reduce((n,e)=>m.add(n,e.enabled??1),0)];
 return {facts,damage,timers,values};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('symbolic Cryo/Electro applications cannot create Hydro, Frozen or electrocharged event slots',()=>{
 const b=createNumericProgram(),compiled=run(b.input(0),undefined,{math:createNativeGraphCompiler(b,{funcs:{}}).math}),p=b.finish(compiled.values);
 assert.equal(compiled.facts.filter(e=>['Frozen','ElectroCharged'].includes(e.reactionType)).length,0);
 assert.equal(compiled.damage.filter(e=>e.damageModel==='reaction.electroCharged').length,0);
 assert.equal(compiled.timers.filter(e=>e.mechanic.startsWith('reaction.ec.')).length,0);
 assert.equal(compiled.values[2],0);assert.equal(compiled.values[3],0);
 for(const g of [1,0,1])executeNumericProgram(p,[g]).forEach((v,i)=>near(v,Number(run(g).values[i])));
});
test('candidate Hydro remains reachable and preserves real frozen and electrocharged branches',()=>{
 const b=createNumericProgram(),compiled=run(b.input(0),b.input(1),{math:createNativeGraphCompiler(b,{funcs:{}}).math}),p=b.finish(compiled.values);
 assert.ok(compiled.facts.some(e=>e.reactionType==='Frozen'));assert.ok(compiled.facts.some(e=>e.reactionType==='ElectroCharged'));
 for(const e of [0,1])for(const h of [0,1])executeNumericProgram(p,[e,h]).forEach((v,i)=>near(v,Number(run(e,h).values[i])));
});
