export function runTeamDpsGpuWorkers(coordinator,gpu,input,artifacts,{signal,onProgress}){
 return new Promise((resolve,reject)=>{
  let settled=false,searchReady=false,gpuReady=false,compileMs=0;
  const finish=(callback,value)=>{
   if(settled)return;settled=true;
   for(const worker of [coordinator,gpu]){worker.onmessage=null;worker.onerror=null;worker.terminate();}
   signal?.removeEventListener('abort',cancel);callback(value);
  };
  const cancel=()=>finish(reject,new DOMException('计算已取消','AbortError'));
  const fail=data=>{const error=new Error(data.message);if(data.stack)error.stack=data.stack;finish(reject,error);};
  const begin=()=>{if(searchReady&&gpuReady)coordinator.postMessage({input,artifacts,mode:'optimize',parallelism:128});};
  coordinator.onmessage=({data})=>{
   if(settled)return;
   if(data.type==='ready'){searchReady=true;begin();}
   if(data.type==='score')gpu.postMessage({type:'score',teams:data.teams});
   if(data.type==='progress')onProgress?.({...data.data,elapsed_ms:data.data.elapsed_ms+compileMs});
   if(data.type==='result')finish(resolve,{...data.data,elapsed_ms:data.data.elapsed_ms+compileMs,compute_backend:'gpu',compile_ms:compileMs});
   if(data.type==='error')fail(data);
  };
  gpu.onmessage=({data})=>{
   if(settled)return;
   if(data.type==='ready')gpu.postMessage({type:'initialize',input,artifacts});
   if(data.type==='initialized'){gpuReady=true;compileMs=data.compile_ms;begin();}
   if(data.type==='scored')coordinator.postMessage(data);
   if(data.type==='progress')onProgress?.(data.data);
   if(data.type==='error')fail(data);
  };
  coordinator.onerror=fail;gpu.onerror=fail;
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 });
}
