import test from 'node:test';import assert from 'node:assert/strict';
import {createHitResults} from '../beta-data/team-dps-hit-results.mjs';
import {ProcOutcomeRequired} from '../beta-data/team-engine/proc-outcomes.mjs';
import {resolveCombatTimeline} from '../beta-data/team-engine/combat-runtime.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram,scheduleNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
const damage=value=>({expectation:value,critical:value*2,non_critical:value/2});
const hit=(id,time=0,extra={})=>({eventId:id,trialKey:id,label:id,role:0,time,rootOrder:0,order:0,kind:'hit',category:'equipment',...extra});
const row=event=>({...event,analysis:{normal:damage(0)}});

test('posterior contributions retain event-time coefficients, target selections and pure reads',()=>{
 const results=createHitResults(scalarMath,1,{defer:true}),event=hit('t',0,{probability:.25}),trace=row(event);
 const actual=results.add(event,damage(100),damage(300),trace);
 assert.throws(()=>actual.expectation,ProcOutcomeRequired);
 results.add(hit('fixed',1,{probability:1}),damage(20));
 results.finish(new Map([['t',.5]]));
 assert.deepEqual(results.totals,damage(70));assert.equal(actual.expectation,150);assert.equal(actual.expectation,150);
 assert.equal(trace.expectation,50);assert.equal(trace.analysis.normal.expectation,50);assert.equal(trace.analysis.event_probability,.5);
 assert.equal(results.report(event).probability,.5);
});
test('zero posterior removes hypothetical trace events without negative damage correction',()=>{
 const results=createHitResults(scalarMath,1,{defer:true}),event=hit('zero',0,{probability:.9});
 results.add(event,damage(1e20),damage(1e20),row(event));results.add(hit('real',1),damage(1),damage(1),row(hit('real',1)));
 results.finish(new Map([['zero',0]]));assert.equal(results.totals.expectation,1);assert.equal(results.rows.length,1);assert.equal(results.report(event),undefined);
});
test('damage feedback observes occurrence before nonlinear health clipping and uses actual targets',()=>{
 const run=probability=>{
  let hp=.9;const results=createHitResults(scalarMath,1,{defer:true}),event=hit('trial',0,{probability});
  const health={events:[],rotation:{duration:1,endHit:'include'},resolve(e){if(e.kind==='heal')hp=Math.min(1,hp+e.amount);}};
  resolveCombatTimeline([event],health,null,{hit:e=>results.add(e,damage(.1),damage(.2)),afterEvent(e,enqueue){if(e.kind==='hit')enqueue({kind:'heal',role:0,time:0,rootOrder:0,order:1,eventId:'heal',amount:e.damage.expectation});}});
  results.finish();return hp;
 };
 assert.throws(()=>run(.5),ProcOutcomeRequired);
 assert.equal(run(0),.9);assert.equal(run(1),1);assert.equal(.5*run(0)+.5*run(1),.95);
});
test('effect activation and finite consumption observe only applicable live random contacts',()=>{
 const definition={id:'test',target:'team',trigger:{kind:'hit',category:'equipment'},duration:3,uses:5,filter:{category:'normal'},reads:{}},source={definition,role:0,key:'test/owner',actorId:'owner'};
 const plan={sources:[source],schedule:[],settings:{enemy_count:3},rotation:{model:'actions',activeRole:()=>0}};
 const state=createEffectState(plan,{math:scalarMath,enabled:()=>1,events:[],trace:true});
 state.publish(hit('irrelevant',0,{category:'charged',probability:.5}));
 assert.throws(()=>state.publish(hit('activate',0,{probability:.5})),ProcOutcomeRequired);assert.equal(state.changes.length,0);
 state.publish(hit('activate',0,{probability:1}));
 assert.throws(()=>state.publish(hit('consume',1,{category:'normal',probability:.5})),ProcOutcomeRequired);
 state.publish(hit('consume',1,{category:'normal',probability:1}));assert.equal(state.changes.at(-1).after,2);
 state.publish(hit('expired',4,{category:'normal',probability:.5}));assert.equal(state.changes.filter(c=>c.kind==='consume').length,1);
});
test('symbolic posterior coefficients and role totals use the same hit result collector',()=>{
 const builder=createNumericProgram(),results=createHitResults(builder.math,2,{defer:true});
 results.add(hit('a',0,{probability:.3}),damage(100));results.add(hit('b',1,{role:1,probability:.6}),damage(50));
 results.finish(new Map([['a',builder.input(0)],['b',builder.input(1)]]));
 const program=builder.finish([results.totals.expectation,...results.byRole.map(r=>r.expectation)]);
 for(const [inputs,expected]of [[[0,0],[0,0,0]],[[1,0],[100,100,0]],[[.4,.8],[80,40,40]]])assert.deepEqual(executeNumericProgram(program,inputs),expected);
});
function executeScheduled(program,inputs){
 const scheduled=scheduleNumericProgram(program),values=[];
 for(const node of scheduled.nodes)values[node.target]=node.op==='literal'?node.value:node.op==='input'?inputs[node.value]:Number(scalarMath[node.op](...node.args.map(i=>values[i])));
 return scheduled.outputs.map(i=>values[i]);
}
test('register scheduling preserves arithmetic, shared values and exceptional numbers',()=>{
 for(let seed=1;seed<=32;seed++){
  let state=seed;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const builder=createNumericProgram(),values=Array.from({length:8},(_,i)=>builder.input(i)),ops=['add','sub','mul','div','min','max','eq','choose'];
  for(let i=0;i<300;i++){const op=ops[next()%ops.length],args=Array.from({length:op==='choose'?3:2},()=>values[next()%values.length]);values.push(builder.math[op](...args));}
  const program=builder.finish([...values.slice(-12),values[0],values.at(-1)]),inputs=[-0,0,1,-1,1e200,1e-200,Infinity,NaN];
  assert.deepEqual(executeScheduled(program,inputs),executeNumericProgram(program,inputs));
 }
});
test('dependency scheduling handles long state chains without recursion or changed results',()=>{
 const builder=createNumericProgram(),input=builder.input(0);let value=input;
 for(let i=0;i<20000;i++)value=builder.math.add(value,input);
 const program=builder.finish([value,input,value]);assert.deepEqual(executeScheduled(program,[2]),[40002,2,40002]);
});
