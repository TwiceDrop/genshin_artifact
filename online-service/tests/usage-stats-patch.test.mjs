import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// The fixture clock is 2026-11-07T00:00:00Z. The patch is the content patch active in the client when it reported.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TOKEN = 'synthetic-admin-token-0123456789abcdef'
const upload = (installId, extra = {}, records = [{ feature: 'page.calculate', day: '2026-11-07' }]) =>
    ({ installId, platform: 'windows', version: '7.2.04', records, ...extra })

async function setup(t) {
    const f = await fixture(); t.after(() => f.close())
    f.config.usageStatsAdminToken = TOKEN
    f.post = body => f.request('/v1/usage-stats', { method: 'POST', body })
    f.summary = (query = '') => f.request(`/v1/usage-stats/summary${query}`, { token: TOKEN })
    f.days = async () => (await f.pool.query('SELECT install_id, feature_id, patch FROM usage_stats_days ORDER BY install_id, feature_id')).rows
    return f
}

test('a patch number is stored with the day row, and no patch is stored as an empty string', async t => {
    const f = await setup(t)
    assert.equal((await f.post(upload(A, { patch: '7.2.04.01' }))).status, 200)
    assert.equal((await f.post(upload(B))).status, 200)
    assert.deepEqual(await f.days(), [
        { install_id: A, feature_id: 'page.calculate', patch: '7.2.04.01' },
        { install_id: B, feature_id: 'page.calculate', patch: '' },
    ])
    // The cumulative table is not split by patch.
    const columns = (await f.pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_stats_firsts'")).rows.map(r => r.column_name)
    assert.ok(!columns.includes('patch'))
})

test('a row keeps the patch it was first stored with, and an EA patch number is accepted', async t => {
    const f = await setup(t)
    await f.post(upload(A, { version: '7.2.05EA', patch: '7.2.05EA.01' }))
    await f.post(upload(A, { version: '7.2.05EA', patch: '7.2.05EA.02' }))
    assert.deepEqual(await f.days(), [{ install_id: A, feature_id: 'page.calculate', patch: '7.2.05EA.01' }])
})

test('a malformed patch number is refused and nothing is stored', async t => {
    const f = await setup(t)
    for (const patch of ['', 'x'.repeat(33), 'a b', '7.2.04/../x', 5, null, ['7.2.04.01']]) {
        const response = await f.post(upload(A, { patch }))
        assert.equal(response.status, 400, JSON.stringify(patch))
        assert.match(response.body.error.message, /补丁/)
    }
    assert.deepEqual(await f.days(), [])
})

test('the summary lists the patches and a patch filter only narrows the per-day numbers', async t => {
    const f = await setup(t)
    await f.post(upload(A, { patch: '7.2.04.01' }, [{ feature: 'page.calculate', day: '2026-11-07' }, { feature: 'action.single-optimize', day: '2026-11-06' }]))
    await f.post(upload(B, {}, [{ feature: 'page.calculate', day: '2026-11-07' }]))
    await f.post(upload(C, { patch: '7.2.04.02' }, [{ feature: 'page.calculate', day: '2026-11-05' }]))
    const all = (await f.summary()).body
    assert.deepEqual(all.patches, ['7.2.04.01', '7.2.04.02'])
    assert.equal(all.filters.patch, '')
    assert.equal(all.activeInstalls30, 3)

    const first = (await f.summary('?patch=7.2.04.01')).body
    assert.equal(first.filters.patch, '7.2.04.01')
    assert.equal(first.activeInstalls30, 1)
    assert.equal(first.activeInstalls7, 1)
    assert.equal(first.features.find(x => x.id === 'page.calculate').last30, 1)
    assert.equal(first.features.find(x => x.id === 'action.single-optimize').last30, 1)
    assert.equal(first.daily.find(d => d.day === '2026-11-07').installs, 1)
    assert.equal(first.daily.find(d => d.day === '2026-11-05').installs, 0)
    assert.equal(first.features.find(x => x.id === 'page.calculate').total, 3, 'cumulative totals ignore the patch filter')
    assert.equal(first.totalInstalls, 3)

    const none = (await f.summary('?patch=9.9.9')).body
    assert.equal(none.activeInstalls30, 0)
})

test('a patch filter is validated and an empty one means all patches', async t => {
    const f = await setup(t)
    assert.equal((await f.summary('?patch=a%20b')).status, 400)
    assert.equal((await f.summary('?patch=')).status, 200)
})
