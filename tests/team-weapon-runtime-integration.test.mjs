import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {weaponRuntimeInput,weaponRuntimeTeams,weaponRuntimeCases} from './helpers/team-weapon-runtime-input.mjs';
import {gatedWeaponAxis} from './helpers/team-weapon-runtime-axis.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const evaluate=(input,execution={})=>createTeamDpsEvaluator(api,input,execution).evaluate(input.single_interfaces.map(p=>p.artifacts),true);
test('disabled first contact equals removal in native scoring across clocks and Echoes',()=>{
 for(const name of weaponRuntimeCases.filter(n=>n!=='runtime-horn')){
  const input=weaponRuntimeInput(name),disabled=evaluate(input,{compileRotation:gatedWeaponAxis(0)}),removed=evaluate(input,{compileRotation:gatedWeaponAxis(0,{remove:true})});
  for(const key of ['expectation','critical','non_critical','duration','fanfare'])near(disabled[key],removed[key]);
  const pick=o=>o.hits.filter(h=>h.expectation),a=pick(disabled),b=pick(removed);assert.deepEqual(a.map(h=>[h.eventId,h.time]),b.map(h=>[h.eventId,h.time]),name);a.forEach((h,i)=>near(h.expectation,b[i].expectation));
 }
});
test('later observed success conditions earlier unobserved damage and candidate trial existence',()=>{
 const input=weaponRuntimeInput('spine-posterior'),full=evaluate(input),disabled=evaluate(input,{compileRotation:gatedWeaponAxis(0)});
 assert.deepEqual(full.health_branches.map(b=>b.probability),[.75,.25]);assert.deepEqual(disabled.health_branches.map(b=>b.probability),[.5,.5]);
 const first=full.hits.find(h=>h.category==='equipment'&&h.time<1);
 assert.equal(first.branches.length,1);near(first.branches[0].analysis.event_probability,2/3);
 near(full.hits.reduce((n,h)=>n+h.expectation,0),full.expectation);
});
test('runtime Mona bubble reaches the shared weapon proc rules',()=>{
 const out=evaluate(weaponRuntimeInput('runtime-horn')),bubble=out.hits.find(h=>h.monaBubble),proc=out.hits.find(h=>h.label==='苍纹角杯·范围伤害');
 assert.ok(bubble&&proc);near(proc.time,bubble.time);near(proc.analysis.event_probability,1);
});
test('runtime proc candidates reset and all 24 member permutations preserve event results',()=>{
 const input=weaponRuntimeInput('spine-posterior'),teams=weaponRuntimeTeams(input),evaluator=createTeamDpsEvaluator(api,input),first=evaluator.evaluate(teams[0],true);
 evaluator.evaluate(teams[1]);assert.equal(evaluator.evaluate(teams[0]).expectation,first.expectation);
 const permute=xs=>xs.length?xs.flatMap((x,i)=>permute(xs.filter((_,j)=>i!==j)).map(p=>[x,...p])):[[]];
 for(const p of permute([0,1,2,3])){
  const changed=structuredClone(input);changed.single_interfaces=p.map(i=>input.single_interfaces[i]);changed.team_dps.axis.members=p.map(i=>input.team_dps.axis.members[i]);
  for(const key of ['initial_hp','weapon_conditions'])if(input.team_dps[key])changed.team_dps[key]=p.map(i=>input.team_dps[key][i]);
  const result=evaluate(changed);near(result.expectation,first.expectation);near(result.duration,first.duration);
  assert.deepEqual(result.hits.map(h=>h.eventId),first.hits.map(h=>h.eventId));
 }
});
