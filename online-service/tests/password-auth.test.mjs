import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// 任务 docs/specs/online-accounts/issues/01：注册必须设密码；登录可用「邮箱或用户名 + 密码」，也可用邮箱验证码；验证码登录不再自动建号。
async function sendCode(f, email) {
    const sent = await f.request('/v1/auth/email/request', { method: 'POST', body: { email } })
    assert.equal(sent.status, 200)
    return { challengeId: sent.body.challengeId, code: f.emails.at(-1).code }
}
const register = (f, body) => f.request('/v1/auth/register', { method: 'POST', body: { deviceName: '合成测试设备', ...body } })
const passwordLogin = (f, account, password) => f.request('/v1/auth/password/login', { method: 'POST', body: { account, password, deviceName: '合成测试设备' } })

test('registering needs a code, username and password; then either password or code logs in', async t => {
    const f = await fixture(); t.after(() => f.close())
    const email = 'register-a@example.test', password = 'synthetic pass 莫娜'

    const unregistered = await sendCode(f, email)
    const refused = await f.request('/v1/auth/email/verify', { method: 'POST', body: unregistered })
    assert.equal(refused.status, 404); assert.equal(refused.body.error.code, 'ACCOUNT_NOT_FOUND')
    assert.equal((await f.pool.query('SELECT 1 FROM users WHERE email=$1', [email])).rowCount, 0, 'code login no longer creates an account')

    const created = await register(f, { ...unregistered, username: '星象_Mona', password })
    assert.equal(created.status, 200, 'the code checked by the refused login can still register')
    assert.equal(created.body.user.email, email); assert.equal(created.body.user.username, '星象_Mona')
    assert.equal((await f.request('/v1/me', { token: created.body.sessionToken })).status, 200)
    const stored = (await f.pool.query('SELECT password_hash FROM users WHERE email=$1', [email])).rows[0].password_hash
    assert.ok(stored && !stored.includes(password), 'only a hash is stored')
    assert.equal((await register(f, { ...unregistered, username: '另一个名字', password })).status, 400, 'a used code cannot register again')

    for (const account of [email, 'Register-A@Example.test', '星象_Mona', '星象_mona']) {
        const login = await passwordLogin(f, account, password)
        assert.equal(login.status, 200, `log in as ${account}`); assert.equal(login.body.user.email, email)
        assert.equal((await f.request('/v1/me', { token: login.body.sessionToken })).status, 200)
    }
    const byCode = await f.request('/v1/auth/email/verify', { method: 'POST', body: await sendCode(f, email) })
    assert.equal(byCode.status, 200, 'code login still works for a registered account')

    const wrong = await passwordLogin(f, email, 'not the password')
    const unknown = await passwordLogin(f, 'nobody@example.test', password)
    const unknownName = await passwordLogin(f, '无此用户', password)
    for (const failed of [wrong, unknown, unknownName]) {
        assert.equal(failed.status, 400); assert.equal(failed.body.error.code, 'INVALID_CREDENTIALS')
        assert.equal(failed.body.error.message, wrong.body.error.message, 'the reply does not reveal whether the account exists')
    }
})

test('register rejects a taken email or username and a password outside 8 to 64 characters', async t => {
    const f = await fixture(); t.after(() => f.close())
    assert.equal((await register(f, { ...await sendCode(f, 'first@example.test'), username: '先来的', password: 'synthetic-1' })).status, 200)

    const emailTaken = await register(f, { ...await sendCode(f, 'first@example.test'), username: '后来的', password: 'synthetic-1' })
    assert.equal(emailTaken.status, 409); assert.equal(emailTaken.body.error.code, 'EMAIL_TAKEN')
    const second = await sendCode(f, 'second@example.test')
    const nameTaken = await register(f, { ...second, username: '先来的', password: 'synthetic-1' })
    assert.equal(nameTaken.status, 409); assert.equal(nameTaken.body.error.code, 'USERNAME_TAKEN')
    assert.equal((await f.pool.query("SELECT 1 FROM users WHERE email='second@example.test'")).rowCount, 0)

    for (const password of ['1234567', 'a'.repeat(65), '', 12345678, null])
        assert.equal((await register(f, { ...second, username: '第二个', password })).status, 400, `accepted ${JSON.stringify(password)}`)
    assert.equal((await register(f, { ...second, username: '第', password: 'synthetic-1' })).status, 400, 'the username rule still applies')
    const longest = '密'.repeat(64)
    assert.equal((await register(f, { ...second, username: '第二个', password: longest })).status, 200, '64 characters of any kind fit')
    assert.equal((await passwordLogin(f, '第二个', longest)).status, 200)
    assert.equal((await register(f, { ...await sendCode(f, 'third@example.test'), username: '第三个', password: '  eight  ' })).status, 200, 'spaces count and are kept')
    assert.equal((await passwordLogin(f, '第三个', 'eight')).status, 400)
    assert.equal((await passwordLogin(f, '第三个', '  eight  ')).status, 200)
})

test('password login allows 20 attempts per IP and 10 per account each hour', async t => {
    const f = await fixture(); t.after(() => f.close())
    for (const [email, username] of [['limit-x@example.test', '限流甲'], ['limit-y@example.test', '限流乙']])
        assert.equal((await register(f, { ...await sendCode(f, email), username, password: 'synthetic-1' })).status, 200)

    for (let i = 0; i < 10; i++) assert.equal((await passwordLogin(f, '限流甲', 'wrong-password')).status, 400)
    const accountLimited = await passwordLogin(f, '限流甲', 'synthetic-1')
    assert.equal(accountLimited.status, 429, 'the 11th attempt on one account is refused even with the right password')
    assert.equal((await passwordLogin(f, 'LIMIT-X@example.test', 'synthetic-1')).status, 429, 'email and username share the account limit')
    for (let i = 0; i < 8; i++) assert.equal((await passwordLogin(f, '限流乙', 'synthetic-1')).status, 200)
    assert.equal((await passwordLogin(f, '限流乙', 'synthetic-1')).status, 429, 'the 21st attempt from one IP is refused')

    f.advance(3600000)
    assert.equal((await passwordLogin(f, '限流甲', 'synthetic-1')).status, 200, 'limits reset after an hour')
})
