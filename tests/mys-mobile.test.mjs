import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeCookie, publicAccount, communityAccount } from '../server/cookie.mjs'

test('Android account service preserves cookies on failure, logout and cancellation; deletion is explicit', async () => {
    let vault = JSON.stringify({ version: 1, accounts: [] }), failure = null, cancelSnapshot
    class MysClient {
        constructor() { this.roles = []; this.cookie = ''; this.device = 'synthetic-device' }
        clear() { this.cookie = ''; this.roles = [] }
        async getRoles() { if (failure) throw failure; return this.roles = [{ uid: '111111111', nickname: 'Synthetic' }] }
        async snapshot(uid, progress, cancelled) {
            await new Promise(resolve => { cancelSnapshot = resolve })
            if (cancelled()) throw new Error('同步已取消')
            return { uid }
        }
    }
    const mock = { communityClient: () => new MysClient(), normalizeCookie, publicAccount, communityAccount, nativeFetch: () => { throw Error('Unexpected real network') },
        MonaLocal: { readVault: async () => ({ text: vault }), writeVault: async ({ text }) => { vault = text } } }
    const key = '__monaMobileTest'
    globalThis[key] = mock
    const code = fs.readFileSync(new URL('../src/platform/mys-mobile.mjs', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
    const { mobileMysApi: api } = await import('data:text/javascript;base64,' + Buffer.from(`const { communityClient, normalizeCookie, publicAccount, communityAccount, MonaLocal, nativeFetch } = globalThis.${key};\n${code}`).toString('base64'))
    delete globalThis[key]
    const cookie = id => `ltuid=${id}; ltoken=synthetic-token; cookie_token=synthetic-cookie;`
    await api('accounts', 'POST', { cookie: cookie(1) })
    await api('accounts', 'POST', { cookie: cookie(2) })
    assert.equal((await api('accounts')).accounts.length, 2)
    assert.ok(!(await api('accounts')).accounts.some(a => 'cookie' in a))
    await api('select', 'POST', { id: '1' })
    failure = Object.assign(new Error('米游社 5003'), { retcode: 5003 })
    await assert.rejects(api('roles'), /5003/)
    assert.equal(JSON.parse(vault).accounts.length, 2)
    assert.ok(JSON.parse(vault).accounts[0].cookie.includes('synthetic-cookie'))
    failure = null
    const pending = api('import', 'POST', { uid: '111111111' })
    await api('cancel'); cancelSnapshot()
    await assert.rejects(pending, /同步已取消/)
    await api('roles')
    assert.equal(JSON.parse(vault).accounts[0].status, 'ready')
    await api('logout')
    assert.equal(JSON.parse(vault).accounts.length, 2)
    await api('accounts/1', 'DELETE')
    assert.deepEqual(JSON.parse(vault).accounts.map(a => a.id), ['2'])
})

test('Android HoYoLAB web result is ignored after switching to a saved CN account', async () => {
    let vault = JSON.stringify({version:1,accounts:[]}), finish, windowCancelled = false
    const cookie = 'ltuid=123;ltoken=synthetic-token;cookie_token=synthetic-cookie;'
    const communityClient = (platform = 'miyoushe') => ({ platform, roles:[], cookie:'', clear(){this.cookie=''}, async getRoles(){return this.roles}, async pollQR(){throw Error('unexpected QR')} })
    const MonaLocal = {
        readVault:async()=>({text:vault}),writeVault:async({text})=>{vault=text},
        loginHoyolab:()=>new Promise(resolve=>{finish=resolve}),cancelHoyolabLogin:async()=>{windowCancelled=true},
    }
    const key='__monaMobileWebTest'
    globalThis[key]={communityClient,MonaLocal,normalizeCookie,publicAccount,communityAccount,nativeFetch:()=>{throw Error('unexpected network')}}
    const code=fs.readFileSync(new URL('../src/platform/mys-mobile.mjs',import.meta.url),'utf8').replace(/^import .*\n/gm,'')
    const {mobileMysApi:api}=await import('data:text/javascript;base64,'+Buffer.from(`const {communityClient,MonaLocal,normalizeCookie,publicAccount,communityAccount,nativeFetch}=globalThis.${key};\n${code}`).toString('base64'))
    delete globalThis[key]
    await api('accounts','POST',{cookie})
    assert.equal((await api('login','POST',{platform:'hoyolab'})).mode,'web')
    await api('select','POST',{id:'123'})
    finish({cookie});await new Promise(resolve=>setImmediate(resolve))
    assert.equal(windowCancelled,true)
    assert.deepEqual((await api('accounts')).accounts.map(a=>a.id),['123'])
    await api('login','POST',{platform:'hoyolab'})
    finish({cookie});await new Promise(resolve=>setImmediate(resolve))
    assert.equal((await api('poll','POST')).status,'Confirmed')
    assert.deepEqual((await api('accounts')).accounts.map(a=>a.id),['123','hoyolab:123'])
})

test('Android late role response cannot save or mark a different active account as expired', async () => {
    let vault=JSON.stringify({version:1,accounts:[]}), resolveRoles, rejectRoles, delayed=false
    const cookie=id=>`ltuid=${id};ltoken=synthetic-token;cookie_token=synthetic-cookie;`
    const communityClient=(platform='miyoushe')=>({platform,roles:[],cookie:'',clear(){this.cookie=''},
        async getRoles(){if(delayed)return new Promise((resolve,reject)=>{resolveRoles=resolve;rejectRoles=reject});return this.roles}})
    const MonaLocal={readVault:async()=>({text:vault}),writeVault:async({text})=>{vault=text}}
    const key='__monaMobileLateRoles';globalThis[key]={communityClient,MonaLocal,normalizeCookie,publicAccount,communityAccount,nativeFetch:()=>{throw Error('unexpected network')}}
    const code=fs.readFileSync(new URL('../src/platform/mys-mobile.mjs',import.meta.url),'utf8').replace(/^import .*\n/gm,'')
    const {mobileMysApi:api}=await import('data:text/javascript;base64,'+Buffer.from(`const {communityClient,MonaLocal,normalizeCookie,publicAccount,communityAccount,nativeFetch}=globalThis.${key};\n${code}`).toString('base64'));delete globalThis[key]
    await api('accounts','POST',{cookie:cookie(1)})
    await api('accounts','POST',{cookie:cookie(1),platform:'hoyolab'})
    await api('select','POST',{id:'1'});delayed=true
    const pending=api('roles');const rejected=assert.rejects(pending,/账号已切换/)
    await api('select','POST',{id:'hoyolab:1'});const unchanged=vault
    resolveRoles([]);await rejected
    assert.equal(vault,unchanged);assert.equal((await api('accounts')).activeId,'hoyolab:1')
    await api('select','POST',{id:'1'})
    const failing=api('roles');const expired=assert.rejects(failing,/synthetic expired/)
    await api('select','POST',{id:'hoyolab:1'})
    rejectRoles(Object.assign(new Error('synthetic expired'),{retcode:-100}));await expired
    assert.equal((await api('accounts')).accounts.find(a=>a.id==='hoyolab:1').status,'ready')
})
