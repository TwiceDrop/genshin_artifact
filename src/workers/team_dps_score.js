import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
let computation,endpoint=self;
 async function receive({data}){
  try{
   if(data.type==='connect'){endpoint=data.port;endpoint.onmessage=receive;endpoint.start();}
   else if(data.type==='initialize'){
    computation?.dispose();computation=createTeamDpsComputation(data.model,data.artifacts);
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
