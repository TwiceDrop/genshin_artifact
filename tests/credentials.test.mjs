import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { CredentialStore, dpapi, normalizeCookie } from '../server/credentials.mjs'
import { createLocalServer } from '../server/local.mjs'
import { MysClient } from '../server/mys.mjs'

const cookie = id => `ltoken=synthetic-ltoken;ltuid=${id};cookie_token=synthetic-cookie;account_id=${id};`
async function tempFile(t) {
    const dir = await mkdtemp(path.join(tmpdir(), 'mona-cookie-test-'))
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep))
    t.after(() => rm(dir, { recursive: true, force: true }))
    return path.join(dir, 'credentials.dpapi')
}
const testCodec = async (value, decrypt) => decrypt ? Buffer.from(value.toString(), 'base64') : Buffer.from(value.toString('base64'))

test('Cookie parser preserves v1/v2 authentication fields, handles spaces and excludes SToken', () => {
    const legacy = normalizeCookie('  ' + cookie('123') + ' stoken=do-not-store; stuid=123; mid=midvalue; tracking=abc;')
    assert.equal(legacy.id, '123'); assert.match(legacy.cookie, /mid=midvalue/); assert.doesNotMatch(legacy.cookie, /stoken|stuid|tracking/)
    const v2 = normalizeCookie('ltuid_v2=456; ltoken_v2=abc==; cookie_token_v2=def; account_mid_v2=xyz; ltmid_v2=xyz;')
    assert.equal(v2.id, '456'); assert.match(v2.cookie, /ltoken_v2=abc==;/)
    assert.throws(() => normalizeCookie(cookie('123') + '\r\nInjection: value'), /格式无效/)
    assert.throws(() => normalizeCookie('ltuid=123;cookie_token=abc;'), /不完整/)
})

test('Windows DPAPI encrypts and decrypts credentials under current user', { skip: process.platform !== 'win32' }, async () => {
    const raw = Buffer.from(JSON.stringify({ cookie: cookie('123') }))
    const encrypted = await dpapi(raw)
    assert.ok(!encrypted.includes(Buffer.from('synthetic-cookie')))
    assert.deepEqual(await dpapi(encrypted, true), raw)
})

test('credential store survives recreation, serializes writes, updates one account and deletes explicitly', async t => {
    const file = await tempFile(t), store = new CredentialStore(file, testCodec)
    await Promise.all([store.upsert({ id: '123', cookie: cookie('123') }), store.upsert({ id: '456', cookie: cookie('456') })])
    await store.upsert({ id: '123', cookie: cookie('123').replace('synthetic-ltoken', 'new-ltoken') })
    const restarted = new CredentialStore(file, testCodec)
    assert.equal((await restarted.all()).length, 2)
    assert.match((await restarted.get('123')).cookie, /new-ltoken/)
    await restarted.remove('123')
    assert.deepEqual((await new CredentialStore(file, testCodec).all()).map(a => a.id), ['456'])
    assert.ok(!(await readFile(file, 'utf8')).includes('synthetic-cookie'))
})

test('failed durable write does not claim success or discard previously saved accounts', async t => {
    const file = await tempFile(t)
    let fail = false
    const store = new CredentialStore(file, async (...args) => { if (fail) throw new Error('encryption failed'); return testCodec(...args) })
    await store.upsert({ id: '123', cookie: cookie('123') })
    fail = true
    await assert.rejects(store.upsert({ id: '456', cookie: cookie('456') }))
    assert.deepEqual((await store.all()).map(a => a.id), ['123'])
    assert.deepEqual((await new CredentialStore(file, testCodec).all()).map(a => a.id), ['123'])
})

test('saved login survives server restart/logout; 5003 preserves credentials; manual delete revokes active sessions', async t => {
    const file = await tempFile(t)
    let rejectRecord = true
    class FakeClient extends MysClient {
        async createQR() { return { url: 'https://user.mihoyo.com/qr', expiresAt: Date.now() + 120000 } }
        async pollQR() { this.cookie = cookie('123'); return { status: 'Confirmed' } }
        async getRoles() { this.roles = [{ uid: '123456789', region: 'cn_gf01', nickname: '测试', regionName: '天空岛' }]; return this.roles }
        async snapshot() {
            if (rejectRecord) { const error = new Error('角色列表读取失败（米游社 5003）'); error.retcode = 5003; throw error }
            return { characters: [], total: 0 }
        }
    }
    let server, base, headers
    const close = async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)) }
    t.after(close)
    async function start() {
        server = createLocalServer({ clientFactory: () => new FakeClient(), credentialStore: new CredentialStore(file, testCodec) })
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
        base = `http://127.0.0.1:${server.address().port}/api/mys/`; headers = { 'X-Mona-Local': '1', 'Content-Type': 'application/json' }
    }
    async function api(route, method = 'GET', body) {
        const response = await fetch(base + route, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
        if (response.headers.has('set-cookie')) headers.Cookie = response.headers.get('set-cookie').split(';')[0]
        return { status: response.status, data: await response.json() }
    }
    await start()
    assert.equal((await fetch(base + 'accounts')).status, 403)
    await api('login', 'POST'); await api('poll', 'POST'); await api('roles')
    const publicList = await api('accounts')
    assert.equal(publicList.data.accounts.length, 1)
    assert.doesNotMatch(JSON.stringify(publicList), /synthetic-ltoken|synthetic-cookie|deviceSeed|deviceFp/)
    assert.equal((await api('import', 'POST', { uid: '123456789' })).status, 502)
    assert.equal((await api('accounts')).data.accounts[0].status, 'error')
    assert.ok((await new CredentialStore(file, testCodec).get('123')).cookie)
    await api('logout', 'POST')
    assert.equal((await api('accounts')).data.accounts.length, 1)
    await close(); await start()
    assert.equal((await api('select', 'POST', { id: '123' })).status, 200)
    rejectRecord = false
    assert.equal((await api('import', 'POST', { uid: '123456789' })).status, 200)
    assert.equal((await api('accounts')).data.accounts[0].status, 'ready')
    await api('accounts', 'POST', { cookie: cookie('456') })
    assert.equal((await api('accounts')).data.accounts.length, 2)
    await api('accounts/456', 'DELETE')
    assert.equal((await api('roles')).status, 401)
    assert.deepEqual((await api('accounts')).data.accounts.map(a => a.id), ['123'])
    await close(); await start()
    assert.deepEqual((await api('accounts')).data.accounts.map(a => a.id), ['123'])
})
