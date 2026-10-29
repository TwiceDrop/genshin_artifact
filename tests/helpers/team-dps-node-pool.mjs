import {Worker} from 'node:worker_threads';
import {runTeamDpsWorkers} from '../../src/wasm/team-dps-task.mjs';
class BrowserWorker{
 constructor(workerData){
  this.worker=new Worker(new URL('./team-dps-node-worker.mjs',import.meta.url),{workerData});
  this.worker.on('message',data=>this.onmessage?.({data}));
  this.worker.on('error',error=>this.onerror?.(error));
 }
 postMessage(data,transfer){this.worker.postMessage(data,transfer);}
 terminate(){this.termination=this.worker.terminate();}
}
export function nodeTeamDps(input,artifacts,{threads=4,original,mode='optimize',...options}={}){
 const coordinator=new BrowserWorker({original}),scorers=Array.from({length:mode==='optimize'?threads:1},()=>new BrowserWorker({scorer:true}));
 return runTeamDpsWorkers(coordinator,scorers,input,artifacts,{...options,mode});
}
