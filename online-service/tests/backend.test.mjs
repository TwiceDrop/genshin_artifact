import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// Authentication and encrypted OTP/session secrets. Encrypted cookie storage and its tenant isolation: cookie-vaults.test.mjs.
test('authentication and tenant isolation with encrypted OTP/session secrets', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = (path, body, token) => f.request(path, { method: 'POST', body, token })
    assert.equal((await f.request('/healthz')).status, 200)
    assert.equal((await post('/v1/auth/email/request', { email: 'not-an-email' })).status, 400)
    const sent = await post('/v1/auth/email/request', { email: 'Code@Example.test' })
    assert.equal(sent.status, 200)
    assert.equal(sent.body.code, undefined)
    const code = f.emails.at(-1).code
    assert.match(code, /^\d{6}$/)
    const challenge = (await f.pool.query('SELECT * FROM email_challenges WHERE id=$1', [sent.body.challengeId])).rows[0]
    assert.equal(f.vault.open(challenge.code_cipher, `otp:${challenge.id}`), code)
    assert.ok(!challenge.code_cipher.includes(code))
    assert.throws(() => f.vault.open(challenge.code_cipher, 'otp:wrong-context'))
    assert.equal((await post('/v1/auth/email/request', { email: 'code@example.test' })).status, 429)
    const wrong = code === '000000' ? '000001' : '000000'
    for (let i = 0; i < 5; i++) assert.equal((await post('/v1/auth/email/verify', { challengeId: challenge.id, code: wrong })).status, 400)
    assert.equal((await post('/v1/auth/email/verify', { challengeId: challenge.id, code })).status, 400)
    const a = await f.login(), b = await f.login('synthetic-b@example.test')
    const aToken = a.sessionToken, bToken = b.sessionToken
    assert.match(aToken, /^[0-9a-f-]{36}\.[\w-]{43}$/)
    assert.equal((await post('/v1/auth/email/verify', { challengeId: a.challengeId, code: a.code })).status, 400)
    assert.equal((await f.request('/v1/me', { token: `${aToken.split('.')[0]}.${'x'.repeat(43)}` })).status, 401)
    const session = (await f.pool.query('SELECT * FROM sessions WHERE id=$1', [aToken.split('.')[0]])).rows[0]
    assert.ok(!session.secret_cipher.includes(aToken.split('.')[1]))
    await f.request(`/v1/sessions/${aToken.split('.')[0]}`, { method: 'DELETE', token: bToken })
    assert.equal((await f.request('/v1/me', { token: aToken })).status, 200)
    const sessions = await f.request('/v1/sessions', { token: aToken })
    assert.equal(sessions.body.sessions[0].current, true)
    assert.equal(sessions.body.sessions[0].secret_cipher, undefined)
    assert.equal((await f.request('/v1/me', { token: aToken, headers: { Origin: 'https://untrusted.example' } })).status, 403)
    await post('/v1/auth/logout', {}, aToken)
    assert.equal((await f.request('/v1/me', { token: aToken })).status, 401)
    f.state.mailFailure = true
    assert.equal((await post('/v1/auth/email/request', { email: 'mail-fails@example.test' })).status, 503)
    assert.deepEqual(f.errors.at(-1), { code: 'EAUTH', event: 'mail_send' })
    f.state.mailFailure = false
    const expiring = await post('/v1/auth/email/request', { email: 'expires@example.test' })
    const expiringCode = f.emails.at(-1).code
    f.advance(601000)
    assert.equal((await post('/v1/auth/email/verify', { challengeId: expiring.body.challengeId, code: expiringCode })).status, 400)
    let throttled = false
    for (let i = 0; i < 21; i++) {
        const result = await post('/v1/auth/email/request', { email: `quota-${i}@example.test` })
        if (result.status === 429) { throttled = true; break }
    }
    assert.equal(throttled, true, 'IP rate limit must apply across different email addresses')
    f.advance(31 * 86400000)
    assert.equal((await f.request('/v1/me', { token: bToken })).status, 401)
})
