import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// 任务 docs/specs/online-accounts/issues/05：账号保存所选的角色头像（角色英文键名，如 Mona），不做图片上传。
test('the avatar starts empty, can be set to a character key, cleared, and is returned wherever the user is', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login()
    const patch = body => f.request('/v1/me', { method: 'PATCH', body, token: a.sessionToken })
    assert.equal(a.user.avatar, null)

    const set = await patch({ avatar: 'Mona' })
    assert.equal(set.status, 200); assert.equal(set.body.user.avatar, 'Mona'); assert.equal(set.body.user.username, 'synthetic-a', 'the username is untouched')
    assert.equal((await f.request('/v1/me', { token: a.sessionToken })).body.user.avatar, 'Mona')
    assert.equal((await f.login()).user.avatar, 'Mona', 'code login returns it')
    assert.equal((await f.request('/v1/auth/password/login', { method: 'POST', body: { account: 'synthetic-a', password: 'synthetic-password' } })).body.user.avatar, 'Mona')

    const both = await patch({ username: '星象', avatar: 'AetherAnemo' })
    assert.equal(both.body.user.username, '星象'); assert.equal(both.body.user.avatar, 'AetherAnemo')
    assert.equal((await patch({ avatar: null })).body.user.avatar, null)
})

test('an avatar that is not a character key, or an empty update, is rejected', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login()
    const patch = body => f.request('/v1/me', { method: 'PATCH', body, token: a.sessionToken })
    for (const avatar of ['', 'mona', '莫娜', 'Mona Lisa', 'A'.repeat(41), '../Mona', 12, true])
        assert.equal((await patch({ avatar })).status, 400, `accepted ${JSON.stringify(avatar)}`)
    assert.equal((await patch({})).status, 400)
    assert.equal((await patch({ avatar: 'Mona', email: 'x@example.test' })).status, 400, 'unknown fields are rejected')
    assert.equal((await f.request('/v1/me', { token: a.sessionToken })).body.user.avatar, null)
})
