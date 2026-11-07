import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {followupInput,followupTeams,gatedFollowupEvaluator} from './helpers/team-followup-fixture.mjs';
import {qiqiInput,qiqiAction as a} from './helpers/team-qiqi-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),run=input=>createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true);
test('cross-owner finite hit determines final endpoint; exclusion removes only final time and summons never extend it',()=>{
 for(const endHit of ['include','exclude']){
  const input=followupInput(endHit),out=run(input),preview=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);near(out.duration,2.45);near(preview.duration,2.45);
  assert.equal(out.hits.some(e=>e.odetteC4),endHit==='include');assert.ok(out.hits.some(e=>e.role===2&&e.index===19));assert.equal(preview.events.some(e=>e.odetteC4),endHit==='include');
  assert.ok(out.hits.every(e=>endHit==='include'?e.time<=out.duration:e.time<out.duration));
 }
 const input=followupInput();input.team_dps.axis.timeline=input.team_dps.axis.timeline.slice(0,2);const out=run(input);near(out.duration,.883333333333);assert.ok(!out.hits.some(e=>e.odetteDance!==undefined));
 const coordinate=qiqiInput(0,[a('e',0,'skill',0),a('n',0,'normal.1',3)]);coordinate.single_interfaces[0].character.level=20;coordinate.single_interfaces[0].character.ascend=false;const co=run(coordinate);near(co.duration,3+1/60);assert.equal(co.hits.at(-1).index,16);
});
test('conditional tail has candidate-owned duration and identical native/compiled traces for include and exclude A/B/A',async()=>{
 for(const endHit of ['include','exclude']){
  const input=followupInput(endHit),teams=followupTeams(input),native=teams.map((team,i)=>gatedFollowupEvaluator(api,{...input,testSeedEnabled:i===1?0:1}).evaluate(team,true));near(native[0].duration,2.45);near(native[1].duration,2.383333333333);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedFollowupEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const rows=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;rows.forEach((r,i)=>{near(r.duration,native[i].duration);near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(rows[0],rows[2]);}finally{cpu.dispose();}
 }
});
test('excluded terminal random healing does not leak HP, fanfare or effects into compiled results',async()=>{
 const input=qiqiInput(4,[a('fq',2,'burst',0),a('n',0,'normal.1',3)]);input.team_dps.enemy_count=1;
 assert.ok(run(input).fanfare>0);input.team_dps.axis.endHit='exclude';const native=run(input);near(native.fanfare,0);assert.ok(native.hits.every(e=>e.time<3));assert.ok(native.heals.every(e=>e.time<3));
 const builds=input.single_interfaces.map(p=>p.artifacts),artifacts=builds.flat(),model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const out=(await cpu.score([builds.map(b=>b.map(a=>a.id))],{detail:true})).results[0];near(out.fanfare,0);near(out.expectation,native.expectation);compareEventValues(out.eventTrace,nativeEventTrace(native));}finally{cpu.dispose();}
});
