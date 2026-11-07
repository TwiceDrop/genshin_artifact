import test from 'node:test';import assert from 'node:assert/strict';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {equipmentEffects} from '../beta-data/team-engine/equipment-effects.mjs';
import {createPortableHealth} from '../beta-data/team-dps-portable-health.mjs';
import {resolveCombatTimeline} from '../beta-data/team-engine/combat-runtime.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
import {stackInput} from './helpers/team-effect-stacks.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const definition=equipmentEffects.find(d=>d.id==='artifact.marechaussee.4');
const event=(time,order=0,extra={})=>({eventId:'hp/'+time+'/'+order,kind:'hp_change',role:0,onField:true,time,rootOrder:order,order:0,...extra});
function stackPlan(){return {sources:[{definition,role:0,actorId:'Skirk',key:definition.id+'/Skirk'}],schedule:[],settings:{enemy_count:1},rotation:{model:'actions',activeRole:()=>0}};}
function evaluateStacks(m,inputs){
 const plan=stackPlan(),state=createEffectState(plan,{math:m,events:[],enabled:()=>inputs[0]}),resolver=createEffectResolver(plan,state,m);
 const events=[event(0,0,{enabled:inputs[1]}),event(2.5,1,{enabled:inputs[2]}),event(5,2,{enabled:inputs[3]}),event(7,3,{enabled:inputs[4]}),event(8,4,{enabled:inputs[5],onField:false})];
 events.forEach(state.publish);return [0,2.5,5,7,8,10,12].map(time=>resolver.resolve('base',0,event(time,99)).reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.CriticalBase),0));
}
test('shared stack clocks cap, refresh at cap, expire exclusively and ignore disabled/off-field changes',()=>{
 const builder=createNumericProgram(),program=builder.finish(evaluateStacks(builder.math,Array.from({length:6},(_,i)=>builder.input(i))));
 for(let mask=0;mask<64;mask++){
  const inputs=Array.from({length:6},(_,i)=>(mask>>i)&1),expected=[];let stacks=0,expires=-Infinity,index=0;
  const activations=[0,2.5,5,7];for(const time of [0,2.5,5,7,8,10,12]){
   while(index<activations.length&&activations[index]<=time){const at=activations[index];if(inputs[0]&&inputs[index+1]){stacks=at>=expires?1:Math.min(3,stacks+1);expires=at+5;}index++;}expected.push(time<expires?stacks*.12:0);
  }
  evaluateStacks(scalarMath,inputs).forEach((v,i)=>near(v,expected[i]));executeNumericProgram(program,inputs).forEach((v,i)=>near(v,expected[i]));
 }
});
test('same-time health facts add separate stacks after their cause and preserve historical reads',()=>{
 const plan=stackPlan(),state=createEffectState(plan,{math:scalarMath,events:[],enabled:()=>1,trace:true}),resolver=createEffectResolver(plan,state,scalarMath);
 const read=e=>resolver.resolve('base',0,e).reduce((n,b)=>n+b.config.ExtensionEffect.values.CriticalBase,0),a=event(1,1),b=event(1,2);
 state.publish(a);assert.equal(read(a),0);state.publish(b);near(read(b),.12);near(read(event(1,3)),.24);near(read(event(6,3)),0);
 state.publish(event(6,4));near(read(event(6,5)),.12);near(read(event(1,3)),.24);assert.deepEqual(state.changes.map(e=>e.stacks),[1,2,1]);
});
test('resolved HP facts use actual clipped changes, without double sampling or max-HP-only triggers',()=>{
 const profiles=['Skirk','Furina','Escoffier','Vodyanitsa'].map(name=>({character:{name,level:1,constellation:0},weapon:{name:'',refine:1}}));
 const base={model:'actions',initialHealth:{ratios:[.5,1,1,1],fanfare:0,overflow:0,active:false},heals:[],events:[],roots:[],hpDrains:[],fanfareWindows:[],duration:5,endHit:'include',activeRole:()=>0,lastCast:()=>-Infinity};
 let max=100;const facts=[],draws=[];
 const health=createPortableHealth(profiles,[[],[],[],[]],base,{panelAt:()=>({hp:{base:max}}),healAt:h=>h.recipients.map(()=>h.raw),refresh:()=>{},random:(id,p)=>{draws.push([id,p]);return 1;}});
 const events=[event(0,0,{kind:'heal',raw:200,recipients:[0],probability:.5}),event(1,1,{kind:'heal',raw:200,recipients:[0]}),event(2,2,{kind:'team_hp_change',change:'decrease',ratio:.125,enabled:0}),event(3,3,{kind:'team_hp_change',change:'decrease',ratio:.125}),event(4,4,{kind:'hit',category:'skill'})];
 resolveCombatTimeline(events,health,null,{afterEvent:e=>{if(e.kind==='hp_change')facts.push(e);if(e.time===3)max=200;}});
 assert.equal(draws.length,1);assert.deepEqual(facts.map(e=>[e.time,e.change,e.amount,e.ratio]),[[0,'increase',50,.5],[3,'decrease',12.5,.125]]);assert.ok(facts.every(e=>e.probability===undefined&&e.parentEventId&&e.onField));assert.equal(new Set(facts.map(e=>e.eventId)).size,2);
});
test('stack declarations reject invalid caps and unsupported lifetime semantics',()=>{
 const x=stackInput(),rotation=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),original=definition.stacks;
 try{for(const stacks of [{limit:0,refresh:'all'},{limit:1.5,refresh:'all'},{limit:3,refresh:'independent'}]){definition.stacks=stacks;assert.throws(()=>compileEffectPlan(x.single_interfaces,rotation,x.team_dps),/叠层生命周期/);}}
 finally{definition.stacks=original;}
 assert.ok(compileEffectPlan(x.single_interfaces,rotation,x.team_dps).sources.some(s=>s.definition===definition));
});
test('real Hunter state is candidate-owned, role-order independent and agrees with compiled random healing',async()=>{
 for(const kind of ['deterministic','random']){
  const x=stackInput(kind),builds=x.single_interfaces.map(p=>p.artifacts),evaluator=createTeamDpsEvaluator(api,x),native=evaluator.evaluate(builds,true),compiled=(await nodeTeamDps(x,builds.flat(),{mode:'evaluate'})).results[0];
  for(const metric of ['expectation','critical','non_critical'])near(compiled[metric],native[metric]);compareEventValues(compiled.eventTrace,nativeEventTrace(native));
  const changes=native.trace_outcomes?native.trace_outcomes.flatMap(row=>row.output.effects):native.effects;assert.ok(changes.some(e=>e.effectId===definition.id));
  const modified=structuredClone(builds);modified[kind==='random'?2:0].slice(2).forEach(a=>{a.set_name='Adventurer';a.id+=100000;});evaluator.evaluate(modified);near(evaluator.evaluate(builds).expectation,native.expectation);
  if(kind==='deterministic'){
   function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
   for(const permutation of permutations([0,1,2,3])){const y=structuredClone(x);y.single_interfaces=permutation.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=permutation.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_ids=permutation.map(i=>x.team_dps.initial_ids[i]);y.team_dps.initial_hp=permutation.map(i=>x.team_dps.initial_hp[i]);near(createTeamDpsEvaluator(api,y).evaluate(permutation.map(i=>builds[i])).expectation,native.expectation);}
  }
 }
});
