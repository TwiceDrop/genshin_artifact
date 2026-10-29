// JSON formatting can be large for exact event distributions. Keep it off the
// page thread; the short-lived worker returns a Blob without copying the text.
export function exportTeamDpsResult(value){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../workers/team_dps_result_export.js',import.meta.url));
  const finish=(callback,result)=>{worker.terminate();callback(result);};
  worker.onmessage=({data})=>data.error?finish(reject,new Error(data.error)):finish(resolve,data.blob);
  worker.onerror=event=>finish(reject,new Error(event.message));
  try{worker.postMessage(value);}catch(error){finish(reject,error);}
 });
}
