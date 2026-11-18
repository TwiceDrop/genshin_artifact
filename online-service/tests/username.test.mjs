import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// 用户名全站唯一（不区分大小写），以后可用于邮箱或用户名登录。规则：去掉首尾空格后 2–16 个字，只含中文、字母、数字、下划线和短横线。
test('username is set at registration, can be changed, survives login and is unique ignoring case', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login(), b = await f.login('username-b@example.test')
    const patch = (token, body) => f.request('/v1/me', { method: 'PATCH', body, token })
    assert.equal(a.user.username, 'synthetic-a')
    assert.equal((await f.request('/v1/me', { token: a.sessionToken })).body.user.username, 'synthetic-a')

    const set = await patch(a.sessionToken, { username: '  莫娜_Mona-1  ' })
    assert.equal(set.status, 200); assert.equal(set.body.user.username, '莫娜_Mona-1'); assert.equal(set.body.user.email, a.user.email)
    assert.equal((await f.request('/v1/me', { token: a.sessionToken })).body.user.username, '莫娜_Mona-1')
    assert.equal((await f.login()).user.username, '莫娜_Mona-1', 'logging in again returns the saved username')
    assert.equal((await patch(a.sessionToken, { username: '莫娜_Mona-1' })).status, 200, 'saving your own name again is allowed')

    for (const taken of ['莫娜_Mona-1', '莫娜_mona-1', '莫娜_MONA-1']) {
        const clash = await patch(b.sessionToken, { username: taken })
        assert.equal(clash.status, 409, `${taken} should be taken`); assert.equal(clash.body.error.code, 'USERNAME_TAKEN')
    }
    assert.equal((await f.request('/v1/me', { token: b.sessionToken })).body.user.username, 'username-b', 'a rejected name is not saved')

    assert.equal((await patch(a.sessionToken, { username: '占星术士' })).body.user.username, '占星术士')
    assert.equal((await patch(b.sessionToken, { username: '莫娜_mona-1' })).status, 200, 'a released name can be taken by someone else')
})

test('username outside the rule is rejected at the entry with a 400', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login()
    for (const username of ['莫', 'a'.repeat(17), 'a b', '<b>莫娜</b>', '莫娜!', '   ', 12345, null])
        assert.equal((await f.request('/v1/me', { method: 'PATCH', body: { username }, token: a.sessionToken })).status, 400, `accepted ${JSON.stringify(username)}`)
    assert.equal((await f.request('/v1/me', { method: 'PATCH', body: { username: '十六个字十六个字十六个字十六个字' }, token: a.sessionToken })).status, 200, '16 Chinese characters fit')
    assert.equal((await f.request('/v1/me', { method: 'PATCH', body: { username: '莫娜' } })).status, 401)
})
