import test from 'node:test';import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {api} from '../beta-tools/runtime-7106.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {compileDamageModels,sharedDamageModels} from '../beta-data/team-engine/damage-models.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';
import {createEffectState,effectApplies} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {validateEffectDefinition,matchesEffect} from '../beta-data/team-engine/effect-contract.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {modelInput,modelTeams,modelEvaluator,installTestDamageModel,testEffect,testDamageModel,testModelId} from './helpers/team-effect-models.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('effect targets distinguish source, teammates and front/back field without changing on-field ownership',()=>{
 const source={role:0},event={time:1,rootOrder:2};
 const expected={self:[[0],[0]],other:[[1,2,3],[1,2,3]],team:[[0,1,2,3],[0,1,2,3]],selfOnField:[[0],[]],selfOffField:[[],[0]],otherOnField:[[],[1]],otherOffField:[[1,2,3],[2,3]],teamOnField:[[0],[1]],teamOffField:[[1,2,3],[0,2,3]]};
 for(const [target,byFront]of Object.entries(expected))for(const front of [0,1])assert.deepEqual([0,1,2,3].filter(role=>effectApplies({target},source,role,event,()=>front)),byFront[front],target+'/'+front);
});

test('shared models need no character owner and freeze their evaluator and random declaration at compile',()=>{
 const definition={id:'test.shared',randomOutcomes:true,evaluate:()=>({selected:9})};sharedDamageModels.push(definition);
 try{
  const factory=compileDamageModels(modelInput().single_interfaces);definition.evaluate=()=>{throw Error('late mutation');};definition.randomOutcomes=false;
  assert.equal(factory.randomOutcomes,true);assert.equal(factory({results:{add:(_e,s)=>s}})({damageModel:definition.id}),9);
 }finally{sharedDamageModels.splice(sharedDamageModels.indexOf(definition),1);}
});

test('model-declared critical outcomes use the common exact scalar and compiled result state',async()=>{
 const input={...modelInput(),testCritical:true},teams=modelTeams(input),restore=installTestDamageModel();let native;
 try{
  native=teams.map(team=>modelEvaluator(api,input).evaluate(team,true));
  for(const result of native){
   const trace=nativeEventTrace(result),hits=new Map();
   for(const e of trace.events)if(e.channel==='hits'&&e.states.some(s=>s.value.damageModel===testModelId))hits.set(e.eventId,[...(hits.get(e.eventId)??[]),...e.states]);
   assert.equal(hits.size,2);
   for(const states of hits.values()){const base=Math.min(...states.map(s=>s.value.expectation));near(states.reduce((n,s)=>n+s.probability*s.value.expectation,0),base*1.25);near(states.filter(s=>s.value.expectation>base*1.5).reduce((n,s)=>n+s.probability,0),.25);}
  }
 }finally{restore();}
 const worker=new Worker(new URL('./helpers/team-effect-model-worker.mjs',import.meta.url));
 try{
  const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input,teams});});assert.equal(result.error,undefined,result.error);
  for(let i=0;i<2;i++){near(result.results[i].expectation,native[i].expectation);compareEventValues(result.results[i].eventTrace,nativeEventTrace(native[i]));}
 }finally{await worker.terminate();}
});

