import {optimizeTeamDpsParallel} from '../../beta-data/team-dps-optimizer.mjs';
import {compileTeamDpsModel} from './team-dps-model.mjs';
import {createTeamDpsScorePool} from './team-dps-score-pool.mjs';
import('../wasm/team-dps-native-api.mjs').then(api=>{
 const complete=result=>self.postMessage({type:'result',data:result});
 const fail=error=>self.postMessage({type:'error',message:error.message,stack:error.stack});
 const progress=data=>self.postMessage({type:'progress',data});
 self.onmessage=async({data})=>{
  let pool;
  try{
   const {input,artifacts,mode,parallelism,ports,batchSize}=data,started=performance.now();let updated=-Infinity;
   const onProgress=()=>{const now=performance.now();if(now-updated<250)return;updated=now;progress({phase:'compile',evaluated_teams:0,total_teams:input.team_dps.max_evaluations,remaining_teams:input.team_dps.max_evaluations,elapsed_ms:now-started,eta_ms:null});};
   const model=compileTeamDpsModel(api,input,artifacts,onProgress),compileMs=performance.now()-started;
   self.postMessage({type:'compiled',compile_ms:compileMs});
   pool=createTeamDpsScorePool(ports,model,artifacts,{batchSize});
   const batch=(teams,detail=false)=>pool.score(teams,detail);
   const evaluateDetail=team=>batch([team.map(build=>build.map(a=>a.id))],true).then(rows=>rows[0]);
   if(mode==='evaluate'){
    const [result]=await batch([input.team_dps.initial_ids],true),entries=input.team_dps.initial_ids.map(ids=>Object.fromEntries(['flower','feather','sand','goblet','head'].map((slot,i)=>[slot,ids[i]])));
    complete({results:[{...result,artifacts:entries}],baseline:result,artifacts:[entries],evaluated_teams:1,search_complete:true,elapsed_ms:performance.now()-started-compileMs,metric:input.team_dps.metric,objective:input.team_dps.objective||'damage'});
   }else complete(await optimizeTeamDpsParallel(api,input,artifacts,teams=>batch(teams),parallelism,progress,undefined,{evaluateDetail}));
  }catch(error){fail(error);}finally{pool?.dispose();for(const port of data.ports)port.close();}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
