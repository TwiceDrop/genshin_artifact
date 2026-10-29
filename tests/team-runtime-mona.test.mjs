import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {conditionProcClock} from '../beta-data/team-engine/proc-outcomes.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {monaRuntimeInput,runtimeTeams} from './helpers/team-runtime-mona.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const evaluate=(x,team)=>createTeamDpsEvaluator(api,x).evaluate(team??x.single_interfaces.map(p=>p.artifacts),true);

test('conditioned cooldown messages match an independent complete outcome enumeration',()=>{
 const clock={chance:.4,cooldown:2,trials:[0,.1,1,2,2.1,4,4.1,7].map((time,i)=>({time,trialKey:'t'+i}))};
 const leaves=[];
 function walk(i,ready,weight,outcomes){
  if(i===clock.trials.length){leaves.push({weight,outcomes});return;}
  const trial=clock.trials[i];
  if(trial.time<ready)walk(i+1,ready,weight,[...outcomes,0]);
  else {walk(i+1,ready,weight*(1-clock.chance),[...outcomes,0]);walk(i+1,trial.time+clock.cooldown,weight*clock.chance,[...outcomes,1]);}
 }
 walk(0,-Infinity,1,[]);
 for(const indexes of [[],[0],[1],[2,6],[0,3,7],[0,1]])for(let mask=0;mask<2**indexes.length;mask++){
  const observed=new Map(indexes.map((i,j)=>['t'+i,(mask>>j)&1]));
  const allowed=leaves.filter(l=>indexes.every(i=>l.outcomes[i]===observed.get('t'+i))),mass=allowed.reduce((n,l)=>n+l.weight,0);
  const result=conditionProcClock(clock,observed);near(result.probability,mass);
  if(mass)clock.trials.forEach((t,i)=>near(result.marginals.get(t.trialKey),allowed.reduce((n,l)=>n+l.weight*l.outcomes[i],0)/mass));
 }
});

test('runtime Clam pops Mona and crops subsequent healing and damage at candidate completion',()=>{
 for(const name of ['clam-tail','clam-auto']){
  const x=monaRuntimeInput(name),teams=runtimeTeams(x),evaluator=createTeamDpsEvaluator(api,x);
  const first=evaluator.evaluate(teams[0],true),second=evaluator.evaluate(teams[1],true);
  near(first.hits.find(h=>h.monaBubble).time,3+1/60);near(first.duration,name==='clam-tail'?6:3+1/60);
  near(second.hits.find(h=>h.monaBubble).time,9+1/60);near(second.duration,9+1/60);
  assert.ok(first.heals.every(h=>h.time<=first.duration));assert.ok(first.hits.every(h=>h.time<=first.duration));
  assert.equal(evaluator.evaluate(teams[0]).expectation,first.expectation);
  x.team_dps.axis.endHit='exclude';const excluded=evaluate(x);
  assert.ok(excluded.hits.every(h=>h.time<excluded.duration));assert.ok(excluded.heals.every(h=>h.time<excluded.duration));
  if(name==='clam-auto')assert.equal(excluded.hits.some(h=>h.monaBubble),false);
 }
});

test('runtime pop controls Omen expiry and C6 charged state without changing the user axis',()=>{
 const x=monaRuntimeInput('c6-boundary'),before=JSON.stringify(x),teams=runtimeTeams(x);
 const a=evaluate(x,teams[0]),b=evaluate(x,teams[1]);
 const ca=a.hits.find(h=>h.eventId==='ca/charged'),cb=b.hits.find(h=>h.eventId==='ca/charged');
 assert.equal(ca.monaC6Omen,false);assert.equal(cb.monaC6Omen,true);assert.equal(ca.monaC6Stacks,3);assert.equal(cb.monaC6Stacks,3);
 assert.equal(JSON.stringify(x),before);
});

test('random delayed proc branches actual bubble time, duration and live Horn trigger',()=>{
 const out=evaluate(monaRuntimeInput('spine'));
 assert.deepEqual(out.health_branches.map(b=>b.probability),[.5,.5]);
 const times=out.hits.filter(h=>h.monaBubble).map(h=>h.time);
 near(times[0],2/60);near(times[1],8.001+1/60);near(out.duration,(1+8.001+1/60)/2);
 assert.equal(out.hits.filter(h=>h.label==='苍纹角杯·范围伤害').length,2);
 near(out.hits.reduce((n,h)=>n+h.expectation,0),out.expectation);
});

