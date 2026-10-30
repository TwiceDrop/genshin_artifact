import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {api} from '../beta-tools/runtime-7106.mjs';
import {targetSnapshotInput,targetSnapshotTeams,installTargetSnapshot,targetSnapshotEvaluator} from './helpers/team-target-snapshots.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {targetObservation} from '../beta-data/team-engine/hit-observation.mjs';
import {snapshotEvent} from '../beta-data/team-engine/stat-snapshot.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createHitResults} from '../beta-data/team-dps-hit-results.mjs';
import {teamEventRows,packTeamDpsResult,unpackTeamDpsResult} from '../beta-data/team-dps-result-view.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../beta-data/team-engine/effect-resolver.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hits=(result,prefix='target-1')=>result.hits.filter(h=>h.eventId.startsWith(prefix));

for(const mode of ['critical','highest'])test('finite '+mode+' effects resolve each real target before nonlinear damage/group operations',()=>{
 const x=targetSnapshotInput(mode),teams=targetSnapshotTeams(x),base=targetSnapshotEvaluator(api,x).evaluate(teams[0],true),plain=hits(base)[0],n=plain.non_critical/3;
 const restore=installTargetSnapshot(mode);
 try{
  for(const damage_scope of ['all','single']){
   const ev=targetSnapshotEvaluator(api,{...x,team_dps:{...x.team_dps,damage_scope}}),result=ev.evaluate(teams[0],true),rows=hits(result),ids=damage_scope==='all'?[2,0,1]:[0];
   const expected=ids.map(id=>{const extra=mode==='highest'?(id===2?100:id===0?80:0):0,cr=mode==='critical'&&id===2?Math.min(1,plain.crit+.9):plain.crit;return (n+extra*(1+plain.bonus)*plain.def*plain.res)*(1+cr*plain.crit_damage);});
   near(rows.reduce((n,r)=>n+r.expectation,0),expected.reduce((a,b)=>a+b,0));
   assert.deepEqual(rows.flatMap(r=>r.targetIds).sort(),[...ids].sort());
   for(const row of rows){
    const id=row.targetIds[0],extra=mode==='highest'?(id===2?100:id===0?80:0):0,base=n+extra*(1+plain.bonus)*plain.def*plain.res,cr=mode==='critical'&&id===2?Math.min(1,plain.crit+.9):plain.crit;
    near(row.non_critical,base);near(row.expectation,base*(1+cr*plain.crit_damage));assert.equal(row.analysis.target_count,1);
   }
   assert.deepEqual(result.effects.filter(e=>e.kind==='consume'&&e.effectId.startsWith('test.')).map(e=>e.used),mode==='critical'?[1]:[1,2]);
   const trace=nativeEventTrace(result);near(teamEventRows(trace).filter(r=>r.event.channel==='hits').reduce((s,r)=>s+r.contributions.expectation,0),result.expectation);
   const alternate=ev.evaluate(teams[1],true);assert.notEqual(alternate.expectation,result.expectation);assert.deepEqual(ev.evaluate(teams[0],true),result);
  }
 }finally{restore();}
});

test('partial snapshot keeps cast ATK while reading impact CR; empty fields are live and omitted fields retain the full snapshot',()=>{
 const input=targetSnapshotInput('snapshot'),teams=targetSnapshotTeams(input),restore=installTargetSnapshot('snapshot');
 try{for(const team of teams){
  const full=targetSnapshotEvaluator(api,input).evaluate(team,true),partial=targetSnapshotEvaluator(api,{...input,testSnapshotFields:['atk']}).evaluate(team,true),live=targetSnapshotEvaluator(api,{...input,testSnapshotFields:[]}).evaluate(team,true);
  const selected=r=>r.hits.filter(h=>h.statSnapshot);
  for(let i=0;i<5;i++){
   const a=selected(full)[i],b=selected(partial)[i],c=selected(live)[i];
   near(b.atk,a.atk);assert.ok(b.atk>c.atk);near(b.crit,c.crit);near(a.crit,Math.min(1,c.crit+.5));
   near(b.non_critical,a.non_critical);near(b.expectation,b.non_critical*(1+c.crit*b.crit_damage));near(b.non_critical/c.non_critical,b.atk/c.atk);
   assert.equal(b.def,c.def);assert.equal(b.res,c.res);
  }
 }}finally{restore();}
 assert.throws(()=>snapshotEvent({eventId:'bad',statSnapshot:{time:0,fields:['res_minus']}}),/快照字段/);
});

test('typed target observations retain owner and execution cause through probabilities and result serialization',()=>{
 const event={eventId:'x/target/0',time:1,rootOrder:0,role:0,probability:.5},damage=n=>({expectation:n,critical:n*2,non_critical:n}),row=(id,n)=>targetObservation({...event,...damage(n),analysis:{normal:damage(n)}},event,id,'actor/a');
 const a=row(1,10),b=row('1',20);assert.notEqual(a.eventKey,b.eventKey);assert.notEqual(a.eventKey,targetObservation(a,event,1,'actor/b').eventKey);
 assert.equal(a.hitEventId,b.hitEventId);assert.equal(a.sourceActorId,'actor/a');
 const provenance={sourceActorId:'source/b',triggerActorId:'trigger/c',contributors:[{actorId:'source/b'},{actorId:'source/d'}]},shared=targetObservation({...a,...provenance},event,1,'actor/a');
 assert.equal(shared.ownerActorId,'actor/a');for(const [key,value]of Object.entries(provenance))assert.deepEqual(shared[key],value);
 const result=createHitResults(scalarMath,1,{defer:true});result.add(event,damage(30),damage(30),[a,b]);result.finish();
 const value=unpackTeamDpsResult(JSON.parse(JSON.stringify(packTeamDpsResult({hits:result.rows})))),trace=nativeEventTrace(value),rows=teamEventRows(trace);
 assert.equal(trace.events.length,2);assert.equal(result.totals.expectation,15);assert.deepEqual(rows.map(r=>r.event.probability),[.5,.5]);assert.deepEqual(rows.map(r=>r.contributions.expectation),[5,10]);
 assert.deepEqual(rows.map(r=>r.event.states[0].value.analysis.event_probability),[1,1]);
});

