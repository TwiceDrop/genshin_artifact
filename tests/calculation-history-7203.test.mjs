import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalculationHistory,historyKey} from '../src/algorithms/calculation-history.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(saved=new Map()){
 const state={accounts:{},active:null},messages=[];
 const storage={getItem:async key=>structuredClone(saved.get(key)),setItem:async(key,value)=>{saved.set(key,structuredClone(value));}};
 const manager=createCalculationHistory({storage,state,notify:(...args)=>messages.push(args)});
 return {manager,state,messages,storage,saved};
}
const meta=accountId=>({accountId,kind:'single',label:'测试角色',members:[]});

test('background job retains its snapshot, reports progress, prevents a second job and stores results by account',async()=>{
 const x=fixture(),gate=deferred(),begun=deferred(),input={weapon:{refine:1}};
 const job=x.manager.start(meta(1),input,async({onProgress})=>{onProgress({percent:37});begun.resolve();await gate.promise;return {detail:{result:[17]},summary:{totalDamage:123}};});
 assert.throws(()=>x.manager.start(meta(2),{},()=>{}),/当前有计算线程/);
 await begun.promise;
 input.weapon.refine=5;
 assert.equal(x.state.accounts[1].entries[0].progress.percent,37);
 assert.equal((await x.manager.read(1,job.id)).weapon.refine,1);
 // Another page/account may load while the original caller no longer watches.
 await x.manager.load(2);assert.deepEqual(x.state.accounts[2].entries,[]);
 gate.resolve();await job.promise;
 assert.equal(x.state.active,null);assert.equal(x.state.accounts[1].entries[0].status,'completed');
 assert.match(x.messages[0][1],/测试角色 单次计算 已完成 用时：\d+:\d+/);
 const reload=fixture(x.saved);await reload.manager.load(1);
 assert.deepEqual(await reload.manager.read(1,job.id),{result:[17]});
});

test('cancel terminates only the matching job, and stale running records reload as interrupted',async()=>{
 const x=fixture(),begun=deferred();
 const job=x.manager.start(meta(1),{snapshot:true},({signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('计算已取消','AbortError')));begun.resolve();}));
 await begun.promise;x.manager.cancel(2,job.id);assert.equal(job.controller.signal.aborted,false);
 x.manager.cancel(1,job.id);await assert.rejects(job.promise,{name:'AbortError'});
 assert.equal(x.state.accounts[1].entries[0].status,'cancelled');assert.equal(x.state.active,null);
 x.saved.set(historyKey(3),{nextId:2,entries:[{id:1,status:'running'}]});
 await x.manager.load(3);assert.equal(x.state.accounts[3].entries[0].status,'interrupted');
});

test('real calculation and persistence failures stay visible and release the active slot',async()=>{
 const x=fixture();
 const failed=x.manager.start(meta(1),{},async()=>{throw new Error('原始内核错误');});
 await assert.rejects(failed.promise,/原始内核错误/);
 assert.equal(x.state.accounts[1].entries[0].error,'原始内核错误');
 x.storage.setItem=async()=>{throw new Error('磁盘已满');};
 const good=x.manager.start(meta(1),{},async()=>({detail:{result:42}}));await good.promise;
 assert.equal((await x.manager.read(1,good.id)).result,42);
 assert.ok(x.messages.some(([type,message])=>type==='error'&&message.includes('磁盘已满')));
 assert.equal(x.state.active,null);
});
