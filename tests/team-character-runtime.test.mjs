import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createFurinaHitRuntime} from '../beta-data/team-engine/characters/furina-hit-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {candidateCharacterInput,characterTeams,gatedCharacterAxis} from './helpers/team-character-runtime.mjs';

test('disabled contact does not spend C6 uses, heal or start cooldown; seventh hit selects actual infusion',()=>{
 const input=candidateCharacterInput('furina-gated'),team=characterTeams(input)[0];
 const run=gate=>createTeamDpsEvaluator(api,input,{compileRotation:gatedCharacterAxis(gate)}).evaluate(team,true);
 const yes=run(1),no=run(0),last=out=>out.hits.find(e=>e.eventId==='p6/plunge');
 assert.equal(last(yes).element,'Physical');assert.equal(last(no).element,'Hydro');
 assert.equal(yes.hits.filter(e=>e.eventId.endsWith('/escoffier.c6')).length,6);
 assert.equal(no.hits.filter(e=>e.eventId.endsWith('/escoffier.c6')).length,6);
 assert.equal(no.hits.some(e=>e.eventId==='p0/plunge'),false);
 assert.equal(yes.heals.find(e=>e.healing==='isshin').time,1);
 assert.equal(no.heals.find(e=>e.healing==='isshin').time,1.5);
 assert.equal(yes.heals.find(e=>e.healing==='furina_c6').time,2);
 assert.equal(no.heals.find(e=>e.healing==='furina_c6').time,2.5);
 const repeat=createTeamDpsEvaluator(api,input,{compileRotation:gatedCharacterAxis(1)});
 const baseline=repeat.evaluate(team,true);repeat.evaluate(characterTeams(input)[1],true);
 assert.deepEqual(repeat.evaluate(team,true),baseline);
});

test('Skirk Q pool consumes ten enabled hits and resets in each candidate',()=>{
 const input=candidateCharacterInput('skirk-pool'),team=characterTeams(input)[0];
 for(const gate of [1,0,1]){
  const out=createTeamDpsEvaluator(api,input,{compileRotation:gatedCharacterAxis(gate)}).evaluate(team,true);
  const normals=out.hits.filter(e=>e.category==='normal');
  assert.equal(normals.filter(e=>e.qBonus).length,10);
  assert.equal(normals.at(-1).qBonus,!gate);
 }
});

test('runtime-only contact is owner-prepared before C6 subscription and weapon healing',()=>{
 const input=candidateCharacterInput('furina-gated'),saved=characterPackages.Vodyanitsa.createCombat;
 input.team_dps.axis.timeline=input.team_dps.axis.timeline.filter(e=>!e.id.startsWith('p'));
 input.team_dps.axis.timeline.splice(2,0,{id:'active',kind:'switch',actor:'Furina',timeMs:500});
 try{
  characterPackages.Vodyanitsa.createCombat=({profiles,enqueue})=>({onEvent(e){
   if(e.id==='e2'&&e.kind==='cast')enqueue({kind:'hit',role:profiles.findIndex(p=>p.character.name==='Furina'),time:1,rootOrder:250,eventId:'synthetic-runtime',index:7,category:'plunge',arkhe:'ousia'});
  }});
  const out=createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true);
  const hit=out.hits.find(e=>e.eventId==='synthetic-runtime');
  assert.equal(hit.element,'Hydro');assert.equal(hit.furinaC6,true);
  assert.ok(out.hits.some(e=>e.eventId==='synthetic-runtime/escoffier.c6'));
  assert.ok(out.heals.some(e=>e.healing==='isshin'&&e.time===1));
  assert.ok(out.heals.some(e=>e.healing==='furina_c6'&&e.time===2));
 }finally{characterPackages.Vodyanitsa.createCombat=saved;}
});

function clock(m,gate){
 const events=[{kind:'cast',role:0,action:'skill',time:0,rootOrder:0,eventId:'e'},...Array.from({length:7},(_,i)=>({kind:'hit',role:0,category:'plunge',time:1+i*.5,rootOrder:100+i,arkhe:'ousia',eventId:'p'+i,enabled:i?1:gate}))];
 const queue=createEventScheduler(events),heals=[],hits=[];
 const plugin=createFurinaHitRuntime({role:0,profile:{character:{constellation:6}},math:m,enqueue:e=>{if(e.time<=19)queue.enqueue(e);},emitHealth:e=>heals.push(e)});
 for(const e of queue.events())if(e.kind==='hit'){
  const variants=plugin.prepareHit(e)||[e];hits.push(variants.reduce((v,h)=>m.add(v,m.mul(h.enabled??1,h.furinaC6?1:0)),0));
 }else plugin.onEvent(e);
 return [...hits,...Array.from({length:37},(_,i)=>heals.filter(e=>e.time===1+i*.5).reduce((n,e)=>m.add(n,e.enabled??1),0))];
}
test('conditional C6 cadence and exact duration use the same scalar and symbolic state machine',()=>{
 const builder=createNumericProgram(),m=createNativeGraphCompiler(builder,{funcs:{},table:[]}).math;
 const program=builder.finish(clock(m,builder.input(0)));
 for(const gate of [0,1,0])assert.deepEqual(executeNumericProgram(program,[gate]),clock(scalarMath,gate));
});