test('generic effects reject unsafe multi-target averaging and incorrect linear hints',()=>{
 const event={kind:'hit',eventId:'h',time:1,rootOrder:0,role:0},definition={id:'finite',stage:'damage',target:'self',trigger:{kind:'cast'},duration:5,uses:1,reads:{},value:()=>({CriticalBase:.5})};
 for(const hint of [undefined,'linearFlat']){
  const source={role:0,key:'effect',definition:{...definition,targetAggregation:hint}},plan={sources:[source],schedule:[{kind:'cast',time:0,rootOrder:0,role:0},event],settings:{enemy_count:3,damage_scope:'all'},rotation:{model:'actions',activeRole:()=>0}},state=createEffectState(plan,{math:scalarMath,enabled:()=>1}),resolver=createEffectResolver(plan,state,scalarMath);
  assert.throws(()=>resolver.resolve('damage',0,event),hint?/追加基础伤害/:/逐目标/);
 }
});

test('nonlinear targets and partial snapshots match actual Worker programs with candidate gates and A/B/A',async()=>{
 for(const mode of ['critical','highest','snapshot']){
  const input=targetSnapshotInput(mode);if(mode==='snapshot')input.testSnapshotFields=['atk'];else input.testTargetGate=1;
  const teams=targetSnapshotTeams(input),restore=installTargetSnapshot(mode);let native;
  try{native=teams.map((team,i)=>targetSnapshotEvaluator(api,mode==='snapshot'?input:{...input,testTargetGate:i===0?1:2}).evaluate(team,true));}finally{restore();}
  const worker=new Worker(new URL('./helpers/team-target-snapshot-worker.mjs',import.meta.url));
  try{
   const output=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input,teams,mode});});assert.equal(output.error,undefined,output.error);
   for(let i=0;i<2;i++){near(output.results[i].expectation,native[i].expectation);compareEventValues(output.results[i].eventTrace,nativeEventTrace(native[i]));}assert.deepEqual(output.results[2],output.results[0]);
  }finally{await worker.terminate();}
 }
});

test('target observation identity and candidate state are stable across all 24 party orders',()=>{
 const x=targetSnapshotInput(),team=targetSnapshotTeams(x)[0],restore=installTargetSnapshot('critical');
 try{
  const base=targetSnapshotEvaluator(api,x).evaluate(team,true),identity=r=>hits(r).map(h=>[h.eventKey,h.sourceActorId,h.targetIds]);
  function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}
  for(const order of permutations([0,1,2,3])){
   const y=structuredClone(x);y.single_interfaces=order.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_hp=order.map(i=>x.team_dps.initial_hp[i]);
   const result=targetSnapshotEvaluator(api,y).evaluate(order.map(i=>team[i]),true);near(result.expectation,base.expectation);assert.deepEqual(identity(result),identity(base));
  }
 }finally{restore();}
});

test('per-target critical contacts trigger weapon healing once even when the guaranteed critical target is unscored',()=>{
 const x=targetSnapshotInput(),team=targetSnapshotTeams(x)[0];x.single_interfaces[1].weapon={...x.single_interfaces[1].weapon,name:'TheBlackSword'};x.team_dps.initial_hp=[.3,.3,.3,.3];
 x.team_dps.axis.timeline=x.team_dps.axis.timeline.map(e=>e.actor==='Vodyanitsa'?{...e,actor:'Furina'}:e);
 const restore=installTargetSnapshot('critical');
 try{
  const all=targetSnapshotEvaluator(api,x).evaluate(team,true),single=targetSnapshotEvaluator(api,{...x,team_dps:{...x.team_dps,damage_scope:'single'}}).evaluate(team,true);
  const filter=result=>({...nativeEventTrace(result),events:nativeEventTrace(result).events.filter(e=>['health','heals','effects'].includes(e.channel))});
  compareEventValues(filter(single),filter(all));
  const trace=nativeEventTrace(all),heals=trace.events.filter(e=>e.channel==='heals'&&e.states[0].value.role===1);
  near(heals.reduce((n,e)=>n+e.probability,0),1);assert.ok(heals.every(e=>e.states.every(s=>s.value.time===1)));
  const critical=trace.events.filter(e=>e.channel==='hits'&&e.states[0].value.eventId.startsWith('target-1')&&!e.states[0].value.arkheStrike&&e.states[0].value.targetIds[0]===2);
  near(critical.reduce((n,e)=>n+e.probability,0),1);assert.ok(critical.every(e=>e.states.every(s=>s.value.contacts[0].critical===1)));
 }finally{restore();}
});
