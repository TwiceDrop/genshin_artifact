import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {api} from '../beta-tools/runtime-7106.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {runtimeGates,runtimeOracle} from './helpers/skirk-runtime-gates.mjs';
import {gatedSkirkEvaluator} from './helpers/skirk-runtime-evaluator.mjs';
import {skirkRuntimeInput} from './helpers/skirk-runtime-input.mjs';
import {nativeEventTrace,compareEventValues,compareTeamResults} from './helpers/team-dps-result-comparison.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('resource timers and both burst forms match an independent frame oracle for 64 gates at C0 and C2',()=>{
 for(const cons of [0,2]){
  const b=createNumericProgram(),m=createNativeGraphCompiler(b,{funcs:{},table:[]}).math,program=b.finish(runtimeGates(m,Array.from({length:6},(_,i)=>b.input(i)),cons).outputs);
  for(let mask=0;mask<64;mask++){
   const inputs=Array.from({length:6},(_,i)=>(mask>>i)&1),expected=runtimeOracle(inputs,cons);
   runtimeGates(scalarMath,inputs,cons).outputs.forEach((v,i)=>near(v,expected[i]));executeNumericProgram(program,inputs).forEach((v,i)=>near(v,expected[i]));
  }
 }
});
test('candidate-valued resources reach native burst talent terms and choose form/duration in the actual Worker',async()=>{
 for(const mode of ['bonus','form','form-c2']){
  const {input,teams}=skirkRuntimeInput(mode),native=teams.map((team,i)=>gatedSkirkEvaluator(api,{...input,testCommandEnabled:i===0?1:0}).evaluate(team,true));
  if(mode==='bonus'){assert.equal(native[0].hits.find(h=>h.skirkBurst).cunning,98);assert.equal(native[1].hits.find(h=>h.skirkBurst).cunning,53);}
  else{assert.equal(native[0].hits.filter(h=>h.skirkBurst).length,0);assert.equal(native[1].hits.filter(h=>h.skirkBurst).length,6);assert.ok(native[0].duration<native[1].duration);}
  const worker=new Worker(new URL('./helpers/skirk-runtime-worker.mjs',import.meta.url));
  try{
   const output=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({input,teams});});assert.equal(output.error,undefined,output.error);
   for(const [i,result]of output.results.slice(0,2).entries()){near(result.expectation,native[i].expectation);near(result.duration,native[i].duration);compareEventValues(result.eventTrace,nativeEventTrace(native[i]));}
   compareTeamResults(output.results[0],output.results[2]);
  }finally{await worker.terminate();}
 }
});
