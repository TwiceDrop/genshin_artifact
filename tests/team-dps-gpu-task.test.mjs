import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {runTeamDpsGpuWorkers} from '../src/wasm/team-dps-gpu-task.mjs';
import {createTeamDpsScorePool} from '../src/workers/team-dps-score-pool.mjs';
import {FakeTeamWorker as Worker,simpleTeamModel} from './helpers/team-dps-fake-worker.mjs';
import {teamDpsProgressText} from '../beta-data/team-dps-progress.mjs';
function setup(options={}){
 const coordinator=new Worker(),gpu=new Worker(),result=runTeamDpsGpuWorkers(coordinator,gpu,{team_dps:{max_evaluations:2000}},[],options);
 return {coordinator,gpu,result};
}
test('GPU worker starts device acquisition on connect and scores on that device',async()=>{
 const script=readFileSync(new URL('../src/workers/team_dps_gpu.js',import.meta.url),'utf8').replace(/^import .*$/m,'');
 const self={postMessage(){}},messages=[],port={start(){},postMessage:m=>messages.push(m)};
 const device={},devices=[],gpu={requestAdapter:async()=>({requestDevice:()=>{devices.push(device);return device;}})};
 const createTeamDpsComputation=(_model,_items,options)=>{
  assert.equal(options.device,device);
  return {kind:'direct',score:async teams=>({results:teams})};
 };
 vm.runInNewContext(script,{self,navigator:{gpu},createTeamDpsComputation});
 await self.onmessage({data:{type:'connect',port}});
 assert.equal(devices.length,1);
 await port.onmessage({data:{type:'initialize',model:{},artifacts:[]}});
 await port.onmessage({data:{type:'score',teams:[1,2]}});
 assert.deepEqual(messages.map(m=>m.type),['initialized','scored']);
 assert.equal(devices.length,1);
});
test('compile ETA counts unfinished graph work and then the measured downstream time on repeat runs',async()=>{
 const run=async()=>{
  const updates=[],task=setup({onProgress:p=>updates.push(p)});
  task.gpu.emit({type:'ready'});task.coordinator.emit({type:'ready'});
  task.coordinator.emit({type:'progress',data:{phase:'compile',elapsed_ms:100,compile_fraction:0.25}});
  task.coordinator.emit({type:'compiled',compile_ms:400});
  task.coordinator.emit({type:'progress',data:{phase:'search',elapsed_ms:100,eta_ms:200}});
  task.coordinator.emit({type:'result',data:{elapsed_ms:300}});
  await task.result;return updates;
 };
 const first=await run(),repeat=await run();
 assert.deepEqual([first[0].eta_scope,first[0].eta_ms],['compile',300]);
 assert.deepEqual([repeat[0].eta_scope,repeat[0].eta_ms],['total',600]);
 assert.equal(repeat[1].eta_ms,200);
 assert.match(teamDpsProgressText(repeat[1]),/GPU.*批量/);
});
test('GPU lifecycle: compilation, batch ordering, elapsed time, cancellation and real errors',async()=>{
 const updates=[],a=setup({onProgress:p=>updates.push(p)});
 a.coordinator.emit({type:'ready'});assert.equal(a.coordinator.sent.length,0);
 a.gpu.emit({type:'ready'});assert.equal(a.gpu.sent[0].type,'connect');assert.equal(a.coordinator.sent[0].parallelism,128);
 a.coordinator.emit({type:'progress',data:{phase:'compile',elapsed_ms:250}});assert.equal(updates[0].phase,'compile');
 a.coordinator.emit({type:'compiled',compile_ms:500});
 const port=a.gpu.sent[0].port,request=new Promise(resolve=>{port.onmessage=({data})=>{if(data.type==='initialize')port.postMessage({type:'initialized'});else if(data.type==='score')resolve(data);};port.start();}),pool=createTeamDpsScorePool(a.coordinator.sent[0].ports,simpleTeamModel,[],{batchSize:128});
 const scores=pool.score([[1],[2]]);assert.deepEqual(await request,{type:'score',teams:[[1],[2]],detail:false});
 port.postMessage({type:'scored',results:[{value:10},{value:20}]});assert.deepEqual(await scores,[{value:10},{value:20}]);assert.equal(a.coordinator.sent.length,1);pool.dispose();
 a.coordinator.emit({type:'progress',data:{phase:'search',elapsed_ms:1200}});assert.equal(updates.at(-1).elapsed_ms,1700);
 const late=a.gpu.onmessage;a.coordinator.emit({type:'result',data:{results:[1],elapsed_ms:2000}});
 assert.deepEqual(await a.result,{results:[1],elapsed_ms:2500,compute_backend:'gpu',compile_ms:500});
 late({data:{type:'progress',data:{phase:'compile'}}});assert.equal(updates.length,2);assert.ok(a.gpu.terminated&&a.coordinator.terminated);
 for(const stage of ['compile','score']){
  const controller=new AbortController(),b=setup({signal:controller.signal});b.gpu.emit({type:'ready'});
  if(stage==='score'){b.coordinator.emit({type:'ready'});b.coordinator.emit({type:'compiled',compile_ms:500});}
  controller.abort();await assert.rejects(b.result,{name:'AbortError'});assert.ok(b.gpu.terminated&&b.coordinator.terminated);
 }
 const c=setup();c.gpu.emit({type:'error',message:'GPU compilation failed',stack:'actual compiler stack'});
 await assert.rejects(c.result,e=>e.message==='GPU compilation failed'&&e.stack==='actual compiler stack');assert.ok(c.gpu.terminated&&c.coordinator.terminated);
});
