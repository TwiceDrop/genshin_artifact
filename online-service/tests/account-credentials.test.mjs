import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, SYNTHETIC_PASSWORD } from './helpers.mjs'

// 任务 docs/specs/online-accounts/issues/02：改密码（要旧密码，成功后注销其他设备）、改邮箱（新邮箱验证码）、忘记密码（邮箱验证码重设，注销所有设备）。
async function sendCode(f, email) {
    const sent = await f.request('/v1/auth/email/request', { method: 'POST', body: { email } })
    assert.equal(sent.status, 200)
    return { challengeId: sent.body.challengeId, code: f.emails.at(-1).code }
}
const passwordLogin = (f, account, password) => f.request('/v1/auth/password/login', { method: 'POST', body: { account, password } })

test('changing the password needs the current one and signs out the other devices', async t => {
    const f = await fixture(); t.after(() => f.close())
    const here = await f.login(), other = (await passwordLogin(f, 'synthetic-a', SYNTHETIC_PASSWORD)).body.sessionToken
    const change = body => f.request('/v1/me/password', { method: 'POST', body, token: here.sessionToken })

    const wrong = await change({ currentPassword: 'not the password', newPassword: 'brand-new-pass' })
    assert.equal(wrong.status, 400); assert.equal(wrong.body.error.code, 'WRONG_PASSWORD')
    assert.equal((await change({ currentPassword: SYNTHETIC_PASSWORD, newPassword: 'short' })).status, 400, 'the new password follows the 8–64 rule')
    assert.equal((await f.request('/v1/me', { token: other })).status, 200, 'refused changes sign nobody out')

    assert.equal((await change({ currentPassword: SYNTHETIC_PASSWORD, newPassword: 'brand-new-pass' })).status, 200)
    assert.equal((await f.request('/v1/me', { token: here.sessionToken })).status, 200, 'this device stays signed in')
    assert.equal((await f.request('/v1/me', { token: other })).status, 401, 'other devices are signed out')
    assert.equal((await passwordLogin(f, 'synthetic-a', SYNTHETIC_PASSWORD)).status, 400)
    assert.equal((await passwordLogin(f, 'synthetic-a', 'brand-new-pass')).status, 200)
    assert.equal((await f.request('/v1/me/password', { method: 'POST', body: { currentPassword: 'brand-new-pass', newPassword: 'another-pass' } })).status, 401)
})

test('wrong current passwords are limited to 10 an hour per account', async t => {
    const f = await fixture(); t.after(() => f.close())
    const { sessionToken } = await f.login()
    const change = currentPassword => f.request('/v1/me/password', { method: 'POST', body: { currentPassword, newPassword: 'brand-new-pass' }, token: sessionToken })
    for (let i = 0; i < 10; i++) assert.equal((await change('wrong-password')).status, 400)
    assert.equal((await change(SYNTHETIC_PASSWORD)).status, 429)
    f.advance(3600000)
    assert.equal((await change(SYNTHETIC_PASSWORD)).status, 200)
})

test('changing the email needs a code sent to the new address, which must be free', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login(), b = await f.login('email-b@example.test')
    const change = (token, body) => f.request('/v1/me/email', { method: 'POST', body, token })

    const taken = await change(a.sessionToken, await sendCode(f, 'email-b@example.test'))
    assert.equal(taken.status, 409); assert.equal(taken.body.error.code, 'EMAIL_TAKEN')
    const proof = await sendCode(f, 'New-Address@Example.test')
    assert.equal((await change(a.sessionToken, { ...proof, code: proof.code === '000000' ? '000001' : '000000' })).status, 400)
    const changed = await change(a.sessionToken, proof)
    assert.equal(changed.status, 200); assert.equal(changed.body.user.email, 'new-address@example.test')
    assert.equal((await change(a.sessionToken, proof)).status, 400, 'a used code cannot be reused')

    assert.equal((await passwordLogin(f, 'new-address@example.test', SYNTHETIC_PASSWORD)).status, 200)
    assert.equal((await passwordLogin(f, 'synthetic-a@example.test', SYNTHETIC_PASSWORD)).status, 400)
    assert.equal((await f.request('/v1/me', { token: b.sessionToken })).body.user.email, 'email-b@example.test')
})

test('a forgotten password is reset with an email code, which signs out every device', async t => {
    const f = await fixture(); t.after(() => f.close())
    const { sessionToken } = await f.login()
    const reset = body => f.request('/v1/auth/password/reset', { method: 'POST', body })

    const unknown = await sendCode(f, 'nobody@example.test')
    const known = await sendCode(f, 'synthetic-a@example.test')
    assert.equal((await reset({ ...unknown, newPassword: 'reset-password' })).status, 404, 'an address with no account cannot reset')
    assert.equal((await reset({ ...known, newPassword: 'short' })).status, 400)
    assert.equal((await f.request('/v1/me', { token: sessionToken })).status, 200)

    assert.equal((await reset({ ...known, newPassword: 'reset-password' })).status, 200)
    assert.equal((await f.request('/v1/me', { token: sessionToken })).status, 401, 'every device is signed out')
    assert.equal((await reset({ ...known, newPassword: 'reset-again-1' })).status, 400, 'a used code cannot be reused')
    assert.equal((await passwordLogin(f, 'synthetic-a', SYNTHETIC_PASSWORD)).status, 400)
    assert.equal((await passwordLogin(f, 'synthetic-a', 'reset-password')).status, 200)
})
