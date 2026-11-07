import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {originalCryoInput,originalCryoTeams,action as a,end} from './helpers/team-original-cryo-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createElementalRuntime} from '../beta-data/team-engine/elemental-runtime.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const plan=input=>compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);
function applications(hits){
 const runtime=createElementalRuntime({actorIds:['skirk','esco','yae','other'],enqueue:()=>{},emitReaction:()=>{throw Error('Cryo-only ICD probe must not react');}});
 for(const e of hits){runtime.prepare(e);runtime.after(e);}return runtime.applications;
}
test('Escoffier initial/periodic/C6 hits share six-hit 1.5s ICD; Arkhe never applies and Q is 2U',()=>{
 const input=originalCryoInput(false,[a('ee',1,'skill',0),a('n1',0,'normal.1',.5),a('n2',0,'normal.1',1.1),a('n3',0,'normal.1',2.6),end(3.6)]);
 input.single_interfaces[1].character.constellation=6;const p=plan(input),hits=p.events.filter(e=>e.role===1);
 assert.equal(hits.filter(e=>e.escoArkhe).length,1);assert.ok(hits.filter(e=>e.escoArkhe).every(e=>!e.application));
 assert.deepEqual(applications(hits).map(e=>[e.time,Number(e.enabled)]),[[23/60,1],[.5,0],[1.1,0],[2.55,1],[2.6,0],[3.533333333333,0]].map(([t,g])=>[Math.round(t*1e12)/1e12,g]));
 const q=plan(originalCryoInput(false,[a('eq',1,'burst',0),end(1)])).events.find(e=>e.role===1&&e.category==='burst');assert.equal(q.application.gauge,2);assert.equal(q.application.group,null);
});
test('Skirk C1 has a separate clock, C6 shares normal/burst clocks, physical normals and E do not apply',()=>{
 const input=originalCryoInput(false,[a('physical',0,'normal.1',0),a('e',0,'skill',.1),a('ca',0,'charged',.2,{absorbedRifts:3}),a('n3',0,'normal.3',.5),a('n5',0,'normal.5',1),end(2)]);
 input.single_interfaces[0].character.constellation=6;const p=plan(input),hits=p.events.filter(e=>e.role===0);
 assert.equal(hits.find(e=>e.eventId.startsWith('physical/')).application,undefined);assert.equal(hits.filter(e=>e.category==='skill').length,0);
 const gates=applications(hits);for(const [group,want]of [['skirk.charged',[1,0,0]],['skirk.c1',[1,0,0]],['skirk.normal',[1,0,0,1,0,0,1,0,0]]]){
  const ids=new Set(hits.filter(e=>e.application?.group===group).map(e=>e.eventId));assert.deepEqual(gates.filter(e=>ids.has(e.eventId)).map(e=>Number(e.enabled)),want);
 }
 const burst=originalCryoInput(false,[a('hold',0,'skill.hold',0,{absorbedRifts:3}),a('q',0,'burst',1),end(4)]);burst.single_interfaces[0].character.constellation=6;
 const qHits=plan(burst).events.filter(e=>e.category==='burst');assert.equal(qHits.length,9);assert.deepEqual(applications(qHits).map(e=>Number(e.enabled)),[1,0,0,1,0,0,1,0,0]);
});
test('real original/new Cryo-Electro parties derive reactions in preview, scalar and compiled A/B/A independent of member registration order',async()=>{
 for(const stellar of [false,true]){
  const input=originalCryoInput(stellar),p=plan(input),teams=originalCryoTeams(input);
  assert.ok(p.reactionFacts.length>0);assert.ok(p.reactionFacts.every(e=>e.reactionType===(stellar?'StellarConduct':'Superconduct')));
  const native=teams.map(t=>createTeamDpsEvaluator(api,input).evaluate(t,true));
  const ordinary=native[0].hits.filter(e=>e.damageModel==='reaction.superconduct');assert.equal(ordinary.length,p.events.filter(e=>e.damageModel==='reaction.superconduct').length);
  assert.equal(ordinary.length>0,!stellar);
  if(stellar)assert.ok(p.reactionAt({time:7,rootOrder:Infinity}).coefficient>1);
  const perm=[2,0,3,1],other=structuredClone(input);other.single_interfaces=perm.map(i=>input.single_interfaces[i]);other.team_dps.axis.members=perm.map(i=>input.team_dps.axis.members[i]);
  near(createTeamDpsEvaluator(api,other).evaluate(other.single_interfaces.map(p=>p.artifacts),true).expectation,native[0].expectation);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
 }
});