test('all six Atlas children preserve one trial outcome across two Mona bubbles',()=>{
 const out=evaluate(monaRuntimeInput('atlas'));
 assert.deepEqual(out.health_branches.map(b=>b.probability),[.5,.5]);
 const bubbles=out.hits.filter(h=>h.monaBubble);
 assert.equal(bubbles.length,3);
 const early=bubbles.filter(h=>h.branches[0].label.includes('：触发'));
 near(early[0].time,147/60+11/60);near(early[1].time,294/60+11/60);
 assert.ok(bubbles.every(h=>h.branches.length===1&&h.branches[0].probability===.5));
 near(out.hits.reduce((n,h)=>n+h.expectation,0),out.expectation);
});

test('random completion retains each outcome healing and effect trace rather than only the first outcome',()=>{
 const x=monaRuntimeInput('spine');
 x.team_dps.axis.timeline=[
  {id:'e-q',actor:'Escoffier',kind:'action',action:'burst',timeMs:0},
  {id:'e-n',actor:'Escoffier',kind:'action',action:'normal.1',timeMs:1000},
  {id:'m-q',actor:'Mona',kind:'action',action:'burst',timeMs:1001},
  {id:'tail',actor:'Mona',kind:'switch',timeMs:1500},
 ];
 const out=evaluate(x),branches=out.health_branches;
 // The longer outcome also reaches Furina A1's first overheal-triggered tick.
 assert.deepEqual(branches.map(b=>b.heals.length),[5,2]);
 assert.equal(branches[0].heals.filter(h=>h.healing==='furina_a1').length,1);
 near(branches[0].duration,3+1/60);near(branches[1].duration,1.5);
 for(const branch of branches){
  assert.ok(branch.heals.every(h=>h.time<=branch.duration));
  for(const field of ['bonds','effects','resources'])assert.ok(Array.isArray(branch[field]));
 }
});

test('an earlier bubble may trigger a new cast, but a later recast cannot reopen old expiry',()=>{
 const x=monaRuntimeInput('clam-tail');
 x.team_dps.axis.timeline=[{id:'q1',actor:'Mona',kind:'action',action:'burst',timeMs:0,params:{bubbleDelayMs:0}},{id:'q2',actor:'Mona',kind:'action',action:'burst',timeMs:5}];
 const out=evaluate(x),bubbles=out.hits.filter(h=>h.monaBubble);
 assert.equal(bubbles.length,2);near(bubbles[0].time,1/60);near(bubbles[1].time,2/60);near(out.duration,2/60);
 x.team_dps.axis.timeline=[{id:'q1',actor:'Mona',kind:'action',action:'burst',timeMs:0,params:{bubbleDelayMs:0}},{id:'q2',actor:'Mona',kind:'action',action:'burst',timeMs:9000}];
 const preview=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps);
 assert.equal(preview.covered('monaOmen',5,0),false);
});

test('runtime equipment/character chain is invariant under all 24 party permutations',()=>{
 const x=monaRuntimeInput('clam-tail'),baseline=evaluate(x);
 const permutations=xs=>xs.length?xs.flatMap((a,i)=>permutations(xs.filter((_,j)=>i!==j)).map(p=>[a,...p])):[[]];
 for(const p of permutations([0,1,2,3])){
  const changed=structuredClone(x);changed.single_interfaces=p.map(i=>x.single_interfaces[i]);changed.team_dps.axis.members=p.map(i=>x.team_dps.axis.members[i]);
  changed.team_dps.weapon_conditions=p.map(i=>x.team_dps.weapon_conditions[i]);
  const out=evaluate(changed);near(out.expectation,baseline.expectation);near(out.duration,baseline.duration);
  assert.deepEqual(out.hits.map(h=>[h.eventId,h.time,changed.single_interfaces[h.role].character.name]),baseline.hits.map(h=>[h.eventId,h.time,x.single_interfaces[h.role].character.name]));
 }
});
