import test from 'node:test';import assert from 'node:assert/strict';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createStochasticExecutor,executeStochasticBatch} from '../beta-data/team-dps-stochastic-executor.mjs';
import {enumerate} from './helpers/team-dps-path-oracle.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function check(program,input,options){const actual=createStochasticExecutor(program,options).evaluate(input),reference=enumerate(program,input,options);actual.values.forEach((v,i)=>near(v,reference.values[i]));near(actual.stats.weight,1);return actual;}

test('shared and conditional random outcomes preserve nonlinear observations',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('x',b.input(0)),y=b.bernoulli('y',m.choose(x,.8,.2));
 const program=b.finish([x,y,m.mul(x,y),m.min(1,m.add(.9,m.mul(.2,x))),m.max(x,y)]);
 for(const p of [0,.2,.5,1])check(program,[p]);
});
test('dead reward histories merge without erasing their past contribution',()=>{
 const b=createNumericProgram(),m=b.math;let hp=.875,total=0;
 // Binary fractions give a known finite lattice; decimal rounding histories
 // must not be silently merged to meet a state-count assertion.
 for(let i=0;i<12;i++){const x=b.bernoulli('heal/'+i,b.input(0));hp=m.min(1,m.add(hp,m.mul(.25,x)));total=m.add(total,m.mul(i+1,hp));hp=m.sub(hp,.125);}
 const program=b.finish([total,hp]),actual=check(program,[.5]);assert.ok(actual.stats.peakStates<30);assert.ok(actual.stats.merged>100);
});
test('finite pools and success-only cooldown remain in live state',()=>{
 const b=createNumericProgram(),m=b.math;let ready=-Infinity,hp=.9,uses=0,reward=0;
 for(const [i,t]of [0,.1,.2,5,5.1,10,10.2,15,20].entries()){
  const p=m.choose(m.ge(t,ready),m.choose(m.lt(uses,3),b.input(0),0),0),x=b.bernoulli('trial/'+i,p);
  uses=m.add(uses,x);ready=m.choose(x,t+5,ready);hp=m.min(1,m.add(hp,m.mul(.2,x)));reward=m.add(reward,m.mul(hp,uses));hp=m.sub(hp,.07);
 }
 for(const p of [0,.5,1])check(b.finish([hp,uses,ready,reward]),[p]);
});
test('independent linear rewards require no stochastic traversal',()=>{
 const b=createNumericProgram(),m=b.math;let total=0;for(let i=0;i<100;i++)total=m.add(total,b.bernoulli('x/'+i,b.input(0)));
 const executor=createStochasticExecutor(b.finish([total]));assert.equal(executor.plan.draws,0);near(executor.evaluate([.5]).values[0],50);
});
test('candidate A/B/A isolation, deterministic selections and ratio of expectations',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('x',b.input(0)),damage=m.choose(x,100,20),duration=m.choose(x,10,1);
 const program=b.finish([damage,duration,m.div(damage,duration),m.choose(b.input(1),m.div(1,b.input(2)),7)]),options={ratios:[{output:2,numerator:0,denominator:1}]};
 const executor=createStochasticExecutor(program,options),first=executor.evaluate([.5,0,0]);near(first.values[2],60/5.5);check(program,[.5,0,0],options);check(program,[1,1,2],options);assert.deepEqual(executor.evaluate([.5,0,0]),first);
});
test('distinct signed zeros cannot merge before a future reciprocal',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('x',.5),zero=m.choose(x,-0,0),y=b.bernoulli('y',.5);
 check(b.finish([m.choose(y,m.lt(m.div(1,zero),0),0)]),[]);
});
test('different finite floating values do not merge at a later threshold',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('x',.5),value=m.choose(x,.1+.2,.3),y=b.bernoulli('y',.5);
 const result=check(b.finish([m.choose(y,m.gt(value,.3),0)]),[]);assert.equal(result.values[0],.25);
});
test('batch transport preserves each candidate distribution and does not share probability mass',async()=>{
 const b=createNumericProgram(),m=b.math;let hp=b.input(0),reward=0;
 for(let i=0;i<6;i++){const x=b.bernoulli('heal/'+i,b.input(1));hp=m.min(1,m.add(hp,m.mul(.2,x)));reward=m.add(reward,hp);hp=m.sub(hp,.07);}
 const program=b.finish([hp,reward]),executor=createStochasticExecutor(program),data=new Float64Array([.9,.5,.4,1,.9,.5,.1,0]);
 const actual=await executeStochasticBatch(executor,data,4,async(_index,model,inputs,count)=>{
  const out=new Float64Array(model.program.outputs.length*count);
  for(let i=0;i<count;i++)out.set(executeNumericProgram(model.program,inputs.subarray(i*model.stride,(i+1)*model.stride)),i*model.program.outputs.length);return out;
 });
 actual.results.forEach((result,i)=>{const reference=enumerate(program,data.subarray(i*2,i*2+2));result.values.forEach((v,j)=>near(v,reference.values[j]));near(result.stats.weight,1);});
 assert.deepEqual(actual.results[0],actual.results[2]);
});
