import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CloudGateway } from '../server/cloud.mjs'
import { publicAccount } from '../server/cookie.mjs'
import { followCloudSession } from '../src/platform/login-gate.mjs'

// 合成数据：令牌、用户和服务地址都是虚构的。
const token = '00000000-0000-4000-8000-000000000001.synthetic-session-secret'
const user = { id: 'synthetic-user', email: 'synthetic@example.test', username: '合成用户' }
const session = { sessionToken: token, user, expiresAt: '2099-01-01T00:00:00Z' }
const sessionRoutes = ['v1/auth/register', 'v1/auth/password/login']

function memoryStore(initial) {
    let value = initial
    return {
        get: async () => value && { ...value },
        upsert: async next => { value = { ...next } },
        update: async (_, patch) => { value = { ...value, ...patch } },
        peek: () => value,
    }
}

test('desktop gateway forwards register, password login and reset, and keeps the new session token to itself', async () => {
    const sent = []
    const store = memoryStore({ id: 'online', url: 'https://cloud.example.test', sessionToken: null, user: null, expiresAt: null })
    const fetcher = async (url, init) => {
        sent.push({ path: new URL(url).pathname, body: JSON.parse(init.body) })
        const path = new URL(url).pathname
        const data = path === '/v1/auth/password/reset' ? { ok: true } : session
        return { ok: true, status: 200, json: async () => structuredClone(data) }
    }
    const gateway = new CloudGateway({ sessionStore: store, credentialStore: {}, fetcher })
    for (const route of sessionRoutes) {
        await store.update('online', { sessionToken: null, user: null })
        const result = await gateway.handle(`/${route}`, 'POST', { account: 'synthetic', password: 'synthetic-password' })
        assert.equal(result.status, 200)
        assert.equal(result.data.sessionToken, undefined, `${route} 不应把令牌交给页面`)
        assert.deepEqual(result.data.user, user)
        assert.equal(store.peek().sessionToken, token, `${route} 应保存会话`)
    }
    await store.update('online', { sessionToken: null, user: null })
    const reset = await gateway.handle('/v1/auth/password/reset', 'POST', { challengeId: 'synthetic', code: '123456', newPassword: 'synthetic-password' })
    assert.deepEqual(reset, { status: 200, data: { ok: true } })
    assert.equal(store.peek().sessionToken, null, '重设密码不登录')
    assert.deepEqual(sent.map(item => item.path), ['/v1/auth/register', '/v1/auth/password/login', '/v1/auth/password/reset'])
    assert.equal((await gateway.handle('/v1/auth/password/other', 'POST', {})).status, 404)
})

test('Android forwards register and password login and saves the session in its native vault', async () => {
    let vault = JSON.stringify({ url: 'https://cloud.example.test' })
    const paths = []
    globalThis.__loginRoutesMock = {
        publicAccount,
        MonaLocal: { readCloudVault: async () => ({ text: vault }), writeCloudVault: async ({ text }) => { vault = text } },
        CapacitorHttp: { request: async request => {
            const path = new URL(request.url).pathname
            paths.push(path)
            return { status: 200, data: structuredClone(path === '/v1/auth/password/reset' ? { ok: true } : session) }
        } },
    }
    const source = fs.readFileSync(new URL('../src/platform/cloud-mobile.mjs', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '')
    const { mobileCloudApi: api } = await import('data:text/javascript;base64,' + Buffer.from(`const { MonaLocal, CapacitorHttp, publicAccount } = globalThis.__loginRoutesMock;\n${source}`).toString('base64'))
    delete globalThis.__loginRoutesMock
    for (const path of sessionRoutes) {
        vault = JSON.stringify({ url: 'https://cloud.example.test' })
        const result = await api(path, 'POST', { account: 'synthetic', password: 'synthetic-password' })
        assert.equal(result.sessionToken, undefined)
        assert.equal(JSON.parse(vault).sessionToken, token, `${path} 应保存会话`)
    }
    vault = JSON.stringify({ url: 'https://cloud.example.test' })
    assert.deepEqual(await api('v1/auth/password/reset', 'POST', { challengeId: 'synthetic', code: '123456', newPassword: 'synthetic-password' }), { ok: true })
    assert.equal(JSON.parse(vault).sessionToken, undefined)
    assert.deepEqual(paths, ['/v1/auth/register', '/v1/auth/password/login', '/v1/auth/password/reset'])
})

test('cloud profile sync starts while signed in and stops after sign-out, following login state changes', async () => {
    let signedIn = true
    const calls = []
    const events = new EventTarget()
    const sync = { start: async () => { calls.push('start') }, stop: () => { calls.push('stop') } }
    const api = async path => { assert.equal(path, 'config'); return { user: signedIn ? user : null } }
    await followCloudSession(sync, { api, events })
    assert.deepEqual(calls, ['start'])
    const changed = async () => { events.dispatchEvent(new Event('mona-cloud-context-change')); await new Promise(resolve => setTimeout(resolve, 0)) }
    await changed()
    assert.deepEqual(calls, ['start'], '仍登录时不重复启动')
    signedIn = false; await changed()
    assert.deepEqual(calls, ['start', 'stop'])
    await changed()
    assert.deepEqual(calls, ['start', 'stop'], '未登录时不重复停止')
    signedIn = true; await changed()
    assert.deepEqual(calls, ['start', 'stop', 'start'])
})
