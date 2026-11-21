// The page owns task lifetime. Combat models and intermediate scores stay on
// worker-to-worker ports instead of being deserialized on the page thread.
// Keep one successful timing per execution path, only for this page session.
const previousTimings=new Map();
export function runTeamDpsWorkerTask(coordinator,scorers,input,artifacts,{mode,signal,onProgress,backend,parallelism,batchSize}){
 return new Promise((resolve,reject)=>{
  const path=[mode,backend,parallelism].join('/'),key=JSON.stringify([input,artifacts]);
  const previous=previousTimings.get(path),timing=previous?.key===key?previous:null;
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
    if(data.type==='progress'){
     const p=data.data,elapsed=p.elapsed_ms;
     let eta=p.eta_ms,scope='total';
     if(p.phase==='compile'){
      const fraction=p.compile_fraction;
      const graphLeft=timing&&timing.compileMs>elapsed?timing.compileMs-elapsed:
       fraction>0&&fraction<1?elapsed*(1-fraction)/fraction:null;
      scope=timing?'total':'compile';
      eta=graphLeft===null?null:graphLeft+(timing?.afterCompileMs??0);
     }else if(eta==null&&timing&&timing.afterCompileMs>elapsed){
      eta=timing.afterCompileMs-elapsed;
     }
     onProgress?.({...p,elapsed_ms:elapsed+compileMs,eta_ms:eta,eta_scope:scope,compute_backend:backend,scoring_workers:scorers.length});
    }
    if(data.type==='result'){
     previousTimings.set(path,{key,compileMs,afterCompileMs:data.data.elapsed_ms});
     finish(resolve,{...data.data,elapsed_ms:data.data.elapsed_ms+compileMs,compile_ms:compileMs,compute_backend:backend});
    }
    if(data.type==='error')fail(data);
   };
  }
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 });
}
