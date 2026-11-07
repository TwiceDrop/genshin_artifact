import {optimizeTeamDpsParallel} from '../../beta-data/team-dps-optimizer.mjs';
import {createTeamDpsEvaluator,prepareTeamDpsPlan} from '../../beta-data/team-dps-evaluator.mjs';
import {createTeamDpsComputation} from '../../beta-data/team-dps-computation.mjs';
import {compileTeamDpsModel} from './team-dps-model.mjs';
import {createTeamDpsScorePool} from './team-dps-score-pool.mjs';
import('../wasm/team-dps-native-api.mjs').then(api=>{
 const complete=result=>self.postMessage({type:'result',data:result});
 const fail=error=>self.postMessage({type:'error',message:error.message,stack:error.stack});
 const progress=data=>self.postMessage({type:'progress',data});
 self.onmessage=async({data})=>{
  let pool,computation;
  try{
   const {input,artifacts,mode,parallelism,ports,batchSize}=data,started=performance.now();let updated=-Infinity,compileMs=0;
   const total=mode==='evaluate'?1:input.team_dps.max_evaluations;
   let state={phase:'initialize',evaluated_teams:0,total_teams:total,remaining_teams:total,eta_ms:null};
   const update=(patch,force=false)=>{
    const changed=patch.phase&&patch.phase!==state.phase,backendChanged=patch.backendStage&&patch.backendStage!==state.backendStage;
    if(changed)state={...state,segment:undefined,segments:undefined,backendStage:undefined};
    state={...state,...patch};const now=performance.now();
    if(!force&&!changed&&!backendChanged&&now-updated<250)return;
    updated=now;progress({...state,elapsed_ms:now-started-compileMs});
   };
   update({phase:'compile'},true);
   const plan=prepareTeamDpsPlan(input);
   const evaluatorFactory=(api,input,execution={})=>createTeamDpsEvaluator(api,input,{...execution,plan});
   // A fixed-build detail needs only its equipped sets. Optimization compiles
   // all candidates once, retaining observations for baseline and final detail.
   const equipped=new Set(input.team_dps.initial_ids.flat());
   const candidates=mode==='evaluate'?artifacts.filter(a=>equipped.has(a.id)):artifacts;
   const model=compileTeamDpsModel(api,input,candidates,()=>update({phase:'compile'}),evaluatorFactory);
   compileMs=performance.now()-started;
   self.postMessage({type:'compiled',compile_ms:compileMs});
   if(mode==='evaluate'){
    update({phase:'detail'},true);
    computation=createTeamDpsComputation(model,candidates);
    const {results}=await computation.score([input.team_dps.initial_ids],{detail:true,onProgress:p=>update(p)}),row=results[0];
    const equippedRows=input.team_dps.initial_ids.map(ids=>Object.fromEntries(['flower','feather','sand','goblet','head'].map((slot,k)=>[slot,ids[k]])));
    update({phase:'complete',evaluated_teams:1,remaining_teams:0},true);
    complete({results:[{...row,artifacts:equippedRows}],baseline:row,artifacts:[equippedRows],evaluated_teams:1,search_complete:true,metric:input.team_dps.metric,objective:input.team_dps.objective||'damage',elapsed_ms:performance.now()-started-compileMs});return;
   }
   pool=createTeamDpsScorePool(ports,model,artifacts,{batchSize});
   const evaluateDetail=async(team,phase)=>{
    update({phase,eta_ms:null},true);
    const results=await pool.score([team.map(build=>build.map(a=>a.id))],true,p=>update(p));
    return results[0];
   };
   const score=teams=>{update({phase:'search',eta_ms:null},true);return pool.score(teams,false,p=>update(p));};
   const result=await optimizeTeamDpsParallel(api,input,artifacts,score,parallelism,p=>update({...p,segment:undefined,segments:undefined,backendStage:undefined}),evaluatorFactory,{evaluateDetail});
   complete({...result,elapsed_ms:performance.now()-started-compileMs});
  }catch(error){fail(error);}finally{pool?.dispose();computation?.dispose();for(const port of data.ports)port.close();}
 };
 self.postMessage({type:'ready'});
}).catch(error=>self.postMessage({type:'error',message:error.message,stack:error.stack}));
