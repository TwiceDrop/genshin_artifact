import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
 let computation,deviceReady,endpoint=self;
 async function acquireDevice(){
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  return adapter.requestDevice();
 }
 async function receive({data}){
  try{
   if(data.type==='connect'){
    endpoint=data.port;endpoint.onmessage=receive;endpoint.start();
    // Device acquisition can overlap the coordinator's CPU graph compilation.
    deviceReady=acquireDevice();
    deviceReady.catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
   }
   else if(data.type==='initialize'){
    computation?.dispose();const device=await deviceReady;
    computation=createTeamDpsComputation(data.model,data.artifacts,{device});
    endpoint.postMessage({type:'initialized',kind:computation.kind});
   }else if(data.type==='detail-model'){computation.attachDetails(data.model);}
   else if(data.type==='score'){
    const {results}=await computation.score(data.teams,{detail:data.detail,onProgress:progress=>endpoint.postMessage({type:'progress',data:progress})});
    endpoint.postMessage({type:'scored',results});
   }
  }catch(error){endpoint.postMessage({type:'error',message:error.message,stack:error.stack});}
 }
 self.onmessage=receive;
 self.postMessage({type:'ready'});
