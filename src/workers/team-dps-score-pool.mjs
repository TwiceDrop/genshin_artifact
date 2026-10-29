import {createTeamDpsScoreModel} from '../../beta-data/team-dps-program.mjs';
// One compilation, one scoring projection per pool. Completion
// order may vary; every batch is assembled in the original candidate order.
export function createTeamDpsScorePool(ports,model,artifacts,{batchSize=1}={}){
 // A single scorer necessarily handles baseline and final details. Give it
 // the full model directly; only multi-worker pools benefit from lazy copies.
 const single=ports.length===1,scoreModel=single?model:createTeamDpsScoreModel(model),states=ports.map(port=>({port,ready:false,hasDetails:single,job:null})),pending=new Set();let queue=[],failure,detailOwner=single?states[0]:undefined;
 function fail(error){failure=error;queue=[];for(const request of pending)request.reject(error);pending.clear();}
 function dispatch(state){
  if(!state.ready||!queue.length)return;
  if(queue[0].detail&&detailOwner&&detailOwner!==state)return;
  const job=queue.shift();state.ready=false;state.job=job;
  try{
   if(job.detail&&!state.hasDetails){detailOwner=state;state.port.postMessage({type:'detail-model',model});state.hasDetails=true;}
   state.port.postMessage({type:'score',teams:job.teams,detail:job.detail});
  }catch(error){fail(error);}
 }
 for(const state of states){
  state.port.onmessage=({data})=>{
   if(failure)return;
   if(data.type==='error'){const error=new Error(data.message);if(data.stack)error.stack=data.stack;fail(error);return;}
   if(data.type==='initialized'){state.ready=true;dispatch(state);}
   if(data.type==='scored'){
    const {request,start}=state.job;for(let i=0;i<data.results.length;i++)request.results[start+i]=data.results[i];
    state.job=null;state.ready=true;
    if(--request.remaining===0){pending.delete(request);request.resolve(request.results);}
    dispatch(state);
   }
  };
  state.port.onmessageerror=()=>fail(new Error('评分 Worker 消息无法解码'));
  state.port.start();state.port.postMessage({type:'initialize',model:scoreModel,artifacts});
 }
 return {
  score(teams,detail=false){
   if(failure)return Promise.reject(failure);if(!teams.length)return Promise.resolve([]);
   return new Promise((resolve,reject)=>{
    const request={resolve,reject,results:new Array(teams.length),remaining:Math.ceil(teams.length/batchSize)};pending.add(request);
    for(let start=0;start<teams.length;start+=batchSize)queue.push({request,start,teams:teams.slice(start,start+batchSize),detail});
    for(const state of states)dispatch(state);
   });
  },
  dispose(){fail(new DOMException('计算已取消','AbortError'));for(const state of states){state.port.onmessage=null;state.port.onmessageerror=null;state.port.close();}},
 };
}
