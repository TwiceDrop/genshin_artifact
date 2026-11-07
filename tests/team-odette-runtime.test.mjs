import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {odetteInput,odetteTeams,gatedOdetteEvaluator,odetteAction as a,odetteEnd as end} from './helpers/team-odette-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {actionTime} from '../beta-data/team-engine/rule-utils.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=input=>createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true);
test('Odette E/EE and Q use separate commands, real finite endings and per-part native ratios',()=>{
 for(const [cons,rows,duration,indices]of [[0,[a('e',0,'skill',1)],actionTime(1+23/60),[10]],[0,[a('q',0,'burst',1)],3.4,[20,20,20,21]],[4,[a('e',0,'skill',0),a('ee',0,'skill',1)],actionTime(1+67/60),[10,11,11,11,12,22,24]]]){
  const input=odetteInput(cons,rows);input.team_dps.enemy_count=1;const plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),native=run(input);
  near(plan.duration,duration);near(native.duration,duration);assert.deepEqual(plan.events.filter(e=>e.role===0).map(e=>e.index),indices);assert.deepEqual(native.hits.filter(e=>e.role===0).map(e=>e.index),indices);
  const preview=createSkillMultiplierPreview(api,input.team_dps.axis,input.single_interfaces.map(p=>p.character));near(preview.duration,duration);
  if(indices.includes(20)){const hits=preview.roles[0].hits.filter(h=>h.label.startsWith('青鸟终曲·第'));assert.equal(hits.length,3);hits.forEach(h=>near(h.base.atk,5.9496/3));}
 }
 const input=odetteInput(0,[a('e',0,'skill',0),a('boundary',0,'skill',6)]);assert.equal(run(input).hits.filter(e=>e.odetteFinal).length,0);
});
test('Splendor transfers on its own clock, C6 keeps self stacks, Q refresh preserves them and a new E resets them',()=>{
 for(const cons of [0,1,6]){
  const input=odetteInput(cons,[a('e',0,'skill',0),{id:'away',kind:'switch',actor:'member2',timeMs:500},a('q',0,'burst',2.5),{id:'away2',kind:'switch',actor:'member2',timeMs:2600},a('new-e',0,'skill',9),end(31)]),plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);
  const state=time=>plan.characterState(0,{time,rootOrder:Infinity}),first=state(1.4);assert.equal(first.others,cons>=1?2:1);assert.equal(first.self,cons===6?6:cons>=1?4:3);
  assert.equal(state(2.6).others,cons>=1?4:2);assert.equal(state(9.4).others,0);assert.equal(state(9.4).self,cons>=1?6:4);assert.equal(Number(state(30).live),0);
 }
});
test('Odette native star talent, independent amplification, live source blessing and cross-role C2/C6 follow independent arithmetic',()=>{
 const input=odetteInput(0,[a('a',1,'skill',0),a('e',0,'skill',.5),a('ee',0,'skill',1.2),end(3)]);input.team_dps.enemy_count=1;
 const native=run(input),hit=native.hits.find(e=>e.index===12&&e.role===0),atk=334.85+185;
 near(hit.non_critical,atk*5.5037*(1+atk*.00007)*(1+.6)*.9);
 const boosted=structuredClone(input);boosted.single_interfaces[0].artifacts[0].sub_stats=[['ATKFixed',2500]];
 const next=run(boosted).hits.find(e=>e.index===12&&e.role===0),high=atk+2500;
 near(next.non_critical,high*5.5037*1.14*1.6*1.3*.9);
 const six=odetteInput(6,[a('a',1,'skill',0),a('e',0,'skill',.5),a('ee',0,'skill',1.2),a('q',2,'burst',2.4),end(4)]),sixResult=run(six),other=sixResult.hits.find(e=>e.role===2&&e.index===19);
 assert.ok(other);assert.ok(other.analysis.elevate_stellarconduct_compose['奥黛塔·华彩']===.25);
 near(other.res,1.05);assert.ok(sixResult.hits.some(e=>e.index===24&&e.category==='other'));
});
test('candidate-dependent recast, native ATK cap, real stellar enabler and joint health compile once for A/B/A and actor permutations',async()=>{
 const input=odetteInput(),teams=odetteTeams(input),native=teams.map((t,i)=>gatedOdetteEvaluator(api,{...input,testFirstEnabled:i===1?0:1}).evaluate(t,true));
 assert.ok(native[0].hits.some(e=>e.odetteFinal&&e.time<3));assert.ok(!native[1].hits.some(e=>e.odetteFinal&&e.time<3));
 const order=[2,0,3,1],other=structuredClone(input);other.single_interfaces=order.map(i=>input.single_interfaces[i]);other.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);other.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);near(run(other).expectation,run(input).expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedOdetteEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
 try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
});
