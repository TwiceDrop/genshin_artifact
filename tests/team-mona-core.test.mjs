import test from 'node:test';import assert from 'node:assert/strict';
import {monaCoreInput,monaCoreTeams,monaCoreEvaluator,monaAction} from './helpers/team-mona-core.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {actionAxisDurationMs,validateActionAxis} from '../beta-data/team-engine/action-config.mjs';
import {createMonaRuntime,MONA_BUBBLE_APPLICATION_DELAY as delay} from '../beta-data/team-engine/characters/mona-runtime.mjs';
import {mona} from '../beta-data/team-engine/characters/mona.mjs';
import {scalarMath as math} from '../beta-data/team-dps-numeric-rules.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`),sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);

test('Mona application precedes independent bubbles, manual delay starts at application and expiry/ties preserve axis data',()=>{
 for(const hand of [0,2000,undefined]){
  const input=monaCoreInput([monaAction('q',0,'burst',0,hand===undefined?undefined:{bubbleDelayMs:hand})]),before=JSON.stringify(input),plan=compile(input),result=evaluate(input);
  validateActionAxis(input.team_dps.axis);assert.equal(plan.applications.length,1);near(plan.applications[0].time,delay);
  assert.equal(result.hits.length,2);for(const h of result.hits)near(h.time,delay+(hand??8000)/1000+1/60);
  near(plan.duration,result.duration);near(actionAxisDurationMs(input.team_dps.axis,input.single_interfaces)/1000,result.duration);assert.equal(JSON.stringify(input),before);
  assert.ok(result.hits.every(h=>h.monaBubble));assert.equal(plan.applications[0].application.group,result.hits[0].application.group);assert.equal(result.hits[0].application.gauge,2);
  input.team_dps.axis.endHit='exclude';assert.equal(evaluate(input).hits.length,0);
 }
 const input=monaCoreInput([monaAction('q',0,'burst',0),monaAction('before',1,'normal.1',1),monaAction('same',1,'normal.1',delay),monaAction('later',1,'normal.1',3)]),result=evaluate(input);
 for(const h of result.hits.filter(h=>h.monaBubble))near(h.time,delay+1/60);
 assert.equal(result.hits.find(h=>h.eventId.startsWith('before/')).analysis.bonus['莫娜·星异'],undefined);
 near(result.hits.find(h=>h.eventId.startsWith('same/')).analysis.bonus['莫娜·星异'],.6);
 const replaced=monaCoreInput([monaAction('first',0,'burst',0),monaAction('second',0,'burst',1,{bubbleDelayMs:0})]),pops=evaluate(replaced).hits.filter(h=>h.monaBubble);
 assert.equal(pops.length,2);assert.ok(pops.every(h=>h.eventId.startsWith('second/')));pops.forEach(h=>near(h.time,1+delay+1/60));
});

test('frozen targets expire independently and Omen/C4/C6 read actual target at hit time',()=>{
 const input=monaCoreInput(),teams=monaCoreTeams(input),evaluator=monaCoreEvaluator(api,input),result=evaluator.evaluate(teams[0],true);
 const pops=result.hits.filter(h=>h.monaBubble);assert.equal(pops.length,2);
 const frozen=pops.find(h=>h.targetIds[0]===0),plain=pops.find(h=>h.targetIds[0]===1);near(plain.time,2+1/60);assert.ok(frozen.time>plain.time&&frozen.time<delay+8);assert.match(frozen.triggerEventId,/aura-change/);
 const charged=result.hits.filter(h=>h.eventId.startsWith('late/'));assert.equal(charged.length,2);
 const yes=charged.find(h=>h.targetIds[0]===0),no=charged.find(h=>h.targetIds[0]===1);
 near(yes.analysis.bonus['莫娜·星异'],.6);assert.equal(no.analysis.bonus['莫娜·星异'],undefined);near(yes.crit-no.crit,.15);near(yes.crit_damage-no.crit_damage,.15);
 near(sum(yes.analysis.atk_ratio),2*sum(no.analysis.atk_ratio));assert.equal(yes.monaC6Stacks,3);assert.equal(no.monaC6Stacks,3);assert.ok(result.hits.filter(h=>h.eventId.startsWith('again/')).every(h=>h.monaC6Stacks===0));
 const p={...input.single_interfaces[0],artifacts:teams[0][0],skill:{index:4,config:{Mona:{c6_omen:true,c6_charged_stack:3}}},buffs:[]};
 near(sum(yes.analysis.atk_ratio),sum(api.CalculatorInterface.get_damage_analysis(p,null).atk_ratio));
 const second=evaluator.evaluate(teams[1],true);assert.ok(second.expectation>result.expectation);near(evaluator.evaluate(teams[0]).expectation,result.expectation);
 const order=[2,0,3,1],changed=structuredClone(input);changed.single_interfaces=order.map(i=>input.single_interfaces[i]);changed.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);changed.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
 near(monaCoreEvaluator(api,changed).evaluate(order.map(i=>teams[0][i])).expectation,result.expectation);
});

