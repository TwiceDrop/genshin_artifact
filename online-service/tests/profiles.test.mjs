import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers.mjs'
import { SYNC_BODY_LIMIT } from '../src/profiles.mjs'

const deviceId = randomUUID()
const data = name => ({ name, artifacts: { items: [{ id: 101, level: 20, lock: true }] },
    presets: { Example: { artifactIds: [101], dslSource: 'e; q' } }, kumi: { selected: [101] },
    miyoushe: { characters: [{ id: 10000001, uid: '100000001' }] }, comparisonSettings: null,
    teamDpsConfigurations: [{ name: '合成轴', config: { duration: 20, steps: ['E','Q'] } }], teamDpsTasks: [] })
const commit = (baseRevision, name) => ({ operationId: randomUUID(), baseRevision, deviceId, schemaVersion: 1,
    appVersion: '7.2.4', engineVersion: 'mona-team-engine/58', data: data(name) })
const history = (kind = 'single', status = 'completed') => ({ syncId: randomUUID(),
    summary: { kind, status, title: '合成历史', startedAt: 100, endedAt: 200, engineVersion: 'legacy-fixture/1' },
    detail: { schemaVersion: 1, engineVersion: 'legacy-fixture/1', frozenInputs: { artifactIds: [101], dsl: 'e; q' }, results: [{ score: 123.4 }] } })