test('model, reaction and required tags filter activation and finite consumption using the same contract',()=>{
 const definition={...testEffect,trigger:{kind:'hit',damageModel:testModelId,damageTags:['test:trigger']}},source={definition,role:0,key:'test/0'},event=(id,role,time,extra={})=>({eventId:id,kind:'hit',time,rootOrder:0,order:0,role,category:'normal',element:'Cryo',damageModel:testModelId,damageTags:['test:marked','test:contact'],reactionType:'test-reaction',...extra});
 const plan={sources:[source],schedule:[],settings:{enemy_count:3,damage_scope:'all'},rotation:{model:'actions',activeRole:()=>1}};
 const state=createEffectState(plan,{math:scalarMath,enabled:()=>1,trace:true}),resolve=createEffectResolver(plan,state,scalarMath);
 state.publish(event('wrong-trigger',0,0));state.publish(event('correct-trigger',0,.1,{damageTags:['test:trigger']}));
 const wrong=[{damageModel:'native.skill'},{damageTags:['test:contact']},{reactionType:'other'},{element:'Hydro'}];
 wrong.forEach((extra,i)=>state.publish(event('wrong'+i,1,.2+i*.1,extra)));
 const hit=event('correct',1,1);state.publish(hit);
 assert.deepEqual(state.changes.filter(c=>c.kind==='activate').map(c=>c.activationId),['correct-trigger/0.1/0/0']);
 assert.deepEqual(state.changes.filter(c=>c.kind==='consume').map(c=>[c.eventId,c.used]),[['correct/1/0/0',3]]);
 near(resolve.resolve('damage',1,hit,()=>400)[0].config.ExtensionEffect.values.ExtraDmgBase,100);
 assert.ok(matchesEffect({damageModel:'native.skill'},{category:'normal'}));
 assert.ok(matchesEffect({damageModel:'equipment.physical'},{category:'equipment'}));
 assert.equal(matchesEffect({damageModel:'native.skill'},{category:'normal',damageModel:testModelId}),false);
});

function groupedValues(m,gates,mode,reverse=false){
 const sources=[0,1].map(role=>({role,key:'group/'+role,definition:{id:'g'+role,label:'同类',stage:'damage',target:'team',trigger:{kind:'cast'},duration:4,reads:{},stacking:{group:'g',mode},value:()=>({ExtraDmgBase:role?70:100})}}));
 if(reverse)sources.reverse();
 const plan={sources,settings:{enemy_count:1},rotation:{model:'actions',activeRole:()=>2},schedule:[0,1].map(role=>({kind:'cast',time:0,rootOrder:role,role,eventId:'cast/'+role,enabled:gates[role]}))};
 const resolver=createEffectResolver(plan,createEffectState(plan,{math:m,enabled:()=>1}),m);
 return [1,4].map(time=>resolver.resolve('damage',2,{kind:'hit',time,rootOrder:10,role:2}).reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.ExtraDmgBase),0));
}
test('explicit sum/highest groups preserve candidate gates, exclusive expiry and provider permutation in numeric graphs',()=>{
 for(const mode of ['highest','sum'])for(const reverse of [false,true]){
  const b=createNumericProgram(),p=b.finish(groupedValues(b.math,[b.input(0),b.input(1)],mode,reverse));
  for(const gates of [[0,0],[1,0],[0,1],[1,1],[0,0]]){
   const expected=[mode==='sum'?gates[0]*100+gates[1]*70:Math.max(gates[0]*100,gates[1]*70),0];
   assert.deepEqual(groupedValues(scalarMath,gates,mode,reverse),expected);assert.deepEqual(executeNumericProgram(p,gates),expected);
  }
 }
});

test('unsupported target/stacking declarations and duplicate/conflicting identities fail at plan compile',()=>{
 for(const change of [{target:'typo'},{stacking:{group:'g',mode:'latest'}},{uses:1.5},{filter:{damageTags:'bad'}}])assert.throws(()=>validateEffectDefinition({...testEffect,...change}));
 const input=modelInput(),plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),owner=characterPackages.Escoffier,original=owner.effects;
 try{
  owner.effects=()=>[testEffect,testEffect];assert.throws(()=>compileEffectPlan(input.single_interfaces,plan,input.team_dps),/身份重复/);
  owner.effects=()=>[{...testEffect,stacking:{group:'g',mode:'sum'}},{...testEffect,id:'second',stacking:{group:'g',mode:'highest'}}];assert.throws(()=>compileEffectPlan(input.single_interfaces,plan,input.team_dps),/分组合同冲突/);
 }finally{owner.effects=original;}
});

