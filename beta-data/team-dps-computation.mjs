import {createCpuNumericExecutor} from './team-dps-cpu-numeric.mjs';
import {createWebGpuNumericExecutor} from './team-dps-webgpu.mjs';
import {createTeamProgramCodec,createTeamDpsScoreModel} from './team-dps-program.mjs';
import {createStochasticScorer} from './team-dps-stochastic-scorer.mjs';

// Ranking and detailed observations share one immutable combat expression.
export function createTeamDpsComputation(model,artifacts,{device,maxStateRows=Infinity,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const scoringModel=createTeamDpsScoreModel(model),program=scoringModel.program,stochastic=program.nodes.some(node=>node.op==='bernoulli'),codec=createTeamProgramCodec(scoringModel,artifacts),scorers=new Map();
 let direct,detailModel=model.eventTrace?model:undefined;
 return {
  kind:stochastic?'stochastic':'direct',
  async score(teams,{detail=false,trajectory=false,signal,onProgress=()=>{}}={}){
   signal?.throwIfAborted();
   if(stochastic||detail||trajectory){
    const key=trajectory?'trajectory':detail?'detail':'score';
    if(!scorers.has(key))scorers.set(key,createStochasticScorer(key==='score'?scoringModel:detailModel,artifacts,{device,trace:detail||trajectory,trajectory,maxStateRows,yieldControl}));
    const result=await scorers.get(key).score(teams,{signal,onProgress});return {...result,stats:{...result.stats,kind:'stochastic'}};
   }
   if(!direct)direct=device?await createWebGpuNumericExecutor(device,program):createCpuNumericExecutor(program);
   const input=codec.encode(teams),stride=4*scoringModel.stride,width=program.outputs.length,values=new Float64Array(teams.length*width);
   const limit=device?Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize):Infinity;
   const capacity=Math.min(maxStateRows,device?Math.min(Math.floor(limit/(8*Math.max(direct.stats.registers,stride,width))),device.limits.maxComputeWorkgroupsPerDimension*64):64);
   if(capacity<1)throw Error('单个队伍的数值程序超过GPU缓冲限制');
   let numericBatches=0,yieldAt=performance.now()+16;
   for(let row=0;row<teams.length;row+=capacity){
    signal?.throwIfAborted();const count=Math.min(capacity,teams.length-row),data=input.subarray(row*stride,(row+count)*stride);numericBatches++;
    if(device)values.set(await direct.evaluate(data,count),row*width);else direct.evaluateBatch(data,count,stride,values,row*width);
    if(performance.now()>=yieldAt){await yieldControl();yieldAt=performance.now()+16;}signal?.throwIfAborted();
   }
   return {results:codec.decode(values,teams.length),stats:{kind:'direct',numericBatches,candidates:teams.length}};
  },
  attachDetails(nextModel){for(const key of ['detail','trajectory']){scorers.get(key)?.dispose();scorers.delete(key);}detailModel=nextModel;},
  dispose(){direct?.destroy?.();direct=undefined;for(const scorer of scorers.values())scorer.dispose();scorers.clear();},
 };
}