// Two phase-two purposes: coherent profile CAS/lifecycle/isolation; immutable history pagination/isolation.
test('profile CAS, preserved conflicts, operation idempotency, tombstones and tenant isolation', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login(), b = await f.login('profile-b@example.test')
    const req = (path, method = 'GET', body, token = a.sessionToken) => f.request(path, { method, body, token })
    const createInput = { operationId: randomUUID(), name: '合成档案' }
    const created = await req('/v1/profiles', 'POST', createInput)
    assert.equal(created.status, 200); assert.equal(created.body.profile.revision, 0)
    const id = created.body.profile.id, base = `/v1/profiles/${id}`
    const replayCreate = await req('/v1/profiles', 'POST', createInput)
    assert.equal(replayCreate.body.profile.id, id); assert.equal(replayCreate.body.replayed, true)
    assert.equal((await req('/v1/profiles', 'POST', { ...createInput, name: 'changed' })).body.error.code, 'OPERATION_ID_REUSED')
    assert.equal((await req(base)).body.revision, null)
    const initialInput = commit(0, '完整档案')
    const initial = await req(base + '/revisions', 'PUT', initialInput)
    assert.equal(initial.status, 200); assert.equal(initial.body.profile.revision, 1)
    assert.equal(initial.body.revision.data, undefined)
    assert.deepEqual((await req(base)).body.revision.data, initialInput.data)
    assert.equal((await req(base + '/revisions', 'PUT', initialInput)).body.replayed, true)
    assert.equal((await req(base + '/revisions', 'PUT', { ...initialInput, data: data('变更') })).body.error.code, 'OPERATION_ID_REUSED')
    assert.equal((await req(base + '/revisions', 'PUT', { ...commit(1, '坏字段'), data: { ...data('坏字段'), cookie: 'SYNTHETIC_NOT_ALLOWED' } })).status, 400)
    assert.equal((await req(base + '/revisions', 'PUT', { ...commit(1, '未知格式'), schemaVersion: 2 })).status, 422)
    const left = commit(1, '设备一'), right = { ...commit(1, '设备二'), deviceId: randomUUID() }
    const concurrent = await Promise.all([req(base + '/revisions', 'PUT', left), req(base + '/revisions', 'PUT', right)])
    assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409])
    const winnerIndex = concurrent.findIndex(result => result.status === 200), loserIndex = 1 - winnerIndex
    const inputs = [left, right], branch = concurrent[loserIndex].body.error.revision
    assert.equal(branch.status, 'conflict'); assert.equal(branch.data, undefined)
    assert.equal(concurrent[loserIndex].body.error.code, 'PROFILE_CONFLICT')
    assert.deepEqual((await req(base)).body.revision.data, inputs[winnerIndex].data)
    assert.deepEqual((await req(base + `/revisions/${branch.revision}`)).body.revision.data, inputs[loserIndex].data)
    const duplicateConflict = await req(base + '/revisions', 'PUT', inputs[loserIndex])
    assert.equal(duplicateConflict.status, 409); assert.equal(duplicateConflict.body.error.replayed, true)
    assert.equal(duplicateConflict.body.error.revision.revision, branch.revision)
    const page1 = (await req(base + '/revisions?limit=2')).body
    assert.equal(page1.revisions.length, 2); assert.equal(typeof page1.nextCursor, 'number')
    const page2 = (await req(base + `/revisions?limit=2&before=${page1.nextCursor}`)).body
    assert.equal(page2.revisions.length, 1); assert.equal(page2.nextCursor, null)
    assert.ok([...page1.revisions, ...page2.revisions].every(row => row.data === undefined))
    assert.equal((await req(base + '/revisions?limit=101')).status, 400)
    const head = (await req(base)).body.profile.revision
    const resolution = await req(base + '/revisions', 'PUT', { ...commit(head, '已选择冲突副本'), data: inputs[loserIndex].data })
    assert.equal(resolution.status, 200); assert.equal(resolution.body.profile.revision, 4)
    assert.deepEqual((await req(base + '/revisions/1')).body.revision.data, initialInput.data, 'old revisions stay unchanged')
    const large = commit(4, '大于旧32KiB')
    large.data.presets.note = 'x'.repeat(40000)
    assert.equal((await req(base + '/revisions', 'PUT', large)).status, 200)
    const tooLarge = commit(5, '超限')
    tooLarge.data.presets.note = 'x'.repeat(SYNC_BODY_LIMIT)
    assert.equal((await req(base + '/revisions', 'PUT', tooLarge)).status, 413)
    assert.equal((await req('/v1/auth/email/request', 'POST', { email: 'size@example.test', padding: 'x'.repeat(33000) })).status, 413, 'auth retains 32 KiB limit')
    assert.equal((await req('/v1/profiles', 'GET', undefined, b.sessionToken)).body.profiles.length, 0)
    for (const [suffix, method, body] of [['','GET',undefined], ['/revisions','GET',undefined], ['/revisions/1','GET',undefined], ['/revisions','PUT',commit(5, ' чужой ')], ['', 'DELETE', { operationId: randomUUID(), baseRevision: 5, deviceId }]]) {
        assert.equal((await req(base + suffix, method, body, b.sessionToken)).status, 404)
    }
    const staleDelete = await req(base, 'DELETE', { operationId: randomUUID(), baseRevision: 4, deviceId })
    assert.equal(staleDelete.status, 409); assert.equal((await req(base)).body.profile.revision, 5)
    const deletion = { operationId: randomUUID(), baseRevision: 5, deviceId }
    const removed = await req(base, 'DELETE', deletion)
    assert.equal(removed.status, 200); assert.equal(removed.body.profile.name, null)
    assert.equal((await req(base, 'DELETE', deletion)).body.replayed, true)
    assert.equal((await req(base, 'DELETE', { ...deletion, baseRevision: 4 })).body.error.code, 'OPERATION_ID_REUSED')
    assert.equal((await req(base)).status, 410)
    assert.equal((await req(base + '/revisions', 'PUT', initialInput)).status, 410)
    assert.equal((await req('/v1/profiles', 'POST', createInput)).status, 410)
    assert.equal((await req('/v1/profiles')).body.profiles.length, 0)
    assert.equal((await req('/v1/profiles?includeDeleted=true')).body.profiles[0].id, id)
    assert.equal((await req(base, 'GET', undefined, b.sessionToken)).status, 404)
    assert.equal((await f.pool.query('SELECT * FROM profile_revisions WHERE profile_id=$1', [id])).rows.length, 0)
    const tombstone = (await f.pool.query('SELECT * FROM profiles WHERE id=$1', [id])).rows[0]
    assert.equal(tombstone.create_request, null); assert.equal(tombstone.name, null)
    assert.deepEqual(tombstone.delete_request, deletion)
    assert.equal(f.errors.length, 0)
})

