import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { fixture, SYNTHETIC_PASSWORD } from './helpers.mjs'

// 任务 docs/specs/online-accounts/issues/03：注销账号要再次确认本人（当前密码或本人邮箱的验证码），删除账号和全部数据，所有会话立即失效。
const sealed = () => ({ ciphertext: randomBytes(600).toString('base64url'), salt: randomBytes(16).toString('base64url'),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }, version: 1 })
async function seed(f, token) {
    assert.equal((await f.request('/v1/cookie-vaults/miyoushe/123456789', { method: 'PUT', body: sealed(), token })).status, 200)
    assert.equal((await f.request('/v1/profiles', { method: 'POST', body: { operationId: randomUUID(), name: '合成档案' }, token })).status, 200)
}
const rows = async (f, userId) => Object.fromEntries(await Promise.all(['users:id', 'sessions:user_id', 'cookie_vaults:user_id', 'profiles:user_id']
    .map(async spec => { const [table, column] = spec.split(':'); return [table, (await f.pool.query(`SELECT 1 FROM ${table} WHERE ${column}=$1`, [userId])).rowCount] })))

test('deleting the account with the current password removes it and everything it owns', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login(), b = await f.login('keeps-b@example.test')
    const second = (await f.request('/v1/auth/password/login', { method: 'POST', body: { account: 'synthetic-a', password: SYNTHETIC_PASSWORD } })).body.sessionToken
    await seed(f, a.sessionToken); await seed(f, b.sessionToken)
    const remove = body => f.request('/v1/me', { method: 'DELETE', body, token: a.sessionToken })

    assert.equal((await remove({})).status, 400, 'a confirmation is required')
    const wrong = await remove({ password: 'not the password' })
    assert.equal(wrong.status, 400); assert.equal(wrong.body.error.code, 'WRONG_PASSWORD')
    assert.deepEqual(await rows(f, a.user.id), { users: 1, sessions: 2, cookie_vaults: 1, profiles: 1 }, 'a refused deletion keeps everything')

    assert.equal((await remove({ password: SYNTHETIC_PASSWORD })).status, 200)
    assert.deepEqual(await rows(f, a.user.id), { users: 0, sessions: 0, cookie_vaults: 0, profiles: 0 })
    for (const token of [a.sessionToken, second]) assert.equal((await f.request('/v1/me', { token })).status, 401)
    assert.deepEqual(await rows(f, b.user.id), { users: 1, sessions: 1, cookie_vaults: 1, profiles: 1 }, 'other accounts are untouched')
    assert.equal((await f.request('/v1/auth/password/login', { method: 'POST', body: { account: 'synthetic-a', password: SYNTHETIC_PASSWORD } })).status, 400)
})

test('deleting the account with a code works only for a code sent to its own email', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login(), b = await f.login('code-b@example.test')
    const send = async email => { await f.request('/v1/auth/email/request', { method: 'POST', body: { email } }); return f.emails.at(-1) }
    const remove = (token, body) => f.request('/v1/me', { method: 'DELETE', body, token })

    const forB = await send('code-b@example.test'), challengeB = (await f.pool.query("SELECT id FROM email_challenges WHERE email='code-b@example.test'")).rows[0].id
    assert.equal((await remove(a.sessionToken, { challengeId: challengeB, code: forB.code })).status, 400, "another account's code cannot delete me")
    assert.equal((await f.request('/v1/me', { token: b.sessionToken })).status, 200)

    const forA = await send('synthetic-a@example.test'), challengeA = (await f.pool.query("SELECT id FROM email_challenges WHERE email='synthetic-a@example.test'")).rows[0].id
    assert.equal((await remove(a.sessionToken, { challengeId: challengeA, code: forA.code })).status, 200)
    assert.equal((await f.request('/v1/me', { token: a.sessionToken })).status, 401)
    assert.equal((await f.pool.query("SELECT 1 FROM email_challenges WHERE email='synthetic-a@example.test'")).rowCount, 0)
    assert.equal((await f.request('/v1/me', { token: b.sessionToken })).status, 200)
})
