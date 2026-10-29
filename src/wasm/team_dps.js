import {runTeamDpsWorkers} from './team-dps-task.mjs';
import {runTeamDpsGpuWorkers} from './team-dps-gpu-task.mjs';
export function teamDps(input,artifacts,{mode='optimize',signal,onProgress,threads}={}){
 const count=mode==='optimize'?(threads??Math.min(4,Math.max(1,navigator.hardwareConcurrency-1))):1;
 const worker=new Worker(new URL('@worker/team_dps.js',import.meta.url));
 if(mode==='optimize'&&input.team_dps.compute_backend==='gpu'){
  const gpu=new Worker(new URL('@worker/team_dps_gpu.js',import.meta.url));
  return runTeamDpsGpuWorkers(worker,gpu,input,artifacts,{signal,onProgress});
 }
 const scorers=Array.from({length:count},()=>new Worker(new URL('@worker/team_dps_score.js',import.meta.url)));
 return runTeamDpsWorkers(worker,scorers,input,artifacts,{mode,signal,onProgress});
}