test('immutable terminal history, independent sequence pagination, limits and deletion isolation', async t => {
    const f = await fixture(); t.after(() => f.close())
    const a = await f.login(), b = await f.login('history-b@example.test')
    const req = (path, method = 'GET', body, token = a.sessionToken) => f.request(path, { method, body, token })
    const id = (await req('/v1/profiles', 'POST', { operationId: randomUUID(), name: '历史档案' })).body.profile.id
    const base = `/v1/profiles/${id}`
    await req(base + '/revisions', 'PUT', commit(0, '历史档案'))
    const first = history()
    const accepted = await req(base + '/history', 'POST', first)
    assert.equal(accepted.status, 200); assert.equal(accepted.body.accepted, true)
    assert.equal(accepted.body.entry.sequence, 1); assert.equal(accepted.body.entry.detail, undefined)
    const replay = await req(base + '/history', 'POST', { syncId: first.syncId, detail: first.detail, summary: { ...first.summary } })
    assert.equal(replay.body.replayed, true); assert.equal(replay.body.entry.sequence, 1)
    assert.equal((await req(base + '/history', 'POST', { ...first, detail: { ...first.detail, changed: true } })).body.error.code, 'HISTORY_ID_REUSED')
    assert.deepEqual((await req(base + `/history/${first.syncId}`)).body.entry.detail, first.detail)
    assert.equal((await req(base)).body.profile.revision, 1, 'history append cannot change profile CAS revision')
    const more = [history('team','failed'), history('single','cancelled'), history('team','interrupted')]
    const appended = await Promise.all(more.map(row => req(base + '/history', 'POST', row)))
    assert.deepEqual(appended.map(row => row.body.entry.sequence).sort(), [2,3,4])
    const firstPage = (await req(base + '/history?limit=2&after=0')).body
    assert.deepEqual(firstPage.entries.map(row => row.sequence), [1,2]); assert.equal(firstPage.nextCursor, 2)
    const nextPage = (await req(base + '/history?limit=2&after=2')).body
    assert.deepEqual(nextPage.entries.map(row => row.sequence), [3,4]); assert.equal(nextPage.nextCursor, null)
    assert.ok([...firstPage.entries, ...nextPage.entries].every(row => row.detail === undefined))
    assert.equal((await req(base + '/history?after=4')).body.entries.length, 0)
    const later = await req(base + '/history', 'POST', history())
    assert.equal(later.body.entry.sequence, 5)
    assert.deepEqual((await req(base + '/history?after=4')).body.entries.map(row => row.sequence), [5])
    for (const status of ['running','queued','unknown']) assert.equal((await req(base + '/history', 'POST', history('single', status))).status, 400)
    for (const key of ['id','accountId','progress','storageError','syncId']) {
        const invalid = history(); invalid.summary[key] = 1
        assert.equal((await req(base + '/history', 'POST', invalid)).status, 400)
    }
    const tooMuchSummary = history(); tooMuchSummary.summary.extra = 'x'.repeat(65536)
    assert.equal((await req(base + '/history', 'POST', tooMuchSummary)).status, 413)
    const largeHistory = history(); largeHistory.detail.extra = 'x'.repeat(40000)
    assert.equal((await req(base + '/history', 'POST', largeHistory)).status, 200)
    const tooMuchHistory = history(); tooMuchHistory.detail.extra = 'x'.repeat(SYNC_BODY_LIMIT)
    assert.equal((await req(base + '/history', 'POST', tooMuchHistory)).status, 413)
    assert.equal((await req(base + '/history?after=-1')).status, 400)
    for (const [path, method, body] of [[base + '/history','GET',undefined], [base + '/history','POST',history()], [base + `/history/${first.syncId}`,'GET',undefined]]) {
        assert.equal((await req(path, method, body, b.sessionToken)).status, 404)
    }
    await req(base, 'DELETE', { operationId: randomUUID(), baseRevision: 1, deviceId })
    assert.equal((await req(base + '/history', 'POST', first)).status, 410)
    assert.equal((await req(base + `/history/${first.syncId}`)).status, 410)
    assert.equal((await f.pool.query('SELECT * FROM profile_history WHERE profile_id=$1', [id])).rows.length, 0)
    assert.equal((await f.pool.query('SELECT * FROM profile_revisions WHERE profile_id=$1', [id])).rows.length, 0)
    assert.equal(f.errors.length, 0)
})
