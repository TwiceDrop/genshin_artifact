// One coordinator owns search order; scoring workers own independent evaluator/WASM state.
export function runTeamDpsWorkers(coordinator,scorers,input,artifacts,{mode,signal,onProgress}){
 return new Promise((resolve,reject)=>{
  const workers=[coordinator,...scorers],states=scorers.map(worker=>({worker,ready:false,index:-1}));
  let settled=false,queue=[],results=[],received=0;
  const finish=(callback,value)=>{
   if(settled)return;settled=true;
   for(const worker of workers){worker.onmessage=null;worker.onerror=null;worker.terminate();}
   signal?.removeEventListener('abort',cancel);callback(value);
  };
  const cancel=()=>finish(reject,new DOMException('计算已取消','AbortError'));
  const fail=data=>{const error=new Error(data.message);if(data.stack)error.stack=data.stack;finish(reject,error);};
  function dispatch(state){
   if(!state.ready||!queue.length)return;
   const job=queue.shift();state.ready=false;state.index=job.index;
   state.worker.postMessage({type:'score',ids:job.ids});
  }
  for(const state of states){
   state.worker.onmessage=({data})=>{
    if(settled)return;
    if(data.type==='ready')state.worker.postMessage({type:'initialize',input,artifacts});
    if(data.type==='initialized'){state.ready=true;dispatch(state);}
    if(data.type==='scored'){
     results[state.index]=data.result;state.ready=true;received++;
     if(received===results.length)coordinator.postMessage({type:'scored',results});
     else dispatch(state);
    }
    if(data.type==='error')fail(data);
   };
  }
  coordinator.onmessage=({data})=>{
   if(settled)return;
   if(data.type==='ready')coordinator.postMessage({input,artifacts,mode,parallelism:scorers.length});
   if(data.type==='score'){
    results=new Array(data.teams.length);received=0;
    queue=data.teams.map((ids,index)=>({ids,index}));
    for(const state of states)dispatch(state);
   }
   if(data.type==='progress')onProgress?.(data.data);
   if(data.type==='result')finish(resolve,data.data);
   if(data.type==='error')fail(data);
  };
  for(const worker of workers)worker.onerror=fail;
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
 });
}
