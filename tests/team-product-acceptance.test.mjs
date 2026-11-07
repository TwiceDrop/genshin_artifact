import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {productAcceptanceCases} from './helpers/team-product-acceptance.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareTeamResults,compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('ten-role product cases keep real single/one-worker/two-worker ranking, disjoint inventory and lazy details',async()=>{
 const records=[];
 for(const input of productAcceptanceCases()){
  const artifacts=input.single_interfaces.flatMap(p=>p.artifacts),before=JSON.stringify({input,artifacts});
  const single=await nodeTeamDps(input,artifacts,{mode:'evaluate'}),one=await nodeTeamDps(input,artifacts,{threads:1}),two=await nodeTeamDps(input,artifacts,{threads:2});
  assert.equal(single.compile_ms,0);compareTeamResults(one,two);near(single.results[0].expectation,two.baseline.expectation);compareEventValues(single.results[0].eventTrace,two.baseline.eventTrace);
  assert.ok(single.results[0].character_damage.every(d=>d.expectation>0));assert.ok(two.results.length>1);
  const evaluator=createTeamDpsEvaluator(api,input),catalog=new Map(artifacts.map(a=>[a.id,a]));
  for(const [i,result]of two.results.entries()){
   const ids=result.artifacts.flatMap(b=>Object.values(b));assert.equal(new Set(ids).size,20);
   const builds=result.artifacts.map(b=>['flower','feather','sand','goblet','head'].map(k=>catalog.get(b[k]))),native=evaluator.evaluate(builds,true);near(result.expectation,native.expectation);
   if(i){assert.ok(two.results[i-1].expectation>=result.expectation);assert.equal(result.eventTrace,undefined);}
  }
  const ids=two.results[1].artifacts.map(b=>['flower','feather','sand','goblet','head'].map(k=>b[k]));
  const detail=await nodeTeamDps({...input,team_dps:{...input.team_dps,initial_ids:ids}},artifacts,{mode:'evaluate'});
  near(detail.results[0].expectation,two.results[1].expectation);compareEventValues(detail.results[0].eventTrace,nativeEventTrace(evaluator.evaluate(ids.map(b=>b.map(id=>catalog.get(id))),true)));
  assert.equal(JSON.stringify({input,artifacts}),before);
  records.push({names:input.single_interfaces.map(p=>p.character.name),input,artifacts,single,optimized:two});
 }
 if(process.env.TEAM_PRODUCT_CASES)fs.writeFileSync(process.env.TEAM_PRODUCT_CASES,JSON.stringify(records));
});
