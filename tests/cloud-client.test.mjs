import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { publicAccount } from '../server/cookie.mjs'

test('cloud mobile keeps sessions in its native vault and only uploads the explicitly selected game account', async () => {
    let vault = '{}', failMe = false, releaseVerify
    const originalGameVault = JSON.stringify({ version: 1, accounts: [
        { id: '1', accountUid: '1', platform: 'miyoushe', cookie: 'synthetic-cn-cookie', roles: [], device: 'synthetic-device' },
        { id: 'hoyolab:2', accountUid: '2', platform: 'hoyolab', cookie: 'synthetic-os-cookie', roles: [] },
    ] })
    const requests = [], token = '00000000-0000-4000-8000-000000000001.synthetic-session-secret'
    const user = { id: 'synthetic-user', email: 'synthetic@example.test' }
    const mock = {
        publicAccount,
        MonaLocal: { readCloudVault: async () => ({ text: vault }), writeCloudVault: async ({ text }) => { vault = text }, readVault: async () => ({ text: originalGameVault }) },
        CapacitorHttp: { request: async request => {
            requests.push(request)
            const path = new URL(request.url).pathname
            assert.equal(request.disableRedirects, true)
            if (path === '/v1/auth/email/verify') {
                if (releaseVerify) await new Promise(resolve => { releaseVerify.resolve = resolve })
                return { status: 200, data: { sessionToken: token, user, expiresAt: '2026-12-07T00:00:00Z' } }
            }
            if (path === '/v1/me' && failMe) return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: '会话已失效' } } }
            if (path === '/v1/game-accounts') return { status: 200, data: { account: { id: 'cloud-account' } } }
            return { status: 200, data: { ok: true, user } }
        } },
    }
    globalThis.__cloudMobileMock = mock
    const source = fs.readFileSync(new URL('../src/platform/cloud-mobile.mjs', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '')
    const { mobileCloudApi: api } = await import('data:text/javascript;base64,' + Buffer.from(`const { MonaLocal, CapacitorHttp, publicAccount } = globalThis.__cloudMobileMock;\n${source}`).toString('base64'))
    delete globalThis.__cloudMobileMock
    await assert.rejects(api('config', 'PUT', { url: 'http://remote.example.test' }), /HTTPS/)
    await api('config', 'PUT', { url: 'https://one.example.test' })
    const login = await api('v1/auth/email/verify', 'POST', { challengeId: 'test', code: '123456' })
    assert.deepEqual(login.user, user); assert.equal(login.sessionToken, undefined)
    assert.equal(JSON.parse(vault).sessionToken, token)
    assert.equal((await api('config')).sessionToken, undefined)
    const local = await api('local-accounts')
    assert.equal(local.accounts.length, 2); assert.ok(local.accounts.every(account => !('cookie' in account)))
    await api('game-accounts/import-local', 'POST', { id: 'hoyolab:2' })
    assert.equal(requests.at(-1).data.cookie, 'synthetic-os-cookie'); assert.equal(requests.at(-1).data.platform, 'hoyolab')
    assert.equal(requests.at(-1).headers.Authorization, `Bearer ${token}`)
    assert.equal(originalGameVault, (await mock.MonaLocal.readVault()).text)
    await api(`v1/sessions/${token.split('.')[0]}`, 'DELETE')
    assert.deepEqual(JSON.parse(vault), { url: 'https://one.example.test' })
    await api('v1/auth/email/verify', 'POST', { challengeId: 'test', code: '123456' })
    failMe = true
    await assert.rejects(api('v1/me'), error => error.status === 401 && error.message === '会话已失效')
    assert.equal((await api('config')).user, null)
    failMe = false; releaseVerify = {}
    const pending = api('v1/auth/email/verify', 'POST', { challengeId: 'test', code: '123456' })
    const change = api('config', 'PUT', { url: 'https://two.example.test' })
    while (!releaseVerify.resolve) await new Promise(resolve => setImmediate(resolve))
    releaseVerify.resolve(); await pending; await change
    assert.deepEqual(JSON.parse(vault), { url: 'https://two.example.test' })
    await api('v1/auth/email/request', 'POST', { email: 'synthetic@example.test' })
    assert.equal(requests.at(-1).headers.Authorization, undefined)
    assert.equal(new URL(requests.at(-1).url).origin, 'https://two.example.test')
})
