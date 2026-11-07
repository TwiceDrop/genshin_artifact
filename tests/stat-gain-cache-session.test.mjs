import test from 'node:test'
import assert from 'node:assert/strict'
import { createStatGainCache, statGainCacheKey } from '../src/algorithms/stat-gain/cache.mjs'
import { createLocalServer } from '../server/local.mjs'

const items = [{id:1,setName:'gladiatorFinale',position:'flower',star:5,level:20,mainTag:{name:'lifeStatic',value:4780},normalTags:[],omit:false},
    {id:2,setName:'gladiatorFinale',position:'feather',star:5,level:20,mainTag:{name:'attackStatic',value:311},normalTags:[],omit:false}]
function storage() { const values=new Map(); return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)} }

test('completed results survive page recreation, stay account scoped and expire with the application session',async()=>{
    const saved=storage();let session='first-start'
    const first=createStatGainCache(saved,async()=>session);first.setInventory(1,items);first.setInventory(2,items)
    const result={points:[{rolls:20,damage:1234}],evaluations:10626}
    ;(await first.open(1)).set('configuration-A',result)
    for (let i=0;i<25;i++) (await first.open(1)).set(`configuration-${i}`,result)
    assert.equal((await first.open(1)).get('configuration-B'),undefined)
    assert.equal((await first.open(2)).get('configuration-A'),undefined)
    const refreshed=createStatGainCache(saved,async()=>session);refreshed.setInventory(1,[...items].reverse())
    assert.deepEqual((await refreshed.open(1)).get('configuration-A'),result)
    assert.equal(JSON.parse(saved.getItem(statGainCacheKey(1))).entries.length,26)
    session='second-start'
    assert.equal((await refreshed.open(1)).get('configuration-A'),undefined)
    assert.equal(saved.getItem(statGainCacheKey(1)),null)
})

test('any inventory change invalidates cached results and prevents an old in-flight result from restoring them',async()=>{
    const saved=storage(),cache=createStatGainCache(saved,async()=>'app-session');cache.setInventory(1,items)
    const previous=await cache.open(1);previous.set('equipped-flower',{points:[1]})
    const changed=structuredClone(items);changed[1].level=19
    cache.setInventory(1,changed)
    assert.equal(saved.getItem(statGainCacheKey(1)),null)
    previous.set('late-result',{points:[2]})
    const current=await cache.open(1);assert.equal(current.get('equipped-flower'),undefined);assert.equal(current.get('late-result'),undefined)
    current.set('new-result',{points:[3]});cache.setInventory(1,items)
    assert.equal((await cache.open(1)).get('equipped-flower'),undefined)
    assert.equal((await cache.open(1)).get('new-result'),undefined)
    cache.remove(1);assert.equal(saved.getItem(statGainCacheKey(1)),null)
})

test('local application session endpoint is stable during one run and changes on restart at the same origin',async()=>{
    let server=createLocalServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port
    const read=async()=>{const r=await fetch(`http://127.0.0.1:${port}/api/calculation/session`,{headers:{'x-mona-local':'1',Connection:'close'}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return (await r.json()).id}
    try {
        const first=await read();assert.equal(await read(),first)
        await new Promise(r=>server.close(r));server=createLocalServer();await new Promise(r=>server.listen(port,'127.0.0.1',r))
        assert.notEqual(await read(),first)
    } finally {await new Promise(r=>server.close(r))}
})
