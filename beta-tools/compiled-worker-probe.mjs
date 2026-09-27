// Execute the built classic worker and its real chunks/WASM in a Node worker.
// This is a build integration check, not browser UI automation.
import {Worker} from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
export function probeCompiledOptimizer(dist,input,artifacts){
 const js=path.join(dist,'js');const entry=fs.readdirSync(js).find(n=>n.endsWith('.js')&&!n.includes('-legacy')&&fs.readFileSync(path.join(js,n),'utf8').includes('importScripts')&&fs.readFileSync(path.join(js,n),'utf8').includes('optimizeConfig'));
 if(!entry)throw Error('Compiled optimizer worker not found');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(`
   const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
   const {dist,entry,input,artifacts}=workerData;global.self=global;global.location='http://worker.local/js/'+entry;global.module={require};
   const local=url=>{const pathname=decodeURIComponent(new URL(String(url),global.location).pathname),p=path.resolve(dist,'.'+pathname);if(!p.startsWith(path.resolve(dist)+path.sep))throw Error('outside dist');return p;};
   global.importScripts=(...urls)=>{for(const url of urls)vm.runInThisContext(fs.readFileSync(local(url),'utf8'),{filename:String(url)});};
   global.fetch=async url=>{try{return new Response(fs.readFileSync(local(url)),{headers:{'Content-Type':String(url).includes('.wasm')?'application/wasm':'application/javascript'}})}catch(error){return new Response(error.message,{status:404})}};
   global.postMessage=message=>{if(message.type==='ready')queueMicrotask(()=>{try{global.onmessage({data:{optimizeConfig:input,artifacts}})}catch(error){parentPort.postMessage({type:'uncaught',error:error.message})}});else parentPort.postMessage(message);};
   process.on('unhandledRejection',error=>parentPort.postMessage({type:'uncaught',error:error?.message||String(error)}));
   vm.runInThisContext(fs.readFileSync(path.join(dist,'js',entry),'utf8'),{filename:entry});
  `,{eval:true,workerData:{dist:path.resolve(dist),entry,input,artifacts}});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('compiled worker timeout'))},15000);
  worker.once('message',message=>{clearTimeout(timer);worker.terminate();resolve(message)});
  worker.once('error',error=>{clearTimeout(timer);worker.terminate();reject(error)});
 });
}
