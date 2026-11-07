import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {gated,oracle} from './helpers/skirk-sever-gates.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {normalizeTeamProfiles} from '../beta-data/team-engine/registry.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareEventValues,nativeEventTrace,compareTeamResults} from './helpers/team-dps-result-comparison.mjs';
import {skirkSeverInput,skirkSeverTeams} from './helpers/team-skirk-sever.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('Sever matches an independent queue for all 64 scalar and symbolic grant/contact/burst gates',()=>{
 const b=createNumericProgram(),program=b.finish(gated(b.math,Array.from({length:6},(_,i)=>b.input(i))).outputs);
 for(let mask=0;mask<64;mask++){
  const values=Array.from({length:6},(_,i)=>(mask>>i)&1),run=gated(scalarMath,values),expected=oracle(values);
  assert.deepEqual(run.outputs,expected);assert.deepEqual(executeNumericProgram(program,values),expected);
  assert.equal(new Set(run.hits.map(h=>h.id)).size,run.hits.length);
 }
 const laterPart=gated(scalarMath,[1,0,1,0,0,1]);assert.ok(laterPart.hits.some(h=>h.id==='n3/c6/from/1'));
});
test('actual disabled contacts retain Sever for a later command, with no pre-expanded C6 children',()=>{
 for(const missing of ['disabled','no-target']){
 const x=skirkSeverInput(),compile=(axis,profiles,settings,execution)=>{
  const plan=compileActionAxis(axis,profiles,settings,execution);
  if(execution.runtime)assert.ok(!plan.events.some(e=>e.c6),'C6 must not be spent or emitted in static expansion');
  return plan;
 };
 const original=characterPackages.Skirk.createCombat;
 characterPackages.Skirk.createCombat=context=>{const plugin=original(context);return {...plugin,prepareHit(e){if(e.eventId==='n3/normal.3'){if(missing==='disabled')e.enabled=0;else e.targetIds=[];}return plugin.prepareHit(e);}};};
 let out;try{out=createTeamDpsEvaluator(api,x,{compileRotation:compile}).evaluate(x.single_interfaces.map(p=>p.artifacts),true);}finally{characterPackages.Skirk.createCombat=original;}
 assert.deepEqual(out.hits.filter(h=>h.c6).map(h=>h.eventId),['n5/c6','n5/c6','n5/c6','n3b/c6','n3b/c6','n3b/c6','empty/c6','empty/c6','empty/c6']);
 assert.equal(out.resources.filter(e=>e.resource==='极恶技·斩'&&e.label==='普攻消耗斩层').length,3);
 }
});
test('per-layer expiry and burst consumption keep the existing exact-time boundary and emit resource history',async()=>{
 const x=skirkSeverInput('expiry'),native=createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true),rows=native.resources.filter(e=>e.resource==='极恶技·斩');
 assert.deepEqual(rows.map(e=>[e.time,e.before,e.after]),[[0,0,2],[5,2,3],[15,3,2],[15,2,0]]);
 assert.equal(native.hits.filter(e=>e.label==='虚境裂隙·六命爆发追加').length,2);
 const result=(await nodeTeamDps(x,x.single_interfaces.flatMap(p=>p.artifacts),{mode:'evaluate'})).results[0];near(result.expectation,native.expectation);compareEventValues(result.eventTrace,nativeEventTrace(native));
 const low=structuredClone(x);low.single_interfaces[0].character.level=20;low.single_interfaces[0].character.ascend=false;
 assert.ok(!createTeamDpsEvaluator(api,low).evaluate(low.single_interfaces.map(p=>p.artifacts),true).resources.some(e=>e.resource==='极恶技·斩'));
});
test('candidate resource history is isolated and all 24 party permutations retain hit and resource outcomes',()=>{
 const x=skirkSeverInput(),teams=skirkSeverTeams(x),ev=createTeamDpsEvaluator(api,x),first=ev.evaluate(teams[0],true),saved=structuredClone(first);
 ev.evaluate(teams[1],true);compareTeamResults(ev.evaluate(teams[0],true),saved);assert.deepEqual(first,saved);
 const plan=compileActionAxis(x.team_dps.axis,normalizeTeamProfiles(x.single_interfaces),x.team_dps,{runtime:true});assert.ok(!plan.resources.some(e=>e.resource==='极恶技·斩'));
 function* permute(xs,p=[]){if(!xs.length){yield p;return;}for(let i=0;i<xs.length;i++)yield*permute(xs.filter((_,j)=>i!==j),[...p,xs[i]]);}
 const project=(r,input)=>({hits:r.hits.map(h=>[h.eventId,h.time,h.part,input.single_interfaces[h.role].character.name,h.expectation]),resources:r.resources.map(h=>[h.eventId,h.time,input.single_interfaces[h.role].character.name,h.resource,h.before,h.after,h.amount])});
 for(const permutation of permute([0,1,2,3])){
  const y=structuredClone(x);y.single_interfaces=permutation.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=permutation.map(i=>x.team_dps.axis.members[i]);for(const key of ['weapon_conditions','initial_hp'])if(x.team_dps[key])y.team_dps[key]=permutation.map(i=>x.team_dps[key][i]);
  const out=createTeamDpsEvaluator(api,y).evaluate(y.single_interfaces.map(p=>p.artifacts),true);near(out.expectation,first.expectation);compareTeamResults(project(out,y),project(first,x));
 }
});
