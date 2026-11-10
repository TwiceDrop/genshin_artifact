import test from 'node:test'
import assert from 'node:assert/strict'
import { createCalculationHistory, historyKey } from '../src/algorithms/calculation-history.mjs'
import { syncHistory } from '../src/cloud/history-sync.mjs'

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
const summary={kind:'single',label:'合成角色',status:'completed',startedAt:1,finishedAt:2,elapsedMs:1,members:[]}
const detail={input:{synthetic:true},items:{11:{id:11,level:20}},artifacts:[{id:11}],view:{preset:{artifactIds:[11]}},results:[{flower:11}],panelSnapshot:null}
function fixture(saved=new Map()){
    const state={accounts:{},active:null},batches=[]
    const storage={
        getItem:async key=>clone(saved.get(key)),
        setItem:async(key,value)=>{saved.set(key,clone(value))},
        batch:async(entries,removals=[],options={})=>{
            options.beforeWrite?.()
            const next=new Map(saved)
            for(const key of removals)next.delete(key)
            for(const [key,value]of entries)next.set(key,clone(value))
            saved.clear();for(const [key,value]of next)saved.set(key,value)
            batches.push(options.source)
        },
    }
    return {history:createCalculationHistory({storage,state}),state,saved,batches}
}

test('历史同步保留冻结正文、终态身份与本地映射，重复恢复和离线重试不覆盖或重复上传',async()=>{
    const a=fixture(new Map([
        [historyKey(7),{nextId:5,entries:[{...summary,id:4,accountId:7,progress:{percent:100},storageError:'旧本机错误'}]}],
        [`${historyKey(7)}_4`,clone(detail)],
    ]))
    let resume,started
    const startedPromise=new Promise(resolve=>{started=resolve})
    const running=a.history.start({accountId:7,kind:'team',label:'合成队伍',members:[]},{input:{synthetic:true}},async()=>{
        started();await new Promise(resolve=>{resume=resolve})
        return {summary:{},detail:{input:{synthetic:true},resultVersion:'team-dps-result/2',engineRulesVersion:'synthetic',axis:{},output:{value:{$teamNumber:'Infinity'}}}}
    })
    await startedPromise
    const terminal=await a.history.exportSync(7)
    assert.equal(terminal.length,1)
    assert.match(terminal[0].syncId,/^[0-9a-f-]{36}$/)
    for(const key of ['id','accountId','progress','storageError'])assert.equal(Object.hasOwn(terminal[0].summary,key),false)
    assert.equal(a.saved.get(historyKey(7)).entries.find(row=>row.id===4).syncId,terminal[0].syncId)
    await assert.rejects(a.history.importSync(7,terminal),{code:'HISTORY_BUSY'})
    await assert.rejects(a.history.invalidate(7),{code:'HISTORY_BUSY'})
    resume();await running.promise
    const exported=await a.history.exportSync(7)
    assert.equal(exported.length,2)
    const b=fixture()
    assert.deepEqual(await b.history.importSync(91,exported),{imported:2})
    assert.deepEqual(b.state.accounts[91].entries.map(row=>row.id).sort(),[1,2])
    assert.ok(b.state.accounts[91].entries.every(row=>row.accountId===91))
    const single=b.state.accounts[91].entries.find(row=>row.kind==='single')
    assert.deepEqual(await b.history.read(91,single.id),detail)
    assert.equal(b.state.active,null)
    assert.ok([...b.saved.keys()].every(key=>key.startsWith(historyKey(91))))
    assert.ok(b.batches.every(source=>source==='cloud-history'))
    const changed=clone(exported);changed[0].detail.changed=true
    await assert.rejects(b.history.importSync(91,changed),{code:'HISTORY_CONFLICT'})
    assert.deepEqual(await b.history.importSync(91,exported),{imported:0})
    const late=clone(exported[0]);late.syncId=crypto.randomUUID()
    await assert.rejects(b.history.importSync(91,[late],{beforeWrite:()=>{throw Object.assign(new Error('身份在写入前改变'),{code:'CLOUD_CONTEXT_CHANGED'})}}),{code:'CLOUD_CONTEXT_CHANGED'})
    assert.equal(b.state.accounts[91].entries.length,2)
    await b.history.invalidate(91)
    assert.equal((await b.history.exportSync(91)).length,2)

    const remote=exported.map((entry,index)=>({...clone(entry),sequence:index+1,createdAt:'2026-11-07T00:00:00.000Z'}))
    let metadata={},posts=0,dropReply=false
    const request=async(path,options)=>{
        const url=new URL(path,'https://synthetic.invalid'),id=url.pathname.split('/').at(-1)
        if(options.method==='POST'){
            posts++
            const existing=remote.find(row=>row.syncId===options.body.syncId)
            if(!existing)remote.push({...clone(options.body),sequence:remote.length+1})
            if(dropReply){dropReply=false;throw new Error('合成网络中断：提交已到达但响应丢失')}
            return {entry:clone(existing||remote.at(-1))}
        }
        if(id==='history')return {entries:remote.filter(row=>row.sequence>Number(url.searchParams.get('after'))).map(({detail,...row})=>clone(row)),nextCursor:null}
        return {entry:clone(remote.find(row=>row.syncId===id))}
    }
    const options=history=>({history,accountId:91,profileId:'synthetic-profile',request,metadata,onMetadata:async value=>{metadata=clone(value)},assertCurrent:()=>{}})
    const first=await syncHistory(options(b.history))
    assert.equal(first.uploaded,0);assert.equal(first.downloaded,0);assert.equal(posts,0)
    const added=b.history.start({accountId:91,kind:'single',label:'离线新增',members:[]},detail,async()=>({summary:{},detail}))
    await added.promise
    dropReply=true
    await assert.rejects(syncHistory(options(b.history)),/合成网络中断/)
    assert.equal(remote.length,3);assert.equal(posts,1)
    const restarted=fixture(b.saved)
    const retried=await syncHistory(options(restarted.history))
    assert.equal(retried.uploaded,0);assert.equal(retried.downloaded,0)
    assert.equal(remote.length,3);assert.equal(posts,1);assert.equal(metadata.cursor,3)
    assert.equal((await restarted.history.exportSync(91)).length,3)
    await assert.rejects(syncHistory({...options(restarted.history),assertCurrent:()=>{throw Object.assign(new Error('合成账号已切换'),{code:'CLOUD_CONTEXT_CHANGED'})}}),{code:'CLOUD_CONTEXT_CHANGED'})
})
