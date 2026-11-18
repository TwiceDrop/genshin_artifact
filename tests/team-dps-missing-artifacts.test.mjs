import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime.mjs';
import {sample,builds} from '../beta-tools/team-dps-full-audit.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps,optimizeTeamDpsParallel} from '../beta-data/team-dps-optimizer.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareTeamResults} from './helpers/team-dps-result-comparison.mjs';

function setup(){
 const input=sample(),artifacts=builds(input).flat();
 Object.assign(input.team_dps,{max_evaluations:1,result_count:1});
 for(const profile of input.single_interfaces)delete profile.artifacts;
 return {input,artifacts};
}

async function parallel(input,artifacts){
 const evaluator=createTeamDpsEvaluator(api,input),catalog=new Map(artifacts.map(a=>[a.id,a])),phases=[];
 const result=await optimizeTeamDpsParallel(api,input,artifacts,
  async teams=>teams.map(team=>evaluator.evaluate(team.map(ids=>ids.map(id=>catalog.get(id))))),4,
  ()=>{},createTeamDpsEvaluator,{evaluateDetail:(team,phase)=>{phases.push(phase);return evaluator.evaluate(team,true);}});
 assert.deepEqual(phases,result.baseline?['baseline','finalize']:['finalize']);
 return result;
}

function assertOptimized(result){
 assert.equal(result.baseline,null);
 assert.equal(result.results.length,1);
 assert.equal(result.evaluated_teams,1);
 assert.ok(Number.isFinite(result.results[0].expectation)&&result.results[0].expectation>0);
 const team=result.results[0].artifacts;
 assert.equal(team.length,4);
 for(const build of team)assert.equal(Object.keys(build).length,5);
 assert.equal(new Set(team.flatMap(Object.values)).size,20);
}

for(const [name,run] of [['serial',(input,artifacts)=>optimizeTeamDps(api,input,artifacts)],['parallel',parallel]]){
 test(`${name}: missing saved artifacts skips only the old-build comparison`,async()=>{
  for(const missing of ['one serialized','one undefined','all serialized']){
   const {input,artifacts}=setup();
   const presets=input.team_dps.initial_ids.map(artifactIds=>({artifactIds}));
   for(const r of missing==='all serialized'?[0,1,2,3]:[2])delete presets[r].artifactIds;
   const ids=presets.map(p=>p.artifactIds);
   input.team_dps.initial_ids=missing==='one undefined'?ids:JSON.parse(JSON.stringify(ids));
   const saved=structuredClone({input,artifacts}),control=structuredClone(input);
   control.team_dps.initial_ids=control.team_dps.initial_ids.map(ids=>ids??[]);
   const expected=await run(control,artifacts),actual=await run(input,artifacts);
   assertOptimized(actual);
   compareTeamResults(actual,expected);
   assert.deepEqual({input,artifacts},saved);
  }
 });
 test(`${name}: complete saved artifacts still produce an old-build comparison`,async()=>{
  const {input,artifacts}=setup(),saved=structuredClone({input,artifacts});
  const result=await run(input,artifacts);
  assert.ok(result.baseline.expectation>0);
  assert.equal(result.baseline.profiles.length,4);
  assert.equal(result.results.length,1);
  assert.deepEqual({input,artifacts},saved);
 });
}

test('CPU workers: presets without saved artifacts still produce optimized team details',async()=>{
 const {input,artifacts}=setup();
 input.team_dps.initial_ids[2]=null;
 const saved=structuredClone({input,artifacts}),control=structuredClone(input);
 control.team_dps.initial_ids[2]=[];
 const expected=await nodeTeamDps(control,artifacts,{threads:2});
 const actual=await nodeTeamDps(input,artifacts,{threads:2});
 assertOptimized(actual);
 assert.ok(actual.results[0].eventTrace.events.length>0);
 compareTeamResults(actual,expected);
 assert.deepEqual({input,artifacts},saved);
});
