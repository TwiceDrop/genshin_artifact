import {optimizeTeamDps,optimizeTeamDpsParallel,evaluateTeamDps} from '../../beta-data/team-dps-optimizer.mjs';
import('mona').then(api=>{
 let receiveScores;
 const complete=result=>self.postMessage({type:'result',data:result});
 const fail=error=>self.postMessage({type:'error',message:error.message,stack:error.stack});
 const progress=data=>self.postMessage({type:'progress',data});
 self.onmessage=e=>{
  if(e.data.type==='scored'){receiveScores(e.data.results);return;}
  try{
   const {input,artifacts,mode,parallelism}=e.data;
   if(mode==='optimize'&&parallelism>1){
    const batch=teams=>new Promise(resolve=>{receiveScores=resolve;self.postMessage({type:'score',teams});});
    optimizeTeamDpsParallel(api,input,artifacts,batch,parallelism,progress).then(complete,fail);
   }else complete(mode==='evaluate'?evaluateTeamDps(api,input,artifacts):optimizeTeamDps(api,input,artifacts,progress));
  }catch(error){fail(error);}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
