import {runTeamDpsWorkerTask} from './team-dps-worker-task.mjs';
export const runTeamDpsWorkers=(coordinator,scorers,input,artifacts,options)=>runTeamDpsWorkerTask(coordinator,scorers,input,artifacts,{...options,backend:'cpu',parallelism:scorers.length,batchSize:1});
