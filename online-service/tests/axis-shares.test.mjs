import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers.mjs'
import { createActionAxis } from '../../beta-data/team-engine/action-config.mjs'
import { importTeamDpsConfiguration, emptyTeamDpsLibrary } from '../../beta-data/team-dps-library.mjs'
import { importedAxis } from '../../tests/helpers/team-dps-configuration.mjs'

test('published snapshots can be read and imported anonymously, updated by their owner and revoked', async t => {
    const f = await fixture()
    t.after(() => f.close())
    const user = await f.login(), other = await f.login('reader@example.test')
    const axis = createActionAxis('example', ['Furina', 'Mona', 'Escoffier', 'Skirk'])
    axis.timeline = [{ id: 'start', kind: 'action', actor: 'member1', timeMs: 0, action: 'skill' }]
    const create = (axis, days, requestId = randomUUID()) => f.request('/v1/shares', { method: 'POST', token: user.sessionToken, body: { axis, days, requestId } })
    const requestId = randomUUID()
    assert.equal((await f.request('/v1/shares', {method:'POST', body:{axis,days:30,requestId}})).status, 401)
    const result = await create({ ...axis, inventory: 'PRIVATE', members: axis.members.map(m => ({ ...m, uid: 'PRIVATE' })) }, 30, requestId)
    assert.equal(result.status, 200, JSON.stringify(result.body))
    const share = result.body
    assert.equal((await create(axis, 30, requestId)).body.id, share.id)
    const path = '/v1/shares/' + share.id
    const link = f.base + '/s/' + share.id
    const download = async () => (await fetch(link + '/download')).json()
    assert.equal((await fetch(link)).status, 200)
    assert.equal((await fetch(f.base+'/share-assets/brand.woff2',{headers:{Origin:f.base}})).status,200)
    assert.deepEqual(importTeamDpsConfiguration(emptyTeamDpsLibrary(), JSON.stringify(await download())).axis, axis)
    const update = { method: 'PUT', body: { version: 1, axis: { ...axis, title: '第二版' } } }
    assert.equal((await f.request(path, { ...update, token: other.sessionToken })).status, 404)
    const updated = await f.request(path, { ...update, token: user.sessionToken })
    assert.equal(updated.body.expiresAt, share.expiresAt)
    assert.equal((await download()).title, '第二版')
    assert.equal((await f.request(path, { ...update, body: { version: 1, axis }, token: user.sessionToken })).status, 409)
    const legacy = importedAxis()
    const permanent = await create({ ...legacy, sources:['PRIVATE'], debug:'PRIVATE' }, null)
    delete legacy.sources
    const legacyLink = f.base + '/s/' + permanent.body.id
    const legacyPage = await (await fetch(legacyLink)).text()
    assert.equal((legacyPage.match(/class="switch"/g) || []).length, legacy.timeline.filter(r => r.kind === 'switch').length)
    assert.ok(!legacyPage.includes('PRIVATE'))
    assert.deepEqual(importTeamDpsConfiguration(emptyTeamDpsLibrary(), await (await fetch(legacyLink+'/download')).text()).axis, legacy)
    assert.deepEqual(await (await fetch(f.base + '/s/' + permanent.body.id + '/download')).json(), legacy)
    assert.equal((await f.request('/v1/shares', {token: other.sessionToken})).body.shares.length, 0)
    assert.equal((await f.request('/v1/shares', {token: user.sessionToken})).body.shares.length, 2)
    assert.equal((await f.request(path, {method:'DELETE', token:other.sessionToken})).status,404)
    const query = f.pool.query
    try {
        f.pool.query = async () => { throw new Error('synthetic service outage') }
        const outage = await fetch(link)
        assert.equal(outage.status, 500)
        assert.match(await outage.text(), /重试/)
    } finally { f.pool.query = query }
    assert.equal((await fetch(link)).status, 200)
    await f.request(path, {method: 'DELETE', token: user.sessionToken})
    const canceled = await fetch(link)
    assert.equal(canceled.status, 410)
    assert.match(await canceled.text(), /如需查看，请联系作者获取新链接。/)
    assert.equal((await download()).error.code, 'SHARE_REVOKED')
    const week = await create(axis, 7)
    f.advance(7 * 86400000 - 1)
    assert.equal((await fetch(f.base + '/s/' + week.body.id)).status, 200)
    f.advance(1)
    assert.equal((await fetch(f.base + '/s/' + week.body.id)).status, 410)
    assert.equal((await f.request('/s/' + week.body.id + '/download')).body.error.code, 'SHARE_EXPIRED')
    assert.equal((await fetch(f.base + '/s/' + permanent.body.id)).status, 200)
    const renewed = await create(axis, 30, week.body.id)
    assert.notEqual(renewed.body.id, week.body.id)
    const concurrent = await Promise.all([create(axis,30,week.body.id), create(axis,30,week.body.id)])
    assert.deepEqual(concurrent.map(r=>r.body.id), [renewed.body.id,renewed.body.id])
    f.advance(30 * 86400000 - 1)
    assert.equal((await fetch(f.base+'/s/'+renewed.body.id+'/download')).status,200)
    f.advance(1)
    assert.equal((await fetch(f.base+'/s/'+renewed.body.id+'/download')).status,410)
    assert.equal((await f.request('/s/' + randomUUID() + '/download')).body.error.code, 'SHARE_NOT_FOUND')
})

test('a conditional action and a later action by the initial actor do not invent an unconditional switch back', async () => {
    const { renderShare } = await import('../src/share-page.mjs')
    const axis = createActionAxis('conditional', ['Furina','Mona','Escoffier','Skirk'])
    axis.timeline = [
        { id:'b', actor:'member2', action:'skill', kind:'action', timeMs:0, when:{constellationAtLeast:6} },
        { id:'a', actor:'member1', action:'skill', kind:'action', timeMs:500 },
    ]
    const html = renderShare({axis, publishedAt:new Date(0)},randomUUID())
    assert.equal((html.match(/class="switch"/g)||[]).length,1)
    assert.match(html,/莫娜 ≥ 6 命/)
    assert.doesNotMatch(html,/切至 <b>芙宁娜/)
    assert.doesNotMatch(html,/时间轴总览/)
})
