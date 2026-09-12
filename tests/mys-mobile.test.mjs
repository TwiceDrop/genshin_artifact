import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeCookie, publicAccount } from '../server/cookie.mjs'

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
    const mock = { MysClient, normalizeCookie, publicAccount, nativeFetch: () => { throw Error('Unexpected real network') },
        MonaLocal: { readVault: async () => ({ text: vault }), writeVault: async ({ text }) => { vault = text } } }
    const key = '__monaMobileTest'
    globalThis[key] = mock
    const code = fs.readFileSync(new URL('../src/platform/mys-mobile.mjs', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
    const { mobileMysApi: api } = await import('data:text/javascript;base64,' + Buffer.from(`const { MysClient, normalizeCookie, publicAccount, MonaLocal, nativeFetch } = globalThis.${key};\n${code}`).toString('base64'))
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