test('model selection honors explicit identity, rejects unknown/duplicate definitions, and snapshots installed functions',()=>{
 const input=modelInput(),restore=installTestDamageModel();
 try{
  const owner=characterPackages.Escoffier;owner.damageModels=[{id:testModelId,evaluate:()=>({selected:3})}];
  const factory=compileDamageModels(input.single_interfaces);
  owner.damageModels=[testDamageModel,testDamageModel];assert.throws(()=>compileDamageModels(input.single_interfaces),/身份重复/);
  owner.damageModels=[{id:'native.skill',evaluate(){}}];assert.throws(()=>compileDamageModels(input.single_interfaces),/身份重复/);
  const calls=[],resolve=factory({nativeSkill:e=>({selected:1}),equipmentPhysical:e=>({selected:2}),results:{add:(_e,s,a)=>{calls.push([s,a]);return s;}}});
  assert.equal(resolve({category:'equipment',damageModel:'native.skill'}),1);assert.equal(resolve({category:'skill',damageModel:'equipment.physical'}),2);
  assert.equal(resolve({category:'normal',damageModel:testModelId}),3);
  assert.throws(()=>resolve({damageModel:'unknown'}),/未安装伤害模型/);assert.deepEqual(calls,[[1,1],[2,2],[3,3]]);
 }finally{restore();}
});

test('custom model preserves 24 party orders and live candidate gates in a separate numeric Worker',async()=>{
 const input=modelInput(),teams=modelTeams(input),restore=installTestDamageModel();let native;
 try{
  const base=modelEvaluator(api,input).evaluate(teams[0],true);
  function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
  for(const order of permutations([0,1,2,3])){
   const x=structuredClone(input);x.single_interfaces=order.map(i=>input.single_interfaces[i]);x.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);x.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
   const result=modelEvaluator(api,x).evaluate(order.map(i=>teams[0][i]),true);near(result.expectation,base.expectation);
   const hits=r=>r.hits.filter(h=>h.damageModel===testModelId).map(h=>h.expectation);assert.deepEqual(hits(result),hits(base));
  }
  native=teams.map((team,i)=>modelEvaluator(api,{...input,testGate:i===0?1:2}).evaluate(team,true));
  assert.equal(native[0].effects.find(e=>e.effectId===testEffect.id&&e.kind==='consume').used,3);
  assert.equal(native[1].effects.filter(e=>e.effectId===testEffect.id&&e.kind==='consume').length,1);
 }finally{restore();}
 const worker=new Worker(new URL('./helpers/team-effect-model-worker.mjs',import.meta.url));
 try{
  const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input:{...input,testGate:1},teams});});
  assert.equal(result.error,undefined,result.error);for(let i=0;i<2;i++){near(result.results[i].expectation,native[i].expectation);compareEventValues(result.results[i].eventTrace,nativeEventTrace(native[i]));}
  assert.deepEqual(result.results[2],result.results[0]);
 }finally{await worker.terminate();}
});

test('installed model bypasses native damage lookup and consumes real target order independently of score selection',()=>{
 const restore=installTestDamageModel();
 try{
  for(const damage_scope of ['single','all']){
   const input=modelInput();input.team_dps.damage_scope=damage_scope;const teams=modelTeams(input),ev=modelEvaluator(api,input),outputs=teams.map(team=>ev.evaluate(team,true));
   for(const result of outputs){
    const sum=p=>Object.values(p).reduce((n,v)=>n+v,0),base=sum(result.panels[3].hp)*.01,addition=sum(result.panels[2].atk)*.25,hits=result.hits.filter(h=>h.damageModel===testModelId);
    assert.equal(hits.length,2);assert.ok(hits.every(h=>h.index===9999&&h.category==='normal'));
    const expected=damage_scope==='all'?[(base+addition)*3*.9,(base*3+addition)*.9]:[(base+addition)*.9,base*.9];
    hits.forEach((h,i)=>near(h.expectation,expected[i]));
    assert.deepEqual(result.effects.filter(e=>e.effectId===testEffect.id&&e.kind==='consume').map(e=>e.used),[3,1]);
   }
   assert.notEqual(outputs[0].expectation,outputs[1].expectation);assert.deepEqual(ev.evaluate(teams[0],true),outputs[0]);
  }
 }finally{restore();}
});
