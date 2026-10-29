import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {escoffier} from '../beta-data/team-engine/characters/escoffier.mjs';
import {skirk} from '../beta-data/team-engine/characters/skirk.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';
import {equipmentRuntimeInput} from './helpers/team-equipment-runtime.mjs';
import {gatedHealthOutputs,gatedWeaponOutputs} from './helpers/team-combat-facts.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('disabled health events do not heal, drain, create bonds or alter fanfare in scalar and numeric execution',()=>{
 const builder=createNumericProgram(),program=builder.finish(gatedHealthOutputs(builder.math,builder.input(0)));
 for(const gate of [0,1]){
  const expected=gate?[[.6,.5,.5,.5,160],[.54,.45,.45,.45,181],[.44,.45,.45,.45,191],[.54,.45,.45,.45,201],[.59,.45,.45,.45,206],[.59,.45,.45,.45,206],[.59,.45,.45,.45,0]].flat():[...Array(4).fill([.5,.5,.5,.5,0]).flat(),...Array(3).fill([.8,.5,.5,.5,0]).flat()];
  const scalar=gatedHealthOutputs(scalarMath,gate),compiled=executeNumericProgram(program,[gate]);
  assert.equal(scalar.length,expected.length);scalar.forEach((v,i)=>near(v,expected[i]));compiled.forEach((v,i)=>near(v,expected[i]));
 }
});

test('disabled weapon trials cannot spend deterministic or probabilistic healing cooldowns',()=>{
 for(const weapon of ['PrizedIsshinBlade','TheBlackSword']){
  const builder=createNumericProgram(),program=builder.finish(gatedWeaponOutputs(builder.math,builder.input(0),weapon));
  for(const gate of [0,1]){
   const expected=weapon==='PrizedIsshinBlade'?(gate?[10,0]:[0,10]):(gate?[5,2.5]:[0,5]);
   const scalar=gatedWeaponOutputs(scalarMath,gate,weapon),compiled=executeNumericProgram(program,[gate]);
   scalar.forEach((v,i)=>near(v,expected[i]));compiled.forEach((v,i)=>near(v,expected[i]));
  }
 }
});

test('later same-tick and disabled hits cannot grant Escoffier shred or Skirk teammate stacks',()=>{
 const profiles=effectInput().single_interfaces;profiles[0].character.constellation=4;
 function output(m,gate){
  const rotation={model:'actions',events:[{role:2,category:'skill',element:'Cryo',time:1,rootOrder:120,order:1,enabled:gate}],covered:()=>false};
  const context={profiles,elements:['Cryo','Hydro','Cryo','Hydro'],rotation:()=>rotation,math:m},eRule=escoffier.create({...context,role:2}),sRule=skirk.create({...context,role:0});
  return [20,130].flatMap(rootOrder=>{const e={role:0,category:'normal',element:'Cryo',time:1,rootOrder,order:0,sevenPhase:true};return [eRule.damageBuffs(0,e,[]).reduce((v,b)=>m.add(v,b.config.ExtensionEffect.values.ResMinusBase),0),sRule.multiplier(e),sRule.attackBuffs(0,e).reduce((v,b)=>m.add(v,b.config.ExtensionEffect.values.ATKPercentage),0)];});
 }
 const builder=createNumericProgram(),program=builder.finish(output(builder.math,builder.input(0)));
 for(const gate of [0,1]){const expected=[0,1,0,...(gate?[.55,1.1,.1]:[0,1,0])];output(scalarMath,gate).forEach((v,i)=>near(v,expected[i]));executeNumericProgram(program,[gate]).forEach((v,i)=>near(v,expected[i]));}
});

test('native hit facts keep actual C2 and Song damage independent of selected scoring targets',()=>{
 for(const fixture of [effectInput,equipmentRuntimeInput.bind(null,'equipment-song-all')]){
  const x=fixture(),run=damage_scope=>{const input=structuredClone(x);input.team_dps.damage_scope=damage_scope;const facts=[];const evaluator=createTeamDpsEvaluator(api,input,{captureCombatEvent:e=>{if(e.damage)facts.push(e);}});return {out:evaluator.evaluate(input.single_interfaces.map(p=>p.artifacts),true),facts};};
  const all=run('all'),single=run('single');assert.equal(all.facts.length,single.facts.length);
  all.facts.forEach((e,i)=>{assert.equal(e.eventId,single.facts[i].eventId);for(const metric of ['expectation','critical','non_critical'])near(e.damage[metric],single.facts[i].damage[metric]);});
  assert.deepEqual(all.out.effects.filter(e=>e.kind==='consume'),single.out.effects.filter(e=>e.kind==='consume'));
  assert.ok(single.out.expectation<all.out.expectation);
  if(fixture===effectInput){const a=all.facts.find(e=>e.eventId==='n2/normal.2'),s=single.out.hits.find(e=>e.eventId==='n2/normal.2');assert.ok(a.damage.expectation<3*s.expectation);}
 }
});

test('same-time native queries preserve the before/after boundary and candidate rollback',()=>{
 const x=effectInput();x.single_interfaces[0].character.constellation=4;x.single_interfaces[2].character.constellation=0;
 // Switching to Escoffier ends Skirk's infusion; explicitly enter it again
 // so this synthetic boundary compares two Cryo contacts, not Physical DMG.
 // E lands 23 frames after its cast, between the two equal-time hit roots.
 x.team_dps.axis.timeline=[action('s-e','Skirk','skill',0),action('before','Skirk','normal.1',1000),action('e-e','Escoffier','skill',1000-23/60*1000),action('s-e2','Skirk','skill',900),action('after','Skirk','normal.1',1000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:2000}];
 const builds=x.single_interfaces.map(p=>p.artifacts),evaluator=createTeamDpsEvaluator(api,x),out=evaluator.evaluate(builds,true),before=out.hits.find(h=>h.eventId==='before/normal.1'),after=out.hits.find(h=>h.eventId==='after/normal.1');
 assert.equal(before.element,'Cryo');assert.equal(after.element,'Cryo');assert.equal(before.analysis.res_minus['爱可菲·灵感浸入调味'],undefined);assert.equal(after.analysis.res_minus['爱可菲·灵感浸入调味'],.55);assert.equal(before.analysis.atk['丝柯克·四命']??0,0);assert.ok(after.analysis.atk['丝柯克·四命']>0);
 const changed=structuredClone(builds);changed[0].forEach(a=>{a.id+=900000;a.sub_stats.push(['ATKPercentage',.3]);});assert.ok(evaluator.evaluate(changed).expectation>out.expectation);assert.equal(evaluator.evaluate(builds).expectation,out.expectation);
});
