import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fixture } from './helpers.mjs'

// 任务 docs/specs/online-accounts/issues/04：米游社 Cookie 端到端加密，服务器只存客户端加密后的密文、盐和派生参数，不能解密，也不再定时拉取。
const KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }
const sealed = (bytes = 1200) => ({ ciphertext: randomBytes(bytes).toString('base64url'), salt: randomBytes(16).toString('base64url'), kdf: KDF, version: 1 })

test('each user uploads, lists, reads, overwrites and deletes only their own encrypted cookies', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = (await f.login()).sessionToken, b = (await f.login('vault-b@example.test')).sessionToken
    const call = (token, method, path, body) => f.request(`/v1/cookie-vaults${path}`, { method, body, token })

    const first = sealed()
    const put = await call(a, 'PUT', '/miyoushe/123456789', first)
    assert.equal(put.status, 200); assert.equal(put.body.vault.accountUid, '123456789'); assert.equal(put.body.vault.ciphertext, undefined)
    assert.equal((await call(a, 'PUT', '/hoyolab/987654321', sealed())).status, 200)

    const listed = (await call(a, 'GET', '')).body.vaults
    assert.deepEqual(listed.map(v => `${v.platform}/${v.accountUid}`).sort(), ['hoyolab/987654321', 'miyoushe/123456789'])
    assert.ok(listed.every(v => v.ciphertext === undefined && v.salt === undefined), 'the list carries no ciphertext')
    const read = (await call(a, 'GET', '/miyoushe/123456789')).body.vault
    assert.deepEqual({ ciphertext: read.ciphertext, salt: read.salt, kdf: read.kdf, version: read.version }, first, 'the server returns exactly what was uploaded')

    const second = sealed(900)
    await call(a, 'PUT', '/miyoushe/123456789', second)
    assert.equal((await call(a, 'GET', '/miyoushe/123456789')).body.vault.ciphertext, second.ciphertext, 'uploading again overwrites')

    assert.equal((await call(b, 'GET', '')).body.vaults.length, 0)
    for (const method of ['GET', 'DELETE']) assert.equal((await call(b, method, '/miyoushe/123456789')).status, 404)
    assert.equal((await call(b, 'PUT', '/miyoushe/123456789', sealed())).status, 200, 'the same game account can be stored by another user separately')
    assert.equal((await call(a, 'GET', '/miyoushe/123456789')).body.vault.ciphertext, second.ciphertext, "another user's upload does not touch mine")

    assert.equal((await call(a, 'DELETE', '/miyoushe/123456789')).status, 200)
    assert.equal((await call(a, 'GET', '/miyoushe/123456789')).status, 404)
    assert.equal((await call(a, 'DELETE', '/miyoushe/123456789')).status, 404)
    assert.equal((await call(b, 'GET', '/miyoushe/123456789')).status, 200)
})

test('uploads outside the agreed format are rejected and nothing is stored', async t => {
    const f = await fixture(); t.after(() => f.close())
    const token = (await f.login()).sessionToken
    const put = (path, body) => f.request(`/v1/cookie-vaults${path}`, { method: 'PUT', body, token })
    const good = sealed()
    const bad = [
        ['/steam/123', good], ['/miyoushe/12a', good], ['/miyoushe/' + '1'.repeat(21), good],
        ['/miyoushe/1', { ...good, kdf: { ...KDF, iterations: 599999 } }],
        ['/miyoushe/1', { ...good, kdf: { ...KDF, name: 'scrypt' } }],
        ['/miyoushe/1', { ...good, kdf: { ...KDF, hash: 'SHA-1' } }],
        ['/miyoushe/1', { ...good, kdf: { ...KDF, iterations: 600000.5 } }],
        ['/miyoushe/1', { ...good, ciphertext: 'x'.repeat(8193) }],
        ['/miyoushe/1', { ...good, ciphertext: 'not base64url!' }],
        ['/miyoushe/1', { ...good, ciphertext: '' }],
        ['/miyoushe/1', { ...good, salt: randomBytes(8).toString('base64url') }],
        ['/miyoushe/1', { ...good, version: 0 }],
        ['/miyoushe/1', { ...good, version: '1' }],
    ]
    for (const [path, body] of bad) assert.equal((await put(path, body)).status, 400, `accepted ${path} ${JSON.stringify(body).slice(0, 80)}`)
    assert.equal((await f.request('/v1/cookie-vaults', { token })).body.vaults.length, 0)
    assert.equal((await put('/miyoushe/1', { ...good, kdf: { ...KDF, iterations: 2000000 }, ciphertext: 'x'.repeat(8192) })).status, 200, 'more iterations and an 8192-character ciphertext fit')
})

