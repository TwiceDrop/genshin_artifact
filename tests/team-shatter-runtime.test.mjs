import test from 'node:test';import assert from 'node:assert/strict';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createReactionEmitter} from '../beta-data/team-engine/reaction-events.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {elementalApplication as app} from '../beta-data/team-engine/ice-electro-reactions.mjs';
import {createQiqiRuntime} from '../beta-data/team-engine/characters/qiqi-runtime.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {equipmentReactionFacts} from '../beta-data/equipment-reaction-rules.mjs';
const hit=(id,time,role,element,gauge=1,more={})=>({kind:'hit',eventId:id,time,rootOrder:20,role,element,application:gauge?app(gauge):null,...more});
const sample=time=>({kind:'sample',eventId:'s/'+time,time,rootOrder:100});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function run(events,{math:m=scalarMath,targets=1,frozen=true,actorIds=['a','b','c','d']}={}){
 const queue=createEventScheduler(events.map((e,order)=>({...e,order}))),facts=[],damage=[],states=[],pre=[];
 const enqueue=e=>{if(e.time<=2)queue.enqueue(e);};
 const emitReaction=createReactionEmitter({actorIds,math:m,enqueue,record:e=>facts.push(e)}),runtime=createElementalRuntime({actorIds,math:m,settings:{enemy_count:targets,frozen},enqueue,emitReaction});
 for(const e of queue.events()){runtime.prepare(e);if(e.blunt)pre.push(runtime.at(e));if(e.kind==='sample')states.push(runtime.view());if(e.damageModel==='reaction.shatter')damage.push(e);runtime.after(e);}
 return {facts,damage,states,pre,values:[damage.reduce((n,e)=>m.add(n,e.enabled??1),0),...states.flatMap(s=>s.targets.flatMap(t=>[t.Frozen,t.Cryo,t.Hydro]))]};
}
test('Shatter preserves pre-contact state, removes Frozen only, then applies the heavy hit element independently of application ICD',()=>{
 const events=[hit('h',0,0,'Hydro',2),hit('c',0,1,'Cryo'),hit('heavy',.1,2,'Cryo',1,{blunt:true}),sample(.1)];
 const r=run(events);assert.ok(r.pre[0].targets[0].Frozen>0);assert.equal(r.damage.length,1);near(r.states[0].targets[0].Frozen,2*(.6-.1*1.6/12));near(r.states[0].targets[0].Hydro,0);
 assert.deepEqual(r.facts.map(e=>e.reactionType),['Frozen','Shatter','Frozen']);assert.equal(r.facts[1].reactionTriggers,false);assert.equal(r.damage[0].hitTriggers,false);
 const physical=run([...events.slice(0,2),hit('p',.1,2,'Physical',0,{blunt:true}),sample(.1)]);near(physical.states[0].targets[0].Frozen,0);near(physical.states[0].targets[0].Hydro,.6-.1*1.6/12);
 const boss=run(events,{frozen:false});assert.equal(boss.damage.length,0);
 const icd=app(1,'cryo',3,2.5),blocked=run([hit('c',0,1,'Cryo',1,{application:icd}),hit('h',0,0,'Hydro'),hit('heavy',.1,1,'Cryo',1,{application:icd,blunt:true}),sample(.1)]);assert.equal(blocked.damage.length,1);near(blocked.states[0].targets[0].Cryo,0);
});
test('Shatter has no AoE expansion, retains gauge removal during damage cooldown, and gates both facts and damage by candidate contacts',()=>{
 const rows=[];for(const [i,time]of [.1,.2,.3,.5,.6,.7].entries())rows.push(hit('h'+i,time,0,'Hydro'),hit('c'+i,time,1,'Cryo'),hit('p'+i,time,2,'Physical',0,{blunt:true,targetIds:[2,0]}),sample(time));
 const r=run(rows,{targets:3});assert.equal(r.facts.filter(e=>e.reactionType==='Shatter').length,12);assert.deepEqual(r.damage.map(e=>[e.time,e.targetIds[0]]),[[.1,0],[.1,2],[.3,0],[.3,2],[.7,0],[.7,2]]);
 assert.ok(r.states.every(s=>s.targets[0].Frozen===0&&s.targets[2].Frozen===0&&s.targets[1].Frozen>0));
 const e=gate=>[hit('h',0,0,'Hydro'),hit('c',0,1,'Cryo'),hit('p',.1,2,'Physical',0,{blunt:true,enabled:gate}),sample(.2)];
 const b=createNumericProgram(),compiled=run(e(b.input(0)),{math:createNativeGraphCompiler(b,{funcs:{}}).math}),program=b.finish(compiled.values);
 for(const gate of [0,1,0]){const native=run(e(gate));executeNumericProgram(program,[gate]).forEach((v,i)=>near(v,native.values[i]));const changed=run(e(gate).map(h=>h.role===undefined?h:{...h,role:3-h.role}),{actorIds:['d','c','b','a']});assert.deepEqual(changed.values,native.values);assert.deepEqual(changed.damage.map(h=>h.ownerActorId),native.damage.map(h=>h.ownerActorId));}
});
test('Shatter facts remain available as facts but do not activate Qiqi A1, generic reaction effects or equipment reaction passives',()=>{
 const profiles=Array.from({length:4},()=>({character:{level:90,ascend:true,constellation:0}})),plugin=createQiqiRuntime({role:0,profile:profiles[0],profiles,activeRole:()=>1,reactions:{view:()=>({radiance:0})},enqueue:()=>{}});
 plugin.onEvent({kind:'cast',action:'skill',role:0,time:0,rootOrder:0});const shatter={kind:'reaction',reactionType:'Shatter',reaction:'Shatter',reactionTriggers:false,elements:['Cryo','Physical'],role:1,time:1,rootOrder:1,eventId:'shatter'};plugin.onEvent(shatter);
 assert.equal(plugin.stateAt({time:2,rootOrder:10}).incoming[1],false);plugin.onEvent({...shatter,reactionType:'Frozen',reactionTriggers:true,time:3});assert.equal(plugin.stateAt({time:4,rootOrder:10}).incoming[1],true);
 const source={key:'test',role:1,actorId:'b',definition:{id:'test',duration:10,stage:'attack',target:'team',reads:{},trigger:{kind:'reaction'}}},plan={sources:[source],rotation:{activeRole:()=>1},settings:{},schedule:[shatter]};
 const state=createEffectState(plan,{math:scalarMath,enabled:()=>1,trace:true});assert.equal(state.changes.length,0);assert.equal(equipmentReactionFacts([],['Cryo','Hydro'],[],[shatter]).length,0);
});
