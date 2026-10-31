import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { HoyolabClient, communityClient } from '../server/hoyolab.mjs'
import { communityAccount } from '../server/cookie.mjs'
import { CredentialStore } from '../server/credentials.mjs'
import { createLocalServer } from '../server/local.mjs'
const cookie = id => `ltuid=${id};ltoken=synthetic-token;cookie_token=synthetic-cookie;`

test('overseas bound roles and character snapshot use OS endpoints, Chinese language and preserved source', async () => {
    const calls = []
    const client = new HoyolabClient(async (url, options) => {
        calls.push({ url, options })
        const list = url.includes('/binding/') ? [
            { game_uid:'800000001', region:'os_asia', nickname:'Synthetic' },
            { game_uid:'100000001', region:'cn_gf01' },
        ] : url.endsWith('/list') ? [{ id:10000021 }] : [{ base:{ id:10000021 } }]
        return { ok:true, json:async () => ({ retcode:0, data:{ list } }) }
    })
    client.cookie = cookie(1)
    assert.equal((await client.getRoles()).length,1)
    const snapshot = await client.snapshot('800000001')
    assert.equal(snapshot.source,'hoyolab'); assert.equal(snapshot.characters.length,1)
    assert.equal(calls.length,3)
    assert.equal(calls[0].url,'https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_global')
    assert.equal(calls[1].url,'https://sg-public-api.hoyolab.com/event/game_record/genshin/api/character/list')
    assert.equal(calls[2].url,'https://sg-public-api.hoyolab.com/event/game_record/genshin/api/character/detail')
    for (const c of calls) { assert.equal(c.options.headers['x-rpc-language'],'zh-cn'); assert.match(c.options.headers.DS,/^\d+,[A-Za-z]{6},[a-f0-9]{32}$/) }
    assert.equal(communityAccount(cookie(1)).id,'1')
    assert.equal(communityAccount(cookie(1),'hoyolab').id,'hoyolab:1')
})

test('web login confirmation, error, cancellation and account restore preserve platform and secrets', async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(),'mona-hoyolab-synthetic-'))
    const store = new CredentialStore(path.join(dir,'vault'),async value => Buffer.from(value))
    const flows = []
    const server = createLocalServer({ credentialStore:store,
        clientFactory: platform => {
            const client = communityClient(platform,async () => { throw Error('unexpected upstream') })
            client.getRoles = async () => client.roles = [{ uid:client.platform === 'hoyolab'?'800000001':'100000001', nickname:'Synthetic' }]
            client.createQR = async () => ({ url:'https://user.mihoyo.com/qr', expiresAt:Date.now()+120000 })
            client.pollQR = async () => { client.cookie=cookie(1); return {status:'Confirmed'} }
            return client
        },
        webLoginFactory: () => {
            let resolve,reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no })
            const flow = {promise,resolve,reject,cancelled:false,cancel(){this.cancelled=true}}
            flows.push(flow); return flow
        },
    })
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base=`http://127.0.0.1:${server.address().port}/api/mys/`, headers={'X-Mona-Local':'1','Content-Type':'application/json'}
    async function api(route,body) {
        const r = await fetch(base+route,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})})
        if(r.headers.has('set-cookie'))headers.Cookie=r.headers.get('set-cookie').split(';')[0]
        return {status:r.status,data:await r.json()}
    }
    await api('login',{}); await api('poll',{}); await api('roles')
    assert.equal((await api('login',{platform:'hoyolab'})).data.mode,'web')
    assert.equal((await api('poll',{})).data.status,'Waiting')
    flows[0].resolve(cookie(1)); await new Promise(resolve => setImmediate(resolve))
    assert.equal((await api('poll',{})).data.status,'Confirmed'); await api('roles')
    const list=await api('accounts')
    assert.deepEqual(list.data.accounts.map(a=>a.id).sort(),['1','hoyolab:1'])
    assert.doesNotMatch(JSON.stringify(list),/synthetic-token|synthetic-cookie/)
    assert.equal((await api('select',{id:'hoyolab:1'})).data.account.platform,'hoyolab')
    await api('login',{platform:'hoyolab'}); await api('cancel',{})
    flows[1].resolve(cookie(2)); await new Promise(resolve=>setImmediate(resolve))
    assert.equal(flows[1].cancelled,true); assert.equal((await api('poll',{})).status,502)
    assert.equal((await api('accounts')).data.accounts.length,2)
    await api('login',{platform:'hoyolab'}); flows[2].reject(new Error('synthetic window failure'))
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal((await api('poll',{})).data.error,'synthetic window failure')
    assert.equal((await api('accounts')).data.accounts.length,2)
})
