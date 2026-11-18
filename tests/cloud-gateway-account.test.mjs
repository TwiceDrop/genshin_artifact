import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { CloudGateway } from '../server/cloud.mjs'

// 任务 docs/specs/online-accounts/issues/07：本机网关放行改密码、改邮箱，改邮箱后更新缓存的登录用户，注销账号后清掉本机会话和 Cookie 密钥。
// 合成凭据；用真实 DPAPI，所以只在 Windows 上跑。
test('the local gateway forwards account changes and forgets the session after the account is deleted', { skip: process.platform !== 'win32' }, async t => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mona-cloud-account-test-'))
    const token = '22222222-2222-4222-8222-222222222222.synthetic-session-secret'
    const sent = []
    const remote = http.createServer(async (req, res) => {
        let raw = ''; for await (const chunk of req) raw += chunk
        const body = raw ? JSON.parse(raw) : {}
        sent.push({ url: req.url, method: req.method, authorization: req.headers.authorization, body })
        let value = { ok: true }
        if (req.url === '/v1/auth/email/verify') value = { sessionToken: token, user: { id: 'synthetic-user', email: 'old@example.invalid', username: '合成' }, expiresAt: '2099-01-01T00:00:00Z' }
        else if (req.url === '/v1/me/email') value = { user: { id: 'synthetic-user', email: 'new@example.invalid', username: '合成' } }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value))
    })
    await new Promise(resolve => remote.listen(0, '127.0.0.1', resolve))
    t.after(async () => { await new Promise(resolve => remote.close(resolve)); await rm(dir, { recursive: true, force: true }) })

    const gateway = new CloudGateway({ file: path.join(dir, 'cloud.dpapi'), credentialStore: {} })
    await gateway.handle('/config', 'PUT', { url: `http://127.0.0.1:${remote.address().port}` })
    await gateway.handle('/v1/auth/email/verify', 'POST', { challengeId: 'synthetic', code: '123456' })
    await gateway.handle('/cookie-key', 'PUT', { key: 'synthetic-key', salt: 'synthetic-salt', kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 } })

    assert.equal((await gateway.handle('/v1/me/password', 'POST', { currentPassword: 'old-password', newPassword: 'new-password' })).status, 200)
    assert.equal(sent.at(-1).url, '/v1/me/password'); assert.equal(sent.at(-1).authorization, `Bearer ${token}`)
    assert.equal((await gateway.handle('/v1/me/email', 'POST', { challengeId: 'synthetic', code: '123456' })).status, 200)
    assert.equal((await gateway.handle('/config', 'GET')).data.user.email, 'new@example.invalid', 'the cached user follows the email change')
    assert.equal((await gateway.store.get('online')).sessionToken, token, 'account changes keep this device signed in')

    assert.equal((await gateway.handle('/v1/me', 'DELETE', { password: 'new-password' })).status, 200)
    assert.equal(sent.at(-1).method, 'DELETE'); assert.deepEqual(sent.at(-1).body, { password: 'new-password' })
    assert.equal((await gateway.handle('/config', 'GET')).data.user, null)
    const saved = await gateway.store.get('online')
    assert.equal(saved.sessionToken, null); assert.equal(saved.cookieKey, null)
})
