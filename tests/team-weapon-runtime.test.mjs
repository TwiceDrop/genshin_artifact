import test from 'node:test';import assert from 'node:assert/strict';
import {conditionProcClock} from '../beta-data/team-engine/proc-outcomes.mjs';
import {createRuntimeEquipmentEvents,echoesProbabilities} from '../beta-data/equipment-damage-events.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hit=(time,order,extra={})=>({kind:'hit',eventId:'h'+order,time,order,rootOrder:order*100,role:0,onField:true,category:'normal',...extra});
function run(name,events,m=scalarMath){
 const profiles=[{character:{name:name==='Messenger'?'Amber':'Skirk'},weapon:{name,refine:1}}],rotation={slots:['owner'],activeRole:()=>0},out=[];
 const runtime=createRuntimeEquipmentEvents(profiles,rotation,m,{enemy_count:3});
 for(const event of events){runtime.beforeHit(event);runtime.afterEvent(event,e=>out.push(e));}return {out,runtime};
}
test('candidate-gated cooldown posterior agrees with complete independent outcome enumeration',()=>{
 const times=[0,.1,1,2,2.1];
 for(const indexes of [[],[0],[3],[0,3],[1,4]])for(let observation=0;observation<2**indexes.length;observation++){
  const observed=new Map(indexes.map((i,j)=>['t'+i,(observation>>j)&1])),builder=createNumericProgram();
  const symbolic={chance:.4,cooldown:2,trials:times.map((time,i)=>({time,trialKey:'t'+i,enabled:builder.input(i)}))};
  const result=conditionProcClock(symbolic,observed,builder.math),program=builder.finish([result.probability,...result.marginals.values()]);
  for(let mask=0;mask<32;mask++){
   const enabled=times.map((_,i)=>(mask>>i)&1),leaves=[];
   function walk(i,ready,weight,outcomes){
    if(i===times.length){if(indexes.every(j=>outcomes[j]===observed.get('t'+j)))leaves.push({weight,outcomes});return;}
    if(!enabled[i]||times[i]<ready)walk(i+1,ready,weight,[...outcomes,0]);
    else{walk(i+1,ready,weight*.6,[...outcomes,0]);walk(i+1,times[i]+2,weight*.4,[...outcomes,1]);}
   }
   walk(0,-Infinity,1,[]);const weight=leaves.reduce((n,l)=>n+l.weight,0),expected=[weight,...[...result.marginals.keys()].map(key=>weight?leaves.reduce((n,l)=>n+l.weight*l.outcomes[Number(key.slice(1))],0)/weight:0)];
   const scalar=conditionProcClock({...symbolic,trials:symbolic.trials.map((t,i)=>({...t,enabled:enabled[i]}))},observed);
   [scalar.probability,...scalar.marginals.values()].forEach((v,i)=>near(v,expected[i]));executeNumericProgram(program,enabled).forEach((v,i)=>near(v,expected[i]));
  }
 }
});
test('all weapon clocks ignore disabled contacts, including harmonics and burst windows',()=>{
 const names=['Messenger','SkywardSpine','Frostbearer','DragonspineSpear','Halberd','PrizedIsshinBlade','SwordOfNarzissenkreuz','SkywardAtlas','EyeOfPerception','FilletBlade','SwordOfDescension','SkywardBlade','CursedBlade','AshGravenDrinkingHorn','TheFlute'];
 for(const name of names){
  const first=hit(0,0,{enabled:0}),events=[first,...[.1,.6,1.1,1.6,2.1,2.6,3.1].map((t,i)=>hit(t,i+1))];
  if(name==='Messenger')events.forEach(e=>Object.assign(e,{category:'charged',weakpoint:true}));
  if(name==='SkywardBlade')events.unshift({...hit(0,-1),kind:'cast',action:'burst'});
  const a=run(name,events).out,b=run(name,events.filter(e=>e!==first)).out;
  assert.deepEqual(a,b,name);assert.ok(a.length,name);
 }
 const disabled=run('SkywardBlade',[{...hit(0,0),kind:'cast',action:'burst',enabled:0},hit(1,1)]);assert.equal(disabled.out.length,0);
});
test('runtime-only contacts produce delayed children, correlated trials and real target bounces',()=>{
 const source=hit(1,0,{runtimeHit:true}),atlas=run('SkywardAtlas',[source]).out,eye=run('EyeOfPerception',[source]).out;
 assert.equal(atlas.length,6);assert.equal(new Set(atlas.map(e=>e.trialKey)).size,1);assert.ok(atlas.every(e=>e.probability===.5&&e.snapshot.time===1));
 assert.deepEqual(eye.map(e=>e.targetIds),[[0],[1],[2]]);assert.equal(new Set(eye.map(e=>e.eventId)).size,3);
 assert.equal(run('FilletBlade',[{...source,category:'equipment'}]).out.length,0);
});
test('Echoes clocks share scalar/symbolic gates and preserve short success windows',()=>{
 const times=[0,.1,.12,.3,.31,.5],builder=createNumericProgram(),events=times.map((time,i)=>hit(time,i,{enabled:builder.input(i)}));
 const {runtime}=run('DullBlade',events,builder.math),program=builder.finish([...runtime.echoes.values()]);
 for(let mask=0;mask<64;mask++){
  const enabled=times.map((_,i)=>(mask>>i)&1),actual=executeNumericProgram(program,enabled),rows=times.map((time,i)=>hit(time,i,{enabled:enabled[i]})),expected=echoesProbabilities(rows.filter(e=>e.enabled));
  rows.forEach((e,i)=>{if(e.enabled)near(actual[i],expected.get(i));});
 }
});
test('harmonics use five actual contacts and begin a fresh pool after discharge',()=>{
 const events=Array.from({length:11},(_,i)=>hit(i*.5,i,{enabled:i===0?0:1})),out=run('TheFlute',events).out;
 assert.deepEqual(out.map(e=>e.time),[2.5,5]);
 assert.equal(run('TheFlute',[hit(0,0),...Array.from({length:4},(_,i)=>hit(31+i,i+1))]).out.length,0);
});
