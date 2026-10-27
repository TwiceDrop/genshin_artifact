import test from 'node:test'
import assert from 'node:assert/strict'
import {runSingleOptimizeWorker} from '../src/wasm/single-optimize-task.mjs'
import {beginOptimizationProgress,progressImports,remainingOptimizationTime} from '../beta-data/optimizer-progress.mjs'
import {createOptimizationDebug} from '../src/wasm/optimization-debug.mjs'
const worker=()=>({sent:[],terminated:0,postMessage(value){this.sent.push(value)},terminate(){this.terminated++}})

test('no automatic deadline; cancellation releases the Worker and ignores late events',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const w=worker(),controller=new AbortController(),updates=[],events=[]
 const p=runSingleOptimizeWorker(w,{},[],{signal:controller.signal,onProgress:x=>updates.push(x),onDebug:e=>events.push(e)})
 let settled=false;p.then(()=>{settled=true},()=>{settled=true})
 w.onmessage({data:{type:'ready'}});w.onmessage({data:{type:'ready'}});assert.equal(w.sent.length,1)
 const late=w.onmessage;t.mock.timers.tick(3600000);await Promise.resolve();assert.equal(settled,false);assert.equal(w.terminated,0)
 controller.abort();await assert.rejects(p,{name:'AbortError',message:'计算已取消'})
 late({data:{type:'progress',data:{evaluated:999}}});late({data:{type:'results',data:{results:[{value:99}]}}})
 assert.deepEqual(updates,[]);assert.equal(w.terminated,1);assert.equal(w.onmessage,null);assert.equal(w.onerror,null);assert.equal(events.at(-1).phase,'cancelled')
 const next=worker(),q=runSingleOptimizeWorker(next,{},[]);next.onmessage({data:{type:'results',data:{results:[{value:3}]}}});assert.deepEqual(await q,[{value:3}]);assert.equal(next.terminated,1)
})
test('initialization cancellation, genuine errors and success retain cleanup',async()=>{
 const c=new AbortController();c.abort();const w=worker();await assert.rejects(runSingleOptimizeWorker(w,{},[],{signal:c.signal}),{name:'AbortError'});assert.equal(w.terminated,1);assert.deepEqual(w.sent,[])
 for(const data of [{type:'error',error:{phase:'optimization',message:'明确错误'}},{type:'error',error:{phase:'initialization',message:'WASM加载失败'}}]){
  const w=worker(),p=runSingleOptimizeWorker(w,{},[]);w.onmessage({data});await assert.rejects(p,/明确错误|WASM加载失败/);assert.equal(w.terminated,1)
 }
 const d=createOptimizationDebug({version:'test',environment:{}});d.cancel();assert.equal(d.record.status,'cancelled');assert.equal(d.record.error,null)
})
test('ETA resets per native stage and adapts to an expensive final phase',t=>{
 let now=0;t.mock.method(performance,'now',()=>now)
 const buffer=new ArrayBuffer(256),v=new DataView(buffer);v.setUint32(152,2,true);v.setUint32(164,10,true);v.setUint32(176,1,true);v.setUint32(188,1,true)
 const seen=[],p=beginOptimizationProgress({algorithm:'AStar',constraint:{set_mode:'Any'}},[],x=>seen.push(x)),observe=progressImports(()=>({buffer})).observe
 const enter=n=>{for(let i=0;i<n;i++)observe(1,0,0)}
 for(const [mask,count] of [[5,100],[30,900],[10,200]]){observe(0,0,mask);enter(count);now+=300;observe(3,0,0)}
 observe(0,0,1);enter(1);now+=300;observe(3,0,0);assert.equal(seen.at(-1).searchStage,'any');assert.equal(seen.at(-1).etaMs,null)
 for(let i=0;i<3;i++){now+=1000;enter(1)}
 const recent=seen.at(-1);assert.equal(recent.etaScope,'total');assert.ok(recent.etaMs>=6000,JSON.stringify(recent));assert.ok(recent.remainingGroups<20)
 now+=3000;observe(3,0,0);assert.ok(seen.at(-1).etaMs>recent.etaMs)
 now+=9000;observe(3,0,0);assert.equal(seen.at(-1).etaMs,null)
 p.complete();p.dispose();assert.equal(seen.at(-1).percent,100);assert.equal(seen.at(-1).etaMs,0)
})
test('phase-only estimates exclude unobserved later phases; stale values are not frozen at one second',t=>{
 let now=0;t.mock.method(performance,'now',()=>now)
 const buffer=new ArrayBuffer(256),v=new DataView(buffer);for(const [offset,n]of [[152,2],[164,10],[176,1],[188,1]])v.setUint32(offset,n,true)
 const seen=[],p=beginOptimizationProgress({algorithm:'AStar',constraint:{set_mode:'Any'}},[],x=>seen.push(x)),observe=progressImports(()=>({buffer})).observe
 observe(0,0,5);for(let i=0;i<5;i++){now+=1000;observe(1,0,0)}
 assert.equal(seen.at(-1).etaScope,'stage');assert.ok(seen.at(-1).etaMs>0);observe(0,0,30);now+=300;observe(3,0,0);assert.equal(seen.at(-1).etaMs,null)
 assert.equal(remainingOptimizationTime({etaMs:1000},500),500);assert.equal(remainingOptimizationTime({etaMs:1000},1001),null);p.dispose()
})
