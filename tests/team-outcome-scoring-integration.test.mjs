import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {weaponRuntimeInput,weaponRuntimeTeams} from './helpers/team-weapon-runtime-input.mjs';
import {gatedWeaponAxis} from './helpers/team-weapon-runtime-axis.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('each observed outcome executes once, with no posterior combat replay',()=>{
 const input=weaponRuntimeInput('spine-posterior'),original=characterPackages.Mona.createCombat;let runs=0;
 try{
  characterPackages.Mona.createCombat=ctx=>{runs++;return original(ctx);};
  const evaluator=createTeamDpsEvaluator(api,input),out=evaluator.evaluate(input.single_interfaces.map(p=>p.artifacts),true);
  assert.equal(runs,3);assert.deepEqual(out.health_branches.map(b=>b.probability),[.75,.25]);
  const first=out.hits.find(h=>h.category==='equipment'&&h.time<1);assert.equal(first.branches.length,1);near(first.branches[0].analysis.event_probability,2/3);
 }finally{characterPackages.Mona.createCombat=original;}
});
test('reported events contain finalized posterior damage and remain isolated across candidates',()=>{
 const input=weaponRuntimeInput('spine-posterior'),teams=weaponRuntimeTeams(input),captured=[];
 const evaluator=createTeamDpsEvaluator(api,input,{captureCombatEvent:e=>captured.push(e)}),first=evaluator.evaluate(teams[0],true);
 const early=captured.filter(e=>e.category==='equipment'&&e.time<1);assert.equal(early.length,1);near(early[0].probability,2/3);
 near(early[0].damage.expectation*early[0].outcome.probability,first.hits.find(h=>h.category==='equipment'&&h.time<1).expectation);
 evaluator.evaluate(teams[1]);assert.equal(evaluator.evaluate(teams[0]).expectation,first.expectation);
 const disabled=createTeamDpsEvaluator(api,input,{compileRotation:gatedWeaponAxis(0)}).evaluate(teams[0],true);
 assert.deepEqual(disabled.health_branches.map(b=>b.probability),[.5,.5]);
});
