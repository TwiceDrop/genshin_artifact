import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalServer } from '../server/local.mjs'
import { CloudGateway } from '../server/cloud.mjs'

test('profile gateway binds each upload to its online identity and preserves large UTF-8 data and pagination', async t => {
    let saved = { id:'online',url:'https://synthetic.example.test',user:{id:'user-a'},sessionToken:'synthetic-token' }
    const calls=[]
    const cloudGateway = new CloudGateway({ credentialStore:{},sessionStore:{get:async()=>saved},fetcher:async(url,options)=>{
        calls.push({url,options});return {ok:true,status:200,json:async()=>({accepted:true})}
    } })
    const server=createLocalServer({credentialStore:{},cloudGateway})
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    t.after(()=>new Promise(resolve=>server.close(resolve)))
    const base=`http://127.0.0.1:${server.address().port}/api/cloud`
    const headers={'x-mona-local':'1','content-type':'application/json','x-mona-cloud-url':encodeURIComponent(saved.url),'x-mona-cloud-user':'user-a'}
    const data={name:'合成档案',text:'圣遗物与多人轴🍀'.repeat(12000)}
    const response=await fetch(base+'/v1/profiles/fixture/revisions',{method:'PUT',headers,body:JSON.stringify({data})})
    assert.equal(response.status,200);assert.deepEqual(JSON.parse(calls.at(-1).options.body),{data})
    await fetch(base+'/v1/profiles/fixture/history?after=42&limit=20',{headers})
    assert.equal(calls.at(-1).url,'https://synthetic.example.test/v1/profiles/fixture/history?after=42&limit=20')
    const sent=calls.length
    saved={...saved,user:{id:'user-b'}}
    const blocked=await fetch(base+'/v1/profiles',{method:'POST',headers,body:JSON.stringify({data})})
    assert.equal(blocked.status,409);assert.equal((await blocked.json()).error.code,'CLOUD_CONTEXT_CHANGED');assert.equal(calls.length,sent)
    saved={...saved,url:'https://different.example.test',user:{id:'user-a'}}
    const moved=await fetch(base+'/v1/profiles',{method:'POST',headers,body:'{}'})
    assert.equal(moved.status,409);assert.equal(calls.length,sent)
})
