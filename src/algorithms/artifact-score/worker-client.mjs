import {canonical,createScoreCache,SCORE_VERSION} from './cache.mjs'

export function createScoreWorkerClient(makeWorker) {
    let worker=null,sequence=0,pending=null
    const cache=createScoreCache(12)
    function cancel() {
        sequence++
        if(pending){worker?.terminate();worker=null;pending.reject(Object.assign(new Error('动态评分已取消'),{name:'AbortError'}));pending=null}
    }
    function run(request,onProgress=()=>{}) {
        if(pending)cancel()
        const key=canonical({version:SCORE_VERSION,request}),saved=cache.get(key)
        if(saved)return Promise.resolve({...saved,timing:{...saved.timing,resultCacheHit:true,totalMs:0}})
        const id=++sequence
        return new Promise((resolve,reject)=>{
            pending={resolve,reject}
            worker??=makeWorker()
            worker.onmessage=({data})=>{
                if(data.id!==id||sequence!==id)return
                if(data.type==='progress'){onProgress(data.progress);return}
                pending=null
                if(data.type==='result'){cache.set(key,data.result);resolve(data.result)}
                else {const error=new Error(data.error.message);error.stack=data.error.stack;reject(error)}
            }
            worker.onerror=event=>{if(sequence===id){pending=null;reject(new Error(event.message||'动态评分 Worker 加载失败'));worker?.terminate();worker=null}}
            worker.postMessage({id,request:structuredClone(request)})
        })
    }
    return {run,cancel,clear(){cancel();worker?.terminate();worker=null;cache.clear()}}
}
