import test from 'node:test';import assert from 'node:assert/strict';
import {createWebGpuNumericExecutor} from '../beta-data/team-dps-webgpu.mjs';import {createNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
function fakeDevice(){
 const stats={modules:0,pipelines:0,buffers:0,destroyed:0};let release;const pending=new Promise(resolve=>{release=()=>resolve({getBindGroupLayout:()=>({})});});
 return {stats,release,device:{queue:{writeBuffer(){}},createShaderModule(){stats.modules++;return {};},createComputePipelineAsync(){stats.pipelines++;return pending;},createBuffer(){stats.buffers++;return {destroy(){stats.destroyed++;}};}}};
}
test('numeric executors share pending pipeline per device and keep independent buffers',async()=>{
 const old=globalThis.GPUBufferUsage;globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2};
 try{const b=createNumericProgram(),program=b.finish([b.math.add(b.input(0),3)]),a=fakeDevice(),other=fakeDevice();
  const one=createWebGpuNumericExecutor(a.device,program),two=createWebGpuNumericExecutor(a.device,program),separate=createWebGpuNumericExecutor(other.device,program);
  assert.equal(a.stats.modules,1);assert.equal(a.stats.pipelines,1);assert.equal(other.stats.pipelines,1);assert.equal(a.stats.buffers,0);
  a.release();other.release();const [x,y,z]=await Promise.all([one,two,separate]);assert.equal(a.stats.buffers,4);x.destroy();assert.equal(a.stats.destroyed,2);assert.equal(other.stats.destroyed,0);
  const later=await createWebGpuNumericExecutor(a.device,program);assert.equal(a.stats.pipelines,1);y.destroy();later.destroy();z.destroy();assert.equal(a.stats.destroyed,6);assert.equal(other.stats.destroyed,2);
 }finally{if(old===undefined)delete globalThis.GPUBufferUsage;else globalThis.GPUBufferUsage=old;}
});
test('shared pipeline compilation errors propagate to every waiting executor',async()=>{
 const error=new Error('test GPU compiler failed');let calls=0;const device={createShaderModule:()=>({}),createComputePipelineAsync:()=>{calls++;return Promise.reject(error);}},b=createNumericProgram(),program=b.finish([b.input(0)]);
 const results=await Promise.allSettled([createWebGpuNumericExecutor(device,program),createWebGpuNumericExecutor(device,program)]);assert.equal(calls,1);for(const result of results){assert.equal(result.status,'rejected');assert.equal(result.reason,error);}
});
