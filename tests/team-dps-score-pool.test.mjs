import test from 'node:test';import assert from 'node:assert/strict';
import {createTeamDpsScorePool} from '../src/workers/team-dps-score-pool.mjs';
import {runTeamDpsWorkers} from '../src/wasm/team-dps-task.mjs';
import {runTeamDpsGpuWorkers} from '../src/wasm/team-dps-gpu-task.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const simpleModel={program:{nodes:[{op:'input',args:[],value:0}],outputs:[0]},eventTrace:{groups:[]}};
function peer(channel,{delay=0,error=false}={}){
 const messages=[];channel.port2.onmessage=async({data})=>{messages.push(data);if(data.type==='initialize'){await pause(delay);channel.port2.postMessage(error?{type:'error',message:'device init failed',stack:'preserved stack'}:{type:'initialized'});}else if(data.type==='score'){await pause(Math.abs((10-data.teams[0][0])%4));channel.port2.postMessage({type:'scored',results:data.teams.map(ids=>({id:ids[0],detail:data.detail}))});}};channel.port2.start();return messages;
}
test('direct pool waits for initialization, preserves batch order and concurrent requests',async()=>{
 const channels=[new MessageChannel(),new MessageChannel(),new MessageChannel()],logs=channels.map((c,i)=>peer(c,{delay:(2-i)*5})),model=simpleModel,pool=createTeamDpsScorePool(channels.map(c=>c.port1),model,[],{batchSize:2});
 try{const a=pool.score(Array.from({length:9},(_,i)=>[i]),false),b=pool.score([[20],[21]],true);assert.deepEqual(await a,Array.from({length:9},(_,i)=>({id:i,detail:false})));assert.deepEqual(await b,[{id:20,detail:true},{id:21,detail:true}]);assert.deepEqual(await pool.score([]),[]);for(const log of logs){assert.equal(log.filter(m=>m.type==='initialize').length,1);assert.equal(log[0].model.eventTrace,undefined);assert.deepEqual(log[0].model.program,model.program);const detail=log.filter(m=>m.type==='detail-model');assert.ok(detail.length<=1);if(log.some(m=>m.type==='score'&&m.detail))assert.equal(detail.length,1);}}finally{pool.dispose();for(const c of channels)c.port2.close();}
});
test('direct pool propagates initialization errors to queued and later requests',async()=>{
 const channel=new MessageChannel();peer(channel,{error:true});const pool=createTeamDpsScorePool([channel.port1],simpleModel,[]);
 try{await assert.rejects(pool.score([[1]]),e=>e.message==='device init failed'&&e.stack==='preserved stack');await assert.rejects(pool.score([[2]]),/device init failed/);}finally{pool.dispose();channel.port2.close();}
});
test('only one worker receives a full model and repeated details reuse it',async()=>{
 const channels=[new MessageChannel(),new MessageChannel(),new MessageChannel()],logs=channels.map(c=>peer(c)),pool=createTeamDpsScorePool(channels.map(c=>c.port1),simpleModel,[]);
 try{await pool.score([[1],[2],[3]]);assert.ok(logs.every(log=>!log.some(m=>m.type==='detail-model')));await pool.score([[4],[5]],true);await pool.score([[6]],true);await pool.score([[7],[8],[9]]);assert.equal(logs.flat().filter(m=>m.type==='detail-model').length,1);const owners=logs.filter(log=>log.some(m=>m.type==='score'&&m.detail));assert.equal(owners.length,1);assert.equal(owners[0].filter(m=>m.type==='score'&&m.detail).length,3);}finally{pool.dispose();for(const c of channels)c.port2.close();}
});
test('a single scorer receives one full model without a redundant detail transfer',async()=>{
 const channel=new MessageChannel(),log=peer(channel),pool=createTeamDpsScorePool([channel.port1],simpleModel,[]);
 try{await pool.score([[1]],true);await pool.score([[2]]);await pool.score([[3]],true);assert.deepEqual(log[0].model,simpleModel);assert.equal(log.filter(m=>m.type==='initialize').length,1);assert.equal(log.filter(m=>m.type==='detail-model').length,0);}finally{pool.dispose();channel.port2.close();}
});
test('disposing an active pool rejects work and closes pending dispatch',async()=>{
 const channel=new MessageChannel(),pool=createTeamDpsScorePool([channel.port1],simpleModel,[]),pending=pool.score([[1],[2]]);pool.dispose();await assert.rejects(pending,{name:'AbortError'});await assert.rejects(pool.score([[3]]),{name:'AbortError'});channel.port2.close();
});
class Worker{
 sent=[];terminated=false;
 postMessage(data,transfer){this.sent.push(structuredClone(data,{transfer}));}
 terminate(){this.terminated=true;for(const data of this.sent){data.port?.close();data.ports?.forEach(p=>p.close());}}
 emit(data){this.onmessage({data});}
}
for(const backend of ['cpu','gpu'])test(backend+' task transfers ports and keeps only lifecycle messages on the page',async()=>{
 const coordinator=new Worker(),scorers=Array.from({length:backend==='cpu'?3:1},()=>new Worker()),updates=[],run=options=>backend==='cpu'?runTeamDpsWorkers(coordinator,scorers,{team_dps:{}},[],{mode:'optimize',...options}):runTeamDpsGpuWorkers(coordinator,scorers[0],{team_dps:{}},[],options),result=run({onProgress:p=>updates.push(p)});
 coordinator.emit({type:'ready'});assert.equal(coordinator.sent.length,0);for(const worker of scorers)worker.emit({type:'ready'});
 assert.equal(coordinator.sent.length,1);assert.equal(coordinator.sent[0].ports.length,scorers.length);assert.equal(coordinator.sent[0].batchSize,backend==='cpu'?1:128);for(const w of scorers)assert.deepEqual(Object.keys(w.sent[0]).sort(),['port','type']);
 coordinator.emit({type:'compiled',compile_ms:50});coordinator.emit({type:'progress',data:{elapsed_ms:100}});const late=coordinator.onmessage;coordinator.emit({type:'result',data:{results:[{value:9}],elapsed_ms:200}});
 assert.deepEqual(await result,{results:[{value:9}],elapsed_ms:250,compile_ms:50,compute_backend:backend});late({data:{type:'progress',data:{elapsed_ms:300}}});assert.equal(updates.length,1);assert.equal(updates[0].elapsed_ms,150);for(const w of [coordinator,...scorers]){assert.ok(w.terminated);assert.equal(w.onmessage,null);}
});
test('task abort before and after port transfer, real worker error and transfer failure clean up',async()=>{
 for(const started of [false,true]){
  const coordinator=new Worker(),scorer=new Worker(),controller=new AbortController(),done=runTeamDpsWorkers(coordinator,[scorer],{team_dps:{}},[],{mode:'evaluate',signal:controller.signal});if(started){coordinator.emit({type:'ready'});scorer.emit({type:'ready'});}controller.abort();await assert.rejects(done,{name:'AbortError'});assert.ok(coordinator.terminated&&scorer.terminated);
 }
 for(const transferFailure of [false,true]){const c=new Worker(),s=new Worker(),done=runTeamDpsWorkers(c,[s],{team_dps:{}},[],{mode:'evaluate'});if(transferFailure){s.postMessage=()=>{throw Error('port transfer failed')};c.emit({type:'ready'});s.emit({type:'ready'});}else{s.onerror({message:'worker crashed',stack:'real stack'});}await assert.rejects(done,transferFailure?/port transfer failed/:e=>e.message==='worker crashed'&&e.stack==='real stack');assert.ok(c.terminated&&s.terminated);}
});
