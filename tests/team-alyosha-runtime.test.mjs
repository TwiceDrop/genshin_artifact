import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {alyoshaInput,alyoshaTeams} from './helpers/team-alyosha-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {createAlyoshaRuntime} from '../beta-data/team-engine/characters/alyosha-runtime.mjs';
import {createEventScheduler} from '../beta-data/team-engine/scheduler.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`),sum=x=>Object.values(x??{}).reduce((a,b)=>a+b,0);

test('Alyosha package preserves all field/bite damage clocks, C2 extension, recast cancellation and preview healing',()=>{
 for(const [cons,count]of [[0,7],[2,10]]){
  const input=alyoshaInput(cons),axis=input.team_dps.axis;axis.timeline=[{id:'q',kind:'action',action:'burst',actor:'member1',timeMs:0},{id:'end',kind:'switch',actor:'member2',timeMs:22000}];
  const result=compileActionAxis(axis,input.single_interfaces,input.team_dps);
  assert.equal(result.events.filter(e=>e.alyoshaField).length,count);assert.equal(result.events.filter(e=>e.alyoshaDog).length,count);assert.equal(result.heals.filter(e=>e.healing==='alyosha.a1').length,count);
 }
 const input=alyoshaInput(0);input.team_dps.axis.timeline=[{id:'q1',kind:'action',action:'burst',actor:'member1',timeMs:0},{id:'q2',kind:'action',action:'burst',actor:'member1',timeMs:1500},{id:'end',kind:'switch',actor:'member2',timeMs:22000}];
 const result=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);assert.equal(result.events.filter(e=>e.role===0).length,15);assert.ok(!result.events.some(e=>e.alyoshaDog&&e.time===118/60));
 input.team_dps.axis.timeline=[{id:'terminal',kind:'action',action:'burst',actor:'member1',timeMs:0}];assert.ok(compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps).events.some(e=>e.alyoshaDog));
});

test('mark activation keeps candidate gates, 0.1s delay, expiry and multi-target stack cap in one numeric state',()=>{
 function run(m,gate){
  const input=alyoshaInput(),events=[0,1,2].map((t,i)=>({kind:'hit',eventId:'h'+i,role:0,time:t,rootOrder:20,order:i,alyoshaMark:true,enabled:i===0?gate:1,targetIds:[0,1]}));
  events.push(...[.05,.10001,1.05,1.10001,2.05,2.10001,17.1].map(time=>({kind:'sample',time,rootOrder:100,eventId:'sample/'+time})));
  const queue=createEventScheduler(events),runtime=createAlyoshaRuntime({role:0,profile:input.single_interfaces[0],profiles:input.single_interfaces,settings:{enemy_count:2},math:m,enqueue:queue.enqueue,activeRole:()=>0,resources:[]});
  const values=[];
  for(const e of queue.events()){if(e.kind==='sample')values.push(runtime.stateAt(e).stacks);else if(e.kind==='hit')runtime.onHit(e);else runtime.onEvent(e);}
  return values;
 }
 const b=createNumericProgram(),program=b.finish(run(b.math,b.input(0)));
 for(const gate of [0,1,0])assert.deepEqual(executeNumericProgram(program,[gate]),run(scalarMath,gate));
 const values=run(scalarMath,1);assert.equal(values[3],2);assert.equal(values.at(-1),0);
});

test('live front-field precision and lowest-ratio healing affect real native hits, HP and fanfare in scalar and compiled A/B/A candidates',async()=>{
 const input=alyoshaInput(),teams=alyoshaTeams(input),evaluator=createTeamDpsEvaluator(api,input),native=teams.map(team=>evaluator.evaluate(team,true));
 const winners=result=>result.heals.filter(h=>h.healing==='alyosha.c4').map(h=>h.rawAmounts.findIndex(v=>v>0));
 assert.notDeepEqual(winners(native[0]),winners(native[1]));
 for(const [i,result]of native.entries()){
  const p={...input.single_interfaces[0],artifacts:teams[i][0],character:{...input.single_interfaces[0].character,params:{Alyosha:{hunter_precision_stacks:0,stellar_conduct_state:false}}}},panel=api.CommonInterface.get_attribute(p);
  const base=sum(panel.atk),baseATK=panel.atk['角色基础攻击']+panel.atk['武器基础攻击'];
  const one=result.hits.find(e=>e.eventId.startsWith('one/')),two=result.hits.find(e=>e.eventId.startsWith('two/')),other=result.hits.find(e=>e.eventId.startsWith('other/'));
  near(one.atk,base+baseATK*.212);near(two.atk,base+baseATK*.424);near(two.em,sum(panel.elemental_mastery)+100);
  near(result.hits.find(e=>e.alyoshaDog&&e.time>3.3).atk,base);
  const otherPanel=api.CommonInterface.get_attribute({...input.single_interfaces[1],artifacts:teams[i][1]});near(other.atk,sum(otherPanel.atk)+(otherPanel.atk['角色基础攻击']+otherPanel.atk['武器基础攻击'])*.424);
  const heals=result.heals.filter(h=>h.healing==='alyosha.c4');assert.ok(heals.length>1);assert.ok(result.fanfare>0);
  for(const heal of heals){
   const state=result.health.findLast(h=>h.time<heal.time||h.time===heal.time&&(h.step??0)<(heal.step??0));
   const winner=heal.rawAmounts.findIndex(v=>v>0),min=Math.min(...state.ratios);near(state.ratios[winner],min);assert.equal(heal.rawAmounts.filter(v=>v>0).length,1);
  }
 }
 const order=[3,2,0,1],permuted=structuredClone(input);
 permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);permuted.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
 const permutedResult=createTeamDpsEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i]),true);near(permutedResult.expectation,native[0].expectation);
 assert.deepEqual(winners(permutedResult).map(i=>order[i]),winners(native[0]));
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
 try{
  const out=(await computation.score(teams.map(team=>team.map(build=>build.map(a=>a.id))),{detail:true})).results;
  out.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(out[0],out[2]);
 }finally{computation.dispose();}
});
