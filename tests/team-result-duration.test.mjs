import test from 'node:test';
import assert from 'node:assert/strict';
import {compileTeamDpsProgram,createTeamProgramCodec} from '../beta-data/team-dps-program.mjs';
import {executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {optimizeTeamDps,optimizeTeamDpsParallel} from '../beta-data/team-dps-optimizer.mjs';
import {durationEvaluator,durationInput} from './helpers/team-result-duration.mjs';

const key=result=>result.artifacts.flatMap(row=>['flower','feather','sand','goblet','head'].map(slot=>row[slot])).join(',');
function* permutations(items){if(!items.length){yield [];return;}for(let i=0;i<items.length;i++)for(const rest of permutations(items.filter((_,j)=>j!==i)))yield [items[i],...rest];}
function compiled(input,inventory){
 const model=compileTeamDpsProgram(null,input,inventory,{libraries:[{}]},durationEvaluator),codec=createTeamProgramCodec(model,inventory);
 const score=teams=>{const encoded=codec.encode(teams);return codec.decode(teams.flatMap((_,i)=>executeNumericProgram(model.program,encoded.slice(i*4*model.stride,(i+1)*4*model.stride))),teams.length);};
 return {model,score};
}

test('one program carries each candidate duration and DPS through batch decoding',()=>{
 const input=durationInput(),builds=input.single_interfaces.map(p=>p.artifacts),inventory=builds.flat(),alternate=builds.map(b=>[...b]);
 [alternate[0][0],alternate[1][0]]=[alternate[1][0],alternate[0][0]];
 [alternate[0][1],alternate[1][1]]=[alternate[1][1],alternate[0][1]];
 const {model,score}=compiled(input,inventory),teams=[builds,alternate,builds];
 assert.equal(model.duration,undefined);assert.equal(model.program.outputs.length,87);
 const actual=score(teams.map(team=>team.map(build=>build.map(a=>a.id))));
 assert.deepEqual(actual.map(r=>[r.expectation,r.duration,r.dps]),[[90,5,18],[100,10,10],[90,5,18]]);
 teams.forEach((team,i)=>{const expected=durationEvaluator(null,input).evaluate(team);for(const key of ['expectation','critical','non_critical','duration','dps'])assert.equal(actual[i][key],expected[key]);});
});

test('damage and DPS searches match independent 576-team oracles for all three damage modes',async()=>{
 const input=durationInput(),initial=input.single_interfaces.map(p=>p.artifacts),inventory=initial.flat(),oracle=[];
 for(const flowers of permutations(inventory.filter(a=>a.slot==='Flower')))for(const feathers of permutations(inventory.filter(a=>a.slot==='Feather'))){
  const team=initial.map((build,r)=>[flowers[r],feathers[r],...build.slice(2)]),short=team[0].filter(a=>a.set_name==='OceanHuedClam').length>=4;
  oracle.push({key:team.flat().map(a=>a.id).join(','),duration:short?5:10,expectation:short?90:100,critical:short?100:160,non_critical:short?30:80});
 }
 assert.equal(oracle.length,576);
 const {score}=compiled(input,inventory);
 for(const objective of ['damage','dps'])for(const metric of ['expectation','critical','non_critical']){
  Object.assign(input.team_dps,{objective,metric});
  const value=row=>row[metric]/(objective==='dps'?row.duration:1),expected=oracle.slice().sort((a,b)=>value(b)-value(a)||a.key.localeCompare(b.key)).slice(0,5);
  const scalar=optimizeTeamDps(null,input,inventory,()=>{},durationEvaluator);
  const batch=await optimizeTeamDpsParallel(null,input,inventory,async teams=>score(teams),17,()=>{},durationEvaluator);
  for(const out of [scalar,batch]){
   assert.equal(out.objective,objective);assert.equal(out.search_complete,true);assert.equal(out.legal_teams,576);
   assert.deepEqual(out.results.map(key),expected.map(r=>r.key));
   assert.deepEqual(out.results.map(r=>[r[metric],r.duration]),expected.map(r=>[r[metric],r.duration]));
  }
 }
});
