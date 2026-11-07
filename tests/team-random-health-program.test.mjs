import test from 'node:test';import assert from 'node:assert/strict';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {lowerExpectedProgram} from '../beta-data/team-dps-expectation-program.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createOutcomeChoices} from '../beta-data/team-engine/outcome-choices.mjs';
import {ProcOutcomeRequired} from '../beta-data/team-engine/proc-outcomes.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function exhaustive(program,inputs){
 const draws=program.nodes.filter(n=>n.op==='bernoulli').length,result=program.outputs.map(()=>0);
 for(let mask=0;mask<2**draws;mask++){
  let index=0,weight=1;const values=[];
  for(const node of program.nodes){
   const args=node.args.map(i=>values[i]);let value;
   if(node.op==='bernoulli'){value=(mask>>index++)&1;weight*=value?args[0]:1-args[0];}
   else value=node.op==='input'?inputs[node.value]:node.op==='literal'?node.value:Number(scalarMath[node.op](...args));
   values.push(value);
  }
  if(weight)program.outputs.forEach((id,i)=>result[i]+=weight*values[id]);
 }
 return result;
}
function check(builder,outputs,inputs){
 const raw=builder.finish(outputs),lowered=lowerExpectedProgram(raw),expected=exhaustive(raw,inputs),actual=executeNumericProgram(lowered.program,inputs);
 actual.forEach((value,i)=>near(value,expected[i]));return {actual,...lowered};
}
test('health clipping and repeated reads preserve one shared outcome',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('heal',b.input(0));
 const result=check(b,[m.min(1,m.add(.9,m.mul(.2,x))),m.mul(x,x),m.gt(m.add(m.mul(.2,x),m.mul(.2,x)),.3)],[.5]);
 assert.deepEqual(result.actual,[.95,.5,.5]);
});
test('candidate-valued conditional draws retain correlations',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('first',b.input(0)),y=b.bernoulli('second',m.choose(x,.8,.2));
 const outputs=[x,y,m.mul(x,y),m.min(.6,m.add(m.mul(.4,x),m.mul(.4,y)))];
 for(const p of [0,.25,.5,1])check(b,outputs,[p]);
});
test('finite critical-healing uses and health feedback agree with independent path enumeration',()=>{
 const b=createNumericProgram(),m=b.math;let uses=0,hp=b.input(0),fanfare=0;
 for(let i=0;i<9;i++){
  const chance=m.choose(m.lt(uses,7),m.choose(m.lt(hp,.95),b.input(1),b.input(2)),0),crit=b.bernoulli('critical-heal/'+i,chance);
  uses=m.add(uses,crit);const next=m.min(1,m.add(hp,m.mul(.08,m.add(1,crit))));fanfare=m.add(fanfare,m.sub(next,hp));hp=m.max(0,m.sub(next,.06));
 }
 for(const inputs of [[.9,.5,.8],[.2,0,1],[1,1,0]])check(b,[hp,uses,fanfare],[...inputs]);
});
test('random healing cooldown tracks actual success rather than its mean time',()=>{
 const b=createNumericProgram(),m=b.math;let ready=-Infinity,hp=.9,total=0;
 for(const [i,time]of [0,.1,.2,5,5.1].entries()){
  const success=b.bernoulli('black/'+i,m.choose(m.ge(time,ready),b.input(0),0));
  ready=m.choose(success,time+5,ready);const next=m.min(1,m.add(hp,m.mul(.2,success)));total=m.add(total,m.sub(next,hp));hp=m.sub(next,.03);
 }
 for(const p of [0,.5,1])check(b,[hp,total],[p]);
});
test('zero-probability unreachable arithmetic does not poison the expectation',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('x',b.input(0));
 const result=lowerExpectedProgram(b.finish([m.choose(x,m.div(1,b.input(1)),7)]));
 assert.deepEqual(executeNumericProgram(result.program,[0,0]),[7]);
 assert.deepEqual(executeNumericProgram(result.program,[1,2]),[.5]);
});
test('scalar choices count each observation once and preserve conditional path weights',()=>{
 assert.throws(()=>createOutcomeChoices(scalarMath).draw('unknown',.5),ProcOutcomeRequired);
 let total=0,joint=0;
 for(const first of [0,1])for(const second of [0,1]){
  const choices=createOutcomeChoices(scalarMath,new Map([['first',first],['second',second]]));
  assert.equal(choices.draw('first',.25),first);assert.equal(choices.draw('first',.25),first);
  assert.equal(choices.draw('second',first?.8:.2),second);
  near(choices.weight,(first?.25:.75)*(second?(first?.8:.2):(first?.2:.8)));total+=choices.weight;joint+=choices.weight*first*second;
 }
 near(total,1);near(joint,.2);
});
test('independent linear rewards avoid enumerating a hundred random outcomes',()=>{
 const b=createNumericProgram(),p=b.input(0);let reward=0;
 for(let i=0;i<100;i++)reward=b.math.add(reward,b.bernoulli('reward/'+i,p));
 const lowered=lowerExpectedProgram(b.finish([reward]));near(executeNumericProgram(lowered.program,[.5])[0],50);assert.ok(lowered.program.nodes.length<150);
});