test('impulse eligibility, frozen loss and manual overrides are separate from normal hit triggers',()=>{
 const setup=(params,cons=0)=>{
  const hits=[],queue=[],ends=[],frozen=[0,0],profile=monaCoreInput().single_interfaces[0];profile.character.constellation=cons;
  const runtime=createMonaRuntime({role:0,profile,settings:{enemy_count:2},math,activeRole:()=>0,enqueue:e=>queue.push(e),complete:(a,t)=>ends.push(t),reactions:{currentAura:(_,id)=>frozen[id],watchFrozen:()=>{}},addWindow:(_k,e,life)=>({start:e.time,end:e.time+life}),hit:(a,template,offset,suffix)=>hits.push({...template,time:a.time+offset,eventId:a.id+'/'+suffix})});
  const cast={kind:'cast',action:'burst',role:0,id:'q',eventId:'q',time:0,rootOrder:0,params};runtime.onEvent(cast);runtime.afterEvent({kind:'application',role:0,castId:'q',monaBubbleApplication:true,eventId:'app',time:delay,rootOrder:10});
  return {runtime,hits,queue,ends,frozen};
 };
 const a=setup();a.runtime.afterEvent({kind:'hit',eventId:'first-ec',time:2,rootOrder:0,hitTriggers:false,noImpulse:true,targetIds:[0,1]});assert.equal(a.hits.length,0);
 a.runtime.afterEvent({kind:'hit',eventId:'next-ec',time:3,rootOrder:0,hitTriggers:false,noImpulse:false,targetIds:[1]});assert.equal(a.hits.length,1);assert.deepEqual(a.hits[0].targetIds,[1]);
 a.frozen[0]=1;a.runtime.afterEvent({kind:'hit',eventId:'frozen-hit',time:3.1,rootOrder:0,targetIds:[0]});assert.equal(a.hits.length,1);
 a.frozen[0]=0;a.runtime.afterEvent({kind:'aura_change',element:'Frozen',change:'expire',reason:'shatter',eventId:'loss',time:3.2,rootOrder:0,targetIds:[0]});assert.equal(a.hits.length,2);near(a.hits[1].time,3.2+1/60);
 a.runtime.onEvent(a.queue.find(e=>e.mechanic==='mona.bubble'));assert.equal(a.hits.length,2);
 const chain=setup();chain.runtime.afterEvent({kind:'hit',eventId:'single',time:2,rootOrder:0,targetIds:[0]});assert.equal(chain.hits.length,1);
 chain.runtime.afterEvent({kind:'hit',eventId:'area-child',time:2.1,rootOrder:0,targetIds:[0,1],resolvedInstances:chain.hits[0].resolvedInstances});assert.equal(chain.hits.length,2);assert.deepEqual(chain.hits[1].targetIds,[1]);
 const manual=setup({bubbleDelayMs:2000});manual.runtime.afterEvent({kind:'hit',eventId:'contact',time:2,rootOrder:0,targetIds:[0,1]});assert.equal(manual.hits.length,0);manual.frozen.fill(1);manual.runtime.onEvent(manual.queue.find(e=>e.mechanic==='mona.bubble'));assert.equal(manual.hits.length,2);manual.hits.forEach(h=>near(h.time,delay+2+1/60));
});
