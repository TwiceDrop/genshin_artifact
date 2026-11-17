// Keep one loaded kernel per editor. Only one calculation is in flight;
// intervening edits replace the pending input rather than queueing stale axes.
export function createTeamPreviewSession({createWorker,onResult,onError}){
 let worker=null,ready=false,inFlight=false,pending=null,timer=null,revision=0;
 function send(){
  if(!ready||inFlight||!pending)return;
  const input=pending;pending=null;inFlight=true;worker.postMessage(input);
 }
 function start(){
  if(worker)return;
  const current=createWorker();worker=current;ready=false;
  function loadFailure(message,detail){
   if(worker!==current)return;
   clearTimeout(timer);pending=null;ready=false;inFlight=false;
   current.terminate();worker=null;onError(message,detail);
  }
  current.onerror=event=>loadFailure(event.message||'技能预览加载失败，请刷新页面后重试。',event.error?.stack||event);
  current.onmessage=({data})=>{
   if(worker!==current)return;
   if(data.type==='ready'){ready=true;send();return;}
   if(data.type==='error'&&data.requestId===undefined){loadFailure(data.message,data.stack);return;}
   inFlight=false;
   if(data.requestId===revision){
    if(data.type==='result')onResult(data.result);
    else if(data.type==='error')onError(data.message,data.stack);
   }
   send();
  };
 }
 return {
  update(input){
   const requestId=++revision;clearTimeout(timer);pending=null;start();
   const snapshot=JSON.parse(JSON.stringify(input));
   timer=setTimeout(()=>{pending={...snapshot,requestId};send();},50);
  },
  dispose(){clearTimeout(timer);worker?.terminate();worker=null;pending=null;},
 };
}
