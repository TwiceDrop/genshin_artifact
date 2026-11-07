import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {constrainedActionInput} from './helpers/team-action-configuration.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareNativeTeamResults} from './helpers/team-dps-result-comparison.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';

function* permutations(items){if(!items.length){yield [];return;}for(let i=0;i<items.length;i++)for(const rest of permutations(items.filter((_,j)=>j!==i)))yield [items[i],...rest];}
const slots=['flower','feather','sand','goblet','head'];
const key=result=>result.artifacts.flatMap(row=>slots.map(slot=>row[slot])).join(',');
const rank=value=>Number(value.toPrecision(12));

test('three effects preserve exact constrained search against independent enumeration and four scoring workers',async()=>{
 const input=constrainedActionInput(api);
 input.single_interfaces[2].character.constellation=2;
 input.single_interfaces[3].character.constellation=1;
 input.single_interfaces[3].artifacts.slice(0,4).forEach(a=>a.set_name='TenacityOfTheMillelith');
 const initial=input.single_interfaces.map(p=>p.artifacts),inventory=initial.flat(),saved=structuredClone({input,inventory});
 const evaluator=createTeamDpsEvaluator(api,input),oracle=[];let enumerated=0;
 for(const flowers of permutations(inventory.filter(a=>a.slot==='Flower')))for(const feathers of permutations(inventory.filter(a=>a.slot==='Feather'))){
  enumerated++;const team=initial.map((build,r)=>[flowers[r],feathers[r],...build.slice(2)]);
  if(team[2].filter(a=>a.set_name==='OceanHuedClam').length<4||sum(evaluator.constraints(2,team).recharge)<input.single_interfaces[2].constraint.recharge_min)continue;
  oracle.push({...evaluator.evaluate(team),key:team.flat().map(a=>a.id).join(',')});
 }
 assert.equal(enumerated,576);assert.equal(oracle.length,12);
 for(const objective of ['damage','dps'])for(const metric of ['expectation','critical','non_critical']){
  Object.assign(input.team_dps,{metric,objective});
  const value=row=>row[metric]/(objective==='dps'?row.duration:1);
  const expected=oracle.slice().sort((a,b)=>rank(value(b))-rank(value(a))||a.key.localeCompare(b.key)).slice(0,5);
  const actual=optimizeTeamDps(api,input,inventory);
  assert.equal(actual.search_complete,true);assert.equal(actual.legal_teams,12);
  assert.deepEqual(actual.results.map(key),expected.map(row=>row.key));
  actual.results.forEach((row,i)=>assert.ok(Math.abs(row[metric]-expected[i][metric])<=1e-10*Math.abs(expected[i][metric])));
 }
 const serial=optimizeTeamDps(api,input,inventory),parallel=await nodeTeamDps(input,inventory,{threads:4});
 compareNativeTeamResults(parallel,serial);
 input.team_dps.metric=saved.input.team_dps.metric;
 if(saved.input.team_dps.objective===undefined)delete input.team_dps.objective;else input.team_dps.objective=saved.input.team_dps.objective;
 assert.deepEqual({input,inventory},saved);
});
