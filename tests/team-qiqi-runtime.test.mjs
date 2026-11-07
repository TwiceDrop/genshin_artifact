import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {qiqiInput,qiqiTeams,qiqiAction as a,qiqiEnd as end,enableQiqiFixtureStellar} from './helpers/team-qiqi-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),sum=x=>Object.values(x??{}).reduce((a,b)=>a+b,0);
test('Qiqi retains nine rings, four periodic heals, independent front-owner coordination and recast cancellation',()=>{
 const input=qiqiInput(0,[a('e',0,'skill',0),a('y',1,'normal.1',1),a('y2',1,'normal.1',1.1),a('a',3,'normal.1',1.7),end(16)]),plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);
 assert.equal(plan.events.filter(e=>e.qiqiRing).length,9);assert.equal(plan.heals.filter(e=>e.healing==='qiqi.periodic').length,4);
 const co=plan.events.filter(e=>e.index===16&&e.role===0);assert.ok(co.some(e=>e.time===.55));assert.equal(co.filter(e=>e.time>1&&e.time<2).length,2);assert.ok(co.every(e=>e.noCoordinate));
 input.team_dps.axis.timeline=[a('e',0,'skill',0),a('e2',0,'skill',2),end(3)];const again=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);assert.equal(again.events.filter(e=>e.qiqiRing).length,1);
 input.team_dps.axis.timeline=[a('terminal',0,'skill',0)];const terminal=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);near(terminal.duration,.55);assert.ok(terminal.events.some(e=>e.index===16));
});
test('Qiqi C6 uses actual target order, source live ATK, four shared charges and exact expiry',()=>{
 const original=characterPackages.YaeMiko.expand;
 characterPackages.YaeMiko.expand=ctx=>original({...ctx,hit:(a,t,...rest)=>ctx.hit(a,a.id.startsWith('star')?{...t,index:16,damageModel:'reaction.stellarConduct',application:null,targetIds:[1,0,2]}:t,...rest)});
 try{
  const input=qiqiInput(6,[a('q',0,'burst',0),a('star1',1,'normal.1',2),a('star2',1,'normal.1',3),a('q2',0,'burst',5),a('star-expiry',1,'normal.1',16.6),end(18)]);input.team_dps.enemy_count=3;
  const builds=input.single_interfaces.map(p=>p.artifacts),out=createTeamDpsEvaluator(api,input).evaluate(builds,true),uses=out.effects.filter(e=>e.effectId==='qiqi.c6'&&e.kind==='consume');
  assert.deepEqual(uses.map(e=>e.used),[3,1]);
  const hits=out.hits.filter(e=>e.eventId.startsWith('star')),atk=sum(api.CommonInterface.get_attribute(input.single_interfaces[0]).atk);
  near(hits[0].flat,6*atk);
  const single=structuredClone(input);single.team_dps.damage_scope='single';const one=createTeamDpsEvaluator(api,single).evaluate(builds,true);
  assert.deepEqual(one.effects.filter(e=>e.effectId==='qiqi.c6'&&e.kind==='consume').map(e=>e.used),[3,1]);
  const second=one.hits.filter(e=>e.eventId.startsWith('star2'));assert.ok(second.every(e=>e.flat===0));
 }finally{characterPackages.YaeMiko.expand=original;}
});
test('real Cryo/Electro hits retain Qiqi source snapshots, C2, recipient healing and CPU compiled candidate traces',async()=>{
 const restore=enableQiqiFixtureStellar();try{
  const input=qiqiInput(),teams=qiqiTeams(input),native=teams.map(t=>createTeamDpsEvaluator(api,input).evaluate(t,true));
  assert.ok(native[0].hits.some(e=>e.index===19&&e.role===0));assert.ok(native[0].effects.some(e=>e.effectId==='qiqi.c6'&&e.kind==='consume'));
  const rings=native[0].hits.filter(e=>e.qiqiRing),initial=native[0].hits.find(e=>e.qiqiInitial);rings.forEach(e=>near(e.atk,initial.atk));
  const other=native[0].hits.find(e=>e.eventId.startsWith('q/burst'));assert.ok(other.atk>initial.atk);
  const heals=native[0].heals.filter(e=>e.healing==='qiqi.periodic'),baseHeal=1.2528*472+991;
  near(heals[0].rawAmounts[0],baseHeal*1.222);near(heals[1].rawAmounts[0],heals[0].rawAmounts[0]);near(heals[2].rawAmounts[0],baseHeal*1.422);
  assert.ok(native[0].hits.some(e=>e.flat===6*708&&e.role===1));
  const order=[3,1,0,2],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);permuted.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
  near(createTeamDpsEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i]),true).expectation,native[0].expectation);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
 }finally{restore();}
});
test('A4 branches keep persistent talisman outcomes and joint nonlinear HP instead of average heals',async()=>{
 const input=qiqiInput(4,[a('qf',2,'burst',0),a('n1',0,'normal.1',1),a('n2',0,'normal.1',2),a('yn',1,'normal.1',3),end(4)]);input.team_dps.enemy_count=1;
 const builds=input.single_interfaces.map(p=>p.artifacts),outcomes=[];
 const native=createTeamDpsEvaluator(api,input,{captureRotation:r=>outcomes.push(r)}).evaluate(builds,true);
 assert.equal(outcomes.length,3);assert.deepEqual(outcomes.map(r=>r.outcome.probability).sort(),[.25,.25,.5]);assert.ok(native.fanfare>0);
 assert.deepEqual(outcomes.map(r=>r.heals.filter(h=>h.healing==='qiqi.talisman').map(h=>h.time)),[[],[2,3.4],[1,2,3.4]]);
 const model=compileTeamDpsExpression(api,input,builds.flat(),resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,builds.flat());
 try{const result=(await cpu.score([builds.map(b=>b.map(a=>a.id))],{detail:true})).results[0];near(result.expectation,native.expectation);compareEventValues(result.eventTrace,nativeEventTrace(native));}finally{cpu.dispose();}
});
