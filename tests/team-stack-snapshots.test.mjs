import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';import {api} from '../beta-tools/runtime-7106.mjs';
import {effectInput} from './helpers/team-effect-refactor.mjs';import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {stackSnapshotDefinition,installStackSnapshotFixture,configureStackSnapshotFixture} from './helpers/stack-snapshot-definition.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const sequence=[{time:0,gain:1,hp:100},{time:1,gain:2,hp:200},{time:1,gain:1,hp:50},{time:4,gain:1,hp:300},{time:6,gain:4,hp:75}];
const positions=[[-1,99],[0,0],[0,99],[1,1],[1,2],[1,99],[4,99],[5,99],[6,4],[6,99],[11,99]];
const event=(time,rootOrder,extra={})=>({eventId:'e/'+time+'/'+rootOrder,kind:'cast',action:'skill',role:0,time,rootOrder,order:0,...extra});
const definition={...stackSnapshotDefinition,trigger:{kind:'cast'},duration:5,stacks:{...stackSnapshotDefinition.stacks,gain:e=>e.gain},reads:{hp:{stat:'hp',stage:'base',timing:'stack'},def:{stat:'def',stage:'base',timing:'activation'},atk:{stat:'atk',stage:'base',timing:'live'}},value:({m,read,stacks})=>({ATKFixed:m.mul(stacks,m.add(m.add(m.min(150,read('hp')),read('def')),read('atk')))})};
function run(m,inputs,trace=false){
 const source={definition,role:0,actorId:'source',key:'source'},plan={sources:[source],schedule:[],settings:{enemy_count:1},rotation:{model:'actions',activeRole:()=>1}};
 const state=createEffectState(plan,{math:m,events:[],enabled:()=>inputs[0],trace,read:(_r,d,e)=>d.stat==='hp'?m.mul(e.hp,inputs[6]):e.rootOrder+1}),resolver=createEffectResolver(plan,state,m);
 sequence.forEach((e,i)=>state.publish(event(e.time,i,{...e,enabled:inputs[i+1]})));
 const outputs=positions.map(([time,order])=>resolver.resolve('attack',1,event(time,order),()=>inputs[7]).reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.ATKFixed),0));
 return {outputs,state,source,resolver};
}
function oracle(inputs){
 return positions.map(([time,order])=>{
  let accepted=[],shared=0;
  sequence.forEach((e,i)=>{if(inputs[0]&&inputs[i+1]&&(e.time<time||e.time===time&&i<order)){shared=i+1;for(let n=0;n<e.gain;n++)accepted.push({expires:e.time+5,hp:e.hp*inputs[6]});accepted=accepted.slice(-3);}});
  return accepted.filter(e=>time<e.expires).reduce((n,e)=>n+Math.min(150,e.hp)+shared+inputs[7],0);
 });
}
test('per-stack captures match independent grant history under all 64 gates, nonlinear caps and mixed read timings',()=>{
 const b=createNumericProgram(),program=b.finish(run(b.math,Array.from({length:8},(_,i)=>b.input(i))).outputs);
 for(let mask=0;mask<64;mask++)for(const [scale,live]of [[1,10],[2,30]]){const values=[...Array.from({length:6},(_,i)=>(mask>>i)&1),scale,live],expected=oracle(values);run(scalarMath,values).outputs.forEach((v,i)=>near(v,expected[i]));executeNumericProgram(program,values).forEach((v,i)=>near(v,expected[i]));}
});
test('layer replacement preserves old captures, pure historical reads and one live read per resolution',()=>{
 const {state,source,resolver}=run(scalarMath,[1,1,1,1,1,1,1,10],true),first=state.changes[0];
 assert.deepEqual(first.stackCaptures,[{hp:0},{hp:0},{hp:100}]);assert.deepEqual(state.changes.at(-1).stackCaptures,[{hp:75},{hp:75},{hp:75}]);
 assert.deepEqual(state.at(source,event(1,99)).stackCaptures,[{hp:200},{hp:200},{hp:50}]);
 let reads=0;const at=event(1,99),value=()=>resolver.resolve('attack',1,at,()=>{reads++;return 10;})[0].config.ExtensionEffect.values.ATKFixed;
 assert.equal(value(),389);assert.equal(reads,1);assert.equal(value(),389);assert.equal(reads,2);
 assert.deepEqual(first.stackCaptures,[{hp:0},{hp:0},{hp:100}]);
});
test('stack reads require independent slots and retain the earlier-stage dependency restriction',()=>{
 const x=effectInput(),rotation=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),original=characterPackages.Skirk.effects;
 try{
  for(const change of [{stacks:undefined},{stacks:{limit:3,refresh:'all'}}]){characterPackages.Skirk.effects=()=>[{...definition,...change}];assert.throws(()=>compileEffectPlan(x.single_interfaces,rotation,x.team_dps),/逐层快照/);}
  characterPackages.Skirk.effects=()=>[{...definition,reads:{hp:{stat:'hp',stage:'attack',timing:'stack'}}}];assert.throws(()=>compileEffectPlan(x.single_interfaces,rotation,x.team_dps),/依赖/);
 }finally{characterPackages.Skirk.effects=original;}
});
test('native source HP changes are captured per layer in the shared compiled Worker and all 24 team orders',async()=>{
 const x=configureStackSnapshotFixture(effectInput()),teams=[x.single_interfaces.map(p=>p.artifacts)];teams.push(structuredClone(teams[0]));teams[1].flat().forEach(a=>a.id+=900000);teams[1][3].forEach(a=>a.sub_stats.push(['HPPercentage',.2]));
 const restore=installStackSnapshotFixture();let native;
 try{
  const ev=createTeamDpsEvaluator(api,x);native=teams.map(t=>ev.evaluate(t,true));near(ev.evaluate(teams[0]).expectation,native[0].expectation);assert.notEqual(native[0].expectation,native[1].expectation);
  const changes=native[0].effects.filter(e=>e.effectId===stackSnapshotDefinition.id);assert.ok(changes.some(e=>new Set(e.stackCaptures.map(c=>c.maxHP).filter(Boolean)).size===3));
  function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
  for(const order of permutations([0,1,2,3])){const y=structuredClone(x);y.single_interfaces=order.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_ids=order.map(i=>x.team_dps.initial_ids[i]);y.team_dps.initial_hp=order.map(i=>x.team_dps.initial_hp[i]);near(createTeamDpsEvaluator(api,y).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);}
 }finally{restore();}
 const output=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./helpers/team-stack-snapshot-worker.mjs',import.meta.url),{workerData:{input:x,teams}});let message;worker.on('message',value=>message=value);worker.on('error',reject);worker.on('exit',code=>code||!message?reject(Error('Stack snapshot worker exited '+code)):resolve(message));});
 for(let i=0;i<2;i++){near(output.results[i].expectation,native[i].expectation);compareEventValues(output.results[i].eventTrace,nativeEventTrace(native[i]));}assert.deepEqual(output.results[2],output.results[0]);
 const corrupted=structuredClone(output.results[0].eventTrace),row=corrupted.events.find(e=>e.states[0].value.stackCaptures);row.states[0].value.stackCaptures.at(-1).maxHP+=1;assert.throws(()=>compareEventValues(corrupted,nativeEventTrace(native[0])));
});
