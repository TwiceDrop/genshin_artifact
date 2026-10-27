import test from 'node:test';
import assert from 'node:assert/strict';
import {runTeamDpsGpuWorkers} from '../src/wasm/team-dps-gpu-task.mjs';
class Worker{
 sent=[];terminated=false;
 postMessage(data){this.sent.push(structuredClone(data));}
 terminate(){this.terminated=true;}
 emit(data){this.onmessage({data});}
}
function setup(options={}){
 const coordinator=new Worker(),gpu=new Worker(),result=runTeamDpsGpuWorkers(coordinator,gpu,{team_dps:{max_evaluations:2000}},[],options);
 return {coordinator,gpu,result};
}
test('GPU lifecycle: compilation, batch ordering, elapsed time, cancellation and real errors',async()=>{
 const updates=[],a=setup({onProgress:p=>updates.push(p)});
 a.coordinator.emit({type:'ready'});assert.equal(a.coordinator.sent.length,0);
 a.gpu.emit({type:'ready'});assert.equal(a.gpu.sent[0].type,'initialize');
 a.gpu.emit({type:'progress',data:{phase:'compile',elapsed_ms:250}});assert.equal(updates[0].phase,'compile');
 a.gpu.emit({type:'initialized',compile_ms:500});assert.equal(a.coordinator.sent[0].parallelism,128);
 a.coordinator.emit({type:'score',teams:[[1],[2]]});assert.deepEqual(a.gpu.sent.at(-1),{type:'score',teams:[[1],[2]]});
 a.gpu.emit({type:'scored',results:[{value:10},{value:20}]});assert.deepEqual(a.coordinator.sent.at(-1),{type:'scored',results:[{value:10},{value:20}]});
 a.coordinator.emit({type:'progress',data:{phase:'search',elapsed_ms:1200}});assert.equal(updates.at(-1).elapsed_ms,1700);
 const late=a.gpu.onmessage;a.coordinator.emit({type:'result',data:{results:[1],elapsed_ms:2000}});
 assert.deepEqual(await a.result,{results:[1],elapsed_ms:2500,compute_backend:'gpu',compile_ms:500});
 late({data:{type:'progress',data:{phase:'compile'}}});assert.equal(updates.length,2);assert.ok(a.gpu.terminated&&a.coordinator.terminated);
 for(const stage of ['compile','score']){
  const controller=new AbortController(),b=setup({signal:controller.signal});b.gpu.emit({type:'ready'});
  if(stage==='score'){b.coordinator.emit({type:'ready'});b.gpu.emit({type:'initialized',compile_ms:500});b.coordinator.emit({type:'score',teams:[[1]]});}
  controller.abort();await assert.rejects(b.result,{name:'AbortError'});assert.ok(b.gpu.terminated&&b.coordinator.terminated);
 }
 const c=setup();c.gpu.emit({type:'error',message:'GPU compilation failed',stack:'actual compiler stack'});
 await assert.rejects(c.result,e=>e.message==='GPU compilation failed'&&e.stack==='actual compiler stack');assert.ok(c.gpu.terminated&&c.coordinator.terminated);
});