test('changing the passphrase replaces every encrypted cookie at once, or none', async t => {
    const f = await fixture(); t.after(() => f.close())
    const token = (await f.login()).sessionToken
    const call = (method, path, body) => f.request(`/v1/cookie-vaults${path}`, { method, body, token })
    await call('PUT', '/miyoushe/111', sealed()); await call('PUT', '/hoyolab/222', sealed())
    const before = await Promise.all(['/miyoushe/111', '/hoyolab/222'].map(async path => (await call('GET', path)).body.vault.ciphertext))

    const missingOne = await call('PUT', '', { vaults: [{ platform: 'miyoushe', accountUid: '111', ...sealed() }] })
    assert.equal(missingOne.status, 409); assert.equal(missingOne.body.error.code, 'VAULT_SET_CHANGED')
    const oneInvalid = await call('PUT', '', { vaults: [{ platform: 'miyoushe', accountUid: '111', ...sealed() }, { platform: 'hoyolab', accountUid: '222', ...sealed(), kdf: { ...KDF, iterations: 1 } }] })
    assert.equal(oneInvalid.status, 400)
    const extra = await call('PUT', '', { vaults: [{ platform: 'miyoushe', accountUid: '111', ...sealed() }, { platform: 'hoyolab', accountUid: '222', ...sealed() }, { platform: 'hoyolab', accountUid: '333', ...sealed() }] })
    assert.equal(extra.status, 409)
    assert.deepEqual(await Promise.all(['/miyoushe/111', '/hoyolab/222'].map(async path => (await call('GET', path)).body.vault.ciphertext)), before, 'a refused replacement changes nothing')

    const next = [{ platform: 'hoyolab', accountUid: '222', ...sealed() }, { platform: 'miyoushe', accountUid: '111', ...sealed() }]
    const replaced = await call('PUT', '', { vaults: next })
    assert.equal(replaced.status, 200); assert.equal(replaced.body.vaults.length, 2)
    for (const vault of next) assert.equal((await call('GET', `/${vault.platform}/${vault.accountUid}`)).body.vault.ciphertext, vault.ciphertext)
})

test('server-side hosting and scheduled fetching are gone; maintenance still cleans up', async t => {
    const f = await fixture(); t.after(() => f.close())
    const token = (await f.login()).sessionToken
    for (const path of ['/v1/game-accounts', '/v1/jobs/00000000-0000-4000-8000-000000000000'])
        assert.equal((await f.request(path, { token })).status, 404)
    const tables = (await f.pool.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('game_accounts','sync_jobs','game_snapshots')")).rows
    assert.deepEqual(tables, [])

    await f.request('/v1/auth/email/request', { method: 'POST', body: { email: 'cleanup@example.test' } })
    f.advance(2 * 86400000)
    await f.maintenance.run()
    assert.equal((await f.pool.query("SELECT 1 FROM email_challenges WHERE email='cleanup@example.test'")).rowCount, 0, 'expired codes are removed')
    assert.equal((await f.pool.query('SELECT 1 FROM rate_limits')).rowCount, 0, 'old rate-limit windows are removed')
})
