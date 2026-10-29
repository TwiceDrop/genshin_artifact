import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {equipmentFactsInput,equipmentFactCases,equipmentFactsAxis,equipmentFactsTeams} from './helpers/team-equipment-facts-input.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('real native scoring reads conditional energy, leaf ownership and decay like removed facts',()=>{
 for(const name of equipmentFactCases){
  const input=equipmentFactsInput(name),team=equipmentFactsTeams(input)[0];
  const run=remove=>createTeamDpsEvaluator(api,input,{compileRotation:equipmentFactsAxis(name,0,{remove})}).evaluate(team,true),a=run(false),b=run(true);
  near(a.expectation,b.expectation);assert.equal(a.hits.length,b.hits.length,name);a.hits.forEach((h,i)=>{assert.equal(h.eventId,b.hits[i].eventId,name);near(h.expectation,b.hits[i].expectation);});
  for(let r=0;r<4;r++)for(const field of ['atk','hp','elemental_mastery','recharge'])near(Object.values(a.panels[r][field]).reduce((a,b)=>a+b,0),Object.values(b.panels[r][field]).reduce((a,b)=>a+b,0));
 }
});
test('candidate-owned producer state resets across A-B-A evaluations',()=>{
 for(const name of ['Azurelight','leaf-generate','leaf-pickup']){
  const input=equipmentFactsInput(name),teams=equipmentFactsTeams(input),ev=createTeamDpsEvaluator(api,input,{compileRotation:equipmentFactsAxis(name,1)});
  const a=ev.evaluate(teams[0],true);ev.evaluate(teams[1],true);assert.deepEqual(ev.evaluate(teams[0],true),a);
 }
});

test('state-only Daybreak model does not bypass the existing unsupported native weapon boundary',()=>{
 const input=equipmentFactsInput('DaybreakChronicles');assert.throws(()=>createTeamDpsEvaluator(api,input).evaluate(equipmentFactsTeams(input)[0]),/暂未适配.*DaybreakChronicles/);
});
