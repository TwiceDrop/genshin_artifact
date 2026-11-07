import test from 'node:test';import assert from 'node:assert/strict';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createCpuNumericExecutor} from '../beta-data/team-dps-cpu-numeric.mjs';
import {createStochasticExecutor} from '../beta-data/team-dps-stochastic-executor.mjs';
const exact=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Object.is(v,b[i]),`${i}: ${v} != ${b[i]}`));};
test('all arithmetic, comparison and selection operations preserve IEEE values',()=>{
 const b=createNumericProgram(),m=b.math,a=b.input(0),c=b.input(1),d=b.input(2),outputs=Object.entries(m).map(([name,op])=>op(...(name==='choose'?[a,c,d]:['abs','floor'].includes(name)?[a]:[a,c]))),program=b.finish(outputs),cpu=createCpuNumericExecutor(program);
 const values=[0,-0,1,-1,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,Infinity,-Infinity,NaN,1.0000000000000002,2**53];
 for(const a of values)for(const c of values){const input=[a,c,-3.25];exact(cpu.evaluate(input),executeNumericProgram(program,input));}
});
test('literal values never enter generated source, including signed zero and nonfinite values',()=>{
 const b=createNumericProgram(),values=[-0,Infinity,-Infinity,NaN,Number.MIN_VALUE],program=b.finish(values);exact(createCpuNumericExecutor(program).evaluate([]),executeNumericProgram(program,[]));
 globalThis.__numericInjection=0;
 const malicious={nodes:[{op:'literal',args:[],value:'globalThis.__numericInjection=1'}],outputs:[0]};assert.throws(()=>createCpuNumericExecutor(malicious),/Invalid numeric literal/);assert.equal(globalThis.__numericInjection,0);delete globalThis.__numericInjection;
});
test('register reuse, repeated arguments and duplicate outputs preserve dependencies',()=>{
 const b=createNumericProgram(),m=b.math,a=b.input(0),c=b.input(1),x=m.mul(a,a),y=m.add(x,c),z=m.sub(y,x),program=b.finish([z,x,y,x,m.choose(a,z,y)]),cpu=createCpuNumericExecutor(program);
 for(const input of [[1,3],[0,-0],[1e16,-1e16],[-2,Infinity]])exact(cpu.evaluate(input),executeNumericProgram(program,input));
});
test('batch input and output offsets do not leak between candidates or overwrite other output cells',()=>{
 const b=createNumericProgram(),m=b.math,a=b.input(0),c=b.input(1),program=b.finish([m.mul(a,c),m.div(a,c)]),cpu=createCpuNumericExecutor(program),input=new Float64Array([99,2,4,0,7,-3,-0,1,8]),out=new Float64Array(12).fill(17);
 assert.equal(cpu.evaluateBatch(input,2,4,out,3,1),out);exact(out.subarray(3,7),[8,.5,0,Infinity]);assert.ok([...out.subarray(0,3),...out.subarray(7)].every(v=>v===17));
 exact(cpu.evaluate([5,2]),[10,2.5]);exact(cpu.evaluate([-1,2]),[-2,-.5]);
});
test('compilation does not reassociate additions or fuse multiply-add',()=>{
 const b=createNumericProgram(),m=b.math,a=b.input(0),c=b.input(1),d=b.input(2),program=b.finish([m.add(m.add(a,c),d),m.add(m.mul(a,c),d)]),cpu=createCpuNumericExecutor(program);
 for(const input of [[1e16,1,-1e16],[1+2**-27,1-2**-27,-1],[2**-1022,.5,0]])exact(cpu.evaluate(input),executeNumericProgram(program,input));
});
test('seeded irregular graphs match the independent instruction interpreter exactly',()=>{
 let seed=9173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let sample=0;sample<5;sample++){
  const b=createNumericProgram(),refs=Array.from({length:8},(_,i)=>b.input(i)),ops=Object.keys(b.math);
  for(let i=0;i<1000;i++){const op=ops[random()%ops.length],arity=op==='choose'?3:['abs','floor'].includes(op)?1:2;refs.push(b.math[op](...Array.from({length:arity},()=>refs[random()%refs.length])));}
  const program=b.finish(refs.slice(-40)),cpu=createCpuNumericExecutor(program);
  for(let i=0;i<30;i++){const input=Array.from({length:8},()=>((random()%1000)-500)/32);exact(cpu.evaluate(input),executeNumericProgram(program,input));}
 }
});
test('unsupported operations and source-like input indices fail explicitly',()=>{
 assert.throws(()=>createCpuNumericExecutor({nodes:[{op:'input',args:[],value:'0];globalThis.x=1;//'}],outputs:[0]}),/Invalid numeric input/);
 assert.throws(()=>createCpuNumericExecutor({nodes:[{op:'unrecognized',args:[]}],outputs:[0]}),/Unsupported CPU/);
});
test('empty programs and constant-only batches retain their output shape',()=>{
 exact(createCpuNumericExecutor({nodes:[],outputs:[]}).evaluate([]),[]);
 const b=createNumericProgram(),program=b.finish([2,-0]);exact(createCpuNumericExecutor(program).evaluateBatch([],3,0),[2,-0,2,-0,2,-0]);
});
test('segment kernels are reused across candidates and can be released explicitly',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('x',b.input(0)),executor=createStochasticExecutor(b.finish([m.mul(x,x)]));
 const first=executor.evaluate([.3]),cached=executor.cpuStats();assert.ok(cached.length>0);executor.evaluate([.7]);assert.deepEqual(executor.cpuStats(),cached);
 executor.clearCpuCache();assert.deepEqual(executor.cpuStats(),[]);assert.deepEqual(executor.evaluate([.3]),first);
});
