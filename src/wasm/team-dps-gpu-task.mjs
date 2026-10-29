import {runTeamDpsWorkerTask} from './team-dps-worker-task.mjs';
export const runTeamDpsGpuWorkers=(coordinator,gpu,input,artifacts,options)=>runTeamDpsWorkerTask(coordinator,[gpu],input,artifacts,{...options,mode:'optimize',backend:'gpu',parallelism:128,batchSize:128});
