import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';
import {readEvent,readPlan,snapshotDefinition,readValue,snapshotOutputs} from './helpers/team-effect-reads.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('activation reads capture once, refresh only when enabled, and preserve earlier history',()=>{
 let source=100,calls=0;const plan=readPlan(snapshotDefinition),state=createEffectState(plan,{math:scalarMath,events:[],enabled:()=>1,trace:true,read:()=>{calls++;return source;}}),resolver=createEffectResolver(plan,state,scalarMath);
 state.publish(readEvent(0,'cast'));source=200;assert.equal(readValue(resolver,readEvent(1)),100);assert.equal(readValue(resolver,readEvent(1)),100);assert.equal(calls,1);
 state.publish(readEvent(2,'cast',{enabled:0}));assert.equal(calls,1);assert.equal(readValue(resolver,readEvent(3)),100);
 source=300;state.publish(readEvent(4,'cast'));assert.equal(calls,2);assert.equal(readValue(resolver,readEvent(5)),300);assert.equal(readValue(resolver,readEvent(1)),100);assert.equal(readValue(resolver,readEvent(14)),0);
 assert.equal(state.at(plan.sources[0],readEvent(-1)).captures.attack,0);assert.deepEqual(state.changes.map(e=>e.captures.attack),[100,300]);
 const live=readPlan({...snapshotDefinition,id:'test.live',reads:{attack:{stat:'atk',stage:'attack',timing:'live'}}}),liveState=createEffectState(live,{math:scalarMath,enabled:()=>1,events:[readEvent(0,'cast')]}),liveResolver=createEffectResolver(live,liveState,scalarMath);
 assert.equal(readValue(liveResolver,readEvent(1),()=>400),400);assert.equal(readValue(liveResolver,readEvent(1),()=>500),500);
});

test('numeric activation gates preserve snapshot values, refresh expiry and pre-activation state',()=>{
 const builder=createNumericProgram(),program=builder.finish(snapshotOutputs(builder.math,Array.from({length:4},(_,i)=>builder.input(i))));
 for(const [inputs,expected]of [[[100,1,300,0],[100,100,0,0,0]],[[100,0,300,1],[0,300,300,0,0]],[[100,1,300,1],[100,300,300,0,0]],[[100,0,300,0],[0,0,0,0,0]]]){
  assert.deepEqual(snapshotOutputs(scalarMath,inputs),expected);assert.deepEqual(executeNumericProgram(program,inputs),expected);
 }
});

test('simultaneous activations capture pre-event stats regardless of source registration order',()=>{
 for(const reverse of [false,true]){
  const plan=readPlan(snapshotDefinition),base={...plan.sources[0],key:'base/source',definition:{id:'base',label:'固定攻击',stage:'base',target:'team',trigger:{kind:'cast',action:'skill'},duration:10,reads:{},value:()=>({ATKPercentage:.2})}};
  plan.sources.push(base);if(reverse)plan.sources.reverse();let resolver;
  const state=createEffectState(plan,{math:scalarMath,enabled:()=>1,events:[],read:(_role,_dependency,e)=>100*(1+resolver.resolve('base',0,e).reduce((n,b)=>n+b.config.ExtensionEffect.values.ATKPercentage,0))});
  resolver=createEffectResolver(plan,state,scalarMath);state.publish(readEvent(0,'cast'));assert.equal(readValue(resolver,readEvent(1)),100);
  state.publish(readEvent(2,'cast'));assert.equal(readValue(resolver,readEvent(3)),120);assert.equal(readValue(resolver,readEvent(1)),100);
 }
});

test('effect read contracts reject unknown stages, fields, timing and backward dependencies',()=>{
 const x=effectInput(),rotation=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),original=characterPackages.Skirk.effects;
 try{
  for(const [change,pattern]of [[{stage:'missing'},/写入阶段/],[{reads:{attack:{stat:'atk',stage:'missing',timing:'live'}}},/依赖/],[{reads:{attack:{stat:'atk',stage:'damage',timing:'live'}}},/依赖/],[{reads:{attack:{stat:'typo',stage:'attack',timing:'live'}}},/字段/],[{reads:{attack:{stat:'atk',stage:'attack',timing:'later'}}},/时机/]]){
   characterPackages.Skirk.effects=()=>[{...snapshotDefinition,...change}];assert.throws(()=>compileEffectPlan(x.single_interfaces,rotation,x.team_dps),pattern);
  }
  characterPackages.Skirk.effects=()=>[snapshotDefinition];assert.ok(compileEffectPlan(x.single_interfaces,rotation,x.team_dps).sources.some(s=>s.definition.id===snapshotDefinition.id));
 }finally{characterPackages.Skirk.effects=original;}
});

test('native activation reads see pre-event source HP, unlike live reads, and reset per candidate',()=>{
 const x=effectInput();x.single_interfaces[3].character.constellation=4;
 x.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('s-e','Skirk','skill',500),action('n','Skirk','normal.1',1000),{id:'tail',kind:'switch',actor:'Skirk',timeMs:2000}];
 const builds=x.single_interfaces.map(p=>p.artifacts),live=createTeamDpsEvaluator(api,x).evaluate(builds,true),original=characterPackages.Vodyanitsa.effects;
 try{
  characterPackages.Vodyanitsa.effects=(...args)=>original(...args).map(d=>d.id==='vodyanitsa.c1'?{...d,reads:{maxHP:{...d.reads.maxHP,timing:'activation'}}}:d);
  const evaluator=createTeamDpsEvaluator(api,x),snapshot=evaluator.evaluate(builds,true),activation=snapshot.effects.find(e=>e.effectId==='vodyanitsa.c1'&&e.kind==='activate');
  const h=snapshot.hits.find(e=>e.eventId==='n/normal.1'),l=live.hits.find(e=>e.eventId==='n/normal.1');
  near(h.analysis.atk['沃雅妮莎·一命'],activation.captures.maxHP*.008);assert.ok(l.analysis.atk['沃雅妮莎·一命']>h.analysis.atk['沃雅妮莎·一命']);
  const changed=structuredClone(builds);changed[3].forEach(a=>{a.id+=900000;a.sub_stats.push(['HPPercentage',.2]);});
  assert.ok(evaluator.evaluate(changed,true).effects.find(e=>e.captures).captures.maxHP>activation.captures.maxHP);assert.equal(evaluator.evaluate(builds).expectation,snapshot.expectation);
 }finally{characterPackages.Vodyanitsa.effects=original;}
});
