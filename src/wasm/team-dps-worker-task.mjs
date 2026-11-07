// The page owns task lifetime. Combat models and intermediate scores stay on
// worker-to-worker ports instead of being deserialized on the page thread.
export function runTeamDpsWorkerTask(coordinator,scorers,input,artifacts,{mode,signal,onProgress,backend,parallelism,batchSize}){
 return new Promise((resolve,reject)=>{
  const workers=[coordinator,...scorers],ready=new Set(),channels=[];let settled=false,compileMs=0;
  const finish=(callback,value)=>{
   if(settled)return;settled=true;
   for(const worker of workers){worker.onmessage=null;worker.onerror=null;worker.terminate();}
   for(const channel of channels){channel.port1.close();channel.port2.close();}
   signal?.removeEventListener('abort',cancel);callback(value);
  };
  const cancel=()=>finish(reject,new DOMException('计算已取消','AbortError'));
  const fail=data=>{const error=new Error(data.message);if(data.stack)error.stack=data.stack;finish(reject,error);};
  function start(){
   try{
    for(const worker of scorers){const channel=new MessageChannel();channels.push(channel);worker.postMessage({type:'connect',port:channel.port2},[channel.port2]);}
    const ports=channels.map(channel=>channel.port1);
    coordinator.postMessage({input,artifacts,mode,parallelism,batchSize,ports},ports);
   }catch(error){fail(error);}
  }
  for(const worker of workers){
   worker.onerror=fail;
   worker.onmessage=({data})=>{
    if(settled)return;
    if(data.type==='ready'){ready.add(worker);if(ready.size===workers.length)start();}
    if(data.type==='compiled')compileMs=data.compile_ms;
    if(data.type==='progress')onProgress?.({...data.data,elapsed_ms:data.data.elapsed_ms+compileMs});
    if(data.type==='result')finish(resolve,{...data.data,elapsed_ms:data.data.elapsed_ms+compileMs,compile_ms:compileMs,compute_backend:backend});
    if(data.type==='error')fail(data);
   };
  }
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 });
}
