import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
 let computation,device,endpoint=self;
 async function receive({data}){
  try{
   if(data.type==='connect'){endpoint=data.port;endpoint.onmessage=receive;endpoint.start();}
   else if(data.type==='initialize'){
    computation?.dispose();device?.destroy();const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});device=await adapter.requestDevice();
    computation=createTeamDpsComputation(data.model,data.artifacts,{device});
    endpoint.postMessage({type:'initialized',kind:computation.kind});
   }else if(data.type==='detail-model'){computation.attachDetails(data.model);}
   else if(data.type==='score'){
    const {results}=await computation.score(data.teams,{detail:data.detail});
    endpoint.postMessage({type:'scored',results});
   }
  }catch(error){endpoint.postMessage({type:'error',message:error.message,stack:error.stack});}
 }
 self.onmessage=receive;
 self.postMessage({type:'ready'});
