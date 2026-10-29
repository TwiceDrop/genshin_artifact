import {createTeamProgramCodec} from './team-dps-program.mjs';
import {createStochasticExecutor,executeStochasticBatch} from './team-dps-stochastic-executor.mjs';
import {createWebGpuNumericExecutor} from './team-dps-webgpu.mjs';
import {decodeEventTrace} from './team-dps-event-trace.mjs';

// The compiled combat plan is immutable. Each score call owns its distributions,
// while numerical segment executors are reused across candidates and calls.
export function createStochasticScorer(model,artifacts,{device,trace=!!model.eventTrace,trajectory=false,maxStateRows=Infinity,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const n=model.program.outputs.length,executor=createStochasticExecutor(model.program,{ratios:[{output:n-1,numerator:0,denominator:n-2}],trace:trace?model.eventTrace.groups:[],trajectory}),codec=createTeamProgramCodec(model,artifacts),backends=new Map();
 const check=signal=>signal?.throwIfAborted();
 return {
  plan:executor.plan,
  async score(teams,{signal,onProgress=()=>{}}={}){
   check(signal);const encoded=codec.encode(teams);let segments=0,numericBatches=0,yieldAt=performance.now()+16;
   const result=await executeStochasticBatch(executor,encoded,teams.length,async(index,segment,inputs,count)=>{
    check(signal);const width=segment.program.outputs.length,out=new Float64Array(count*width);let chunk=Math.min(64,maxStateRows),backend;
    if(device){
     if(!backends.has(index)){
      const backend=await createWebGpuNumericExecutor(device,segment.program),registers=backend.stats.registers,limit=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize);
      const capacity=Math.min(maxStateRows,Math.floor(limit/(8*Math.max(registers,segment.stride,width))),device.limits.maxComputeWorkgroupsPerDimension*64);
      if(capacity<1){backend.destroy();throw Error('单个精确状态的数值程序超过GPU缓冲限制');}
      backends.set(index,{executor:backend,capacity});
     }
     const cached=backends.get(index);backend=cached.executor;chunk=cached.capacity;
    }
    for(let row=0;row<count;row+=chunk){
     check(signal);numericBatches++;const length=Math.min(chunk,count-row),data=inputs.subarray(row*segment.stride,(row+length)*segment.stride);
     if(backend)out.set(await backend.evaluate(data,length),row*width);
     else executor.runCpuSegment(index,data,length,out,row*width);
     check(signal);if(performance.now()>=yieldAt){await yieldControl();yieldAt=performance.now()+16;check(signal);}
    }
    segments++;onProgress({segment:index+1,segments:executor.models.length,stateRows:count});return out;
   });
   check(signal);
   const values=new Float64Array(result.results.flatMap(row=>row.values));
   const decoded=codec.decode(values,teams.length);
   if(trace)decoded.forEach((row,i)=>row.eventTrace=decodeEventTrace(model.eventTrace,result.results[i].trace));
   if(trajectory)decoded.forEach((row,i)=>row.trajectory={trajectory:result.results[i].trajectory,trace:result.results[i].trace});
   return {results:decoded,stats:{segments,numericBatches,peakStateRows:result.peakRows,candidates:result.results.map(row=>row.stats)}};
  },
  dispose(){for(const backend of backends.values())backend.executor.destroy();backends.clear();executor.clearCpuCache();},
 };
}
