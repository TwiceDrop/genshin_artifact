import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'
import { USAGE_UPLOAD_LIMITS } from '../src/usage-stats.mjs'

// The fixture clock starts at 2026-11-07T00:00:00Z, so the server day is 2026-11-07.
const installA = '11111111-1111-4111-8111-111111111111'
const installB = '22222222-2222-4222-8222-222222222222'
const upload = (overrides = {}) => ({ installId: installA, platform: 'windows', version: '7.2.04',
    records: [{ feature: 'page.calculate', day: '2026-11-07' }], ...overrides })

test('accepted records are stored once per install, feature, day, platform and version', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = body => f.request('/v1/usage-stats', { method: 'POST', body })
    const first = await post(upload({ records: [
        { feature: 'page.calculate', day: '2026-11-07' },
        { feature: 'page.calculate', day: '2026-11-06' },
        { feature: 'action.single-optimize', day: '2026-11-07' },
        { feature: 'page.calculate', day: '2026-11-07' },
    ] }))
    assert.equal(first.status, 200)
    assert.deepEqual(first.body, { accepted: 4 })
    assert.equal((await post(upload())).status, 200)
    assert.equal((await post(upload({ installId: installB, platform: 'android' }))).status, 200)
    const days = (await f.pool.query('SELECT install_id, feature_id, day::text AS day, platform, version FROM usage_stats_days ORDER BY install_id, feature_id, day')).rows
    assert.deepEqual(days.map(r => [r.install_id, r.feature_id, r.day, r.platform]), [
        [installA, 'action.single-optimize', '2026-11-07', 'windows'],
        [installA, 'page.calculate', '2026-11-06', 'windows'],
        [installA, 'page.calculate', '2026-11-07', 'windows'],
        [installB, 'page.calculate', '2026-11-07', 'android'],
    ])
    // The cumulative table keeps one row per install, feature, platform and version, so it never counts a repeat.
    const firsts = (await f.pool.query('SELECT install_id, feature_id, first_day::text AS first_day FROM usage_stats_firsts ORDER BY install_id, feature_id')).rows
    assert.deepEqual(firsts.map(r => [r.install_id, r.feature_id, r.first_day]), [
        [installA, 'action.single-optimize', '2026-11-07'],
        [installA, 'page.calculate', '2026-11-06'],
        [installB, 'page.calculate', '2026-11-07'],
    ])
    // A later version is a separate cumulative row; the earliest day wins when an older day arrives late.
    assert.equal((await post(upload({ version: '7.2.05', records: [{ feature: 'page.calculate', day: '2026-11-08' }] }))).status, 200)
    assert.equal((await post(upload({ records: [{ feature: 'page.calculate', day: '2026-11-05' }] }))).status, 200)
    const calculate = (await f.pool.query(`SELECT version, first_day::text AS first_day FROM usage_stats_firsts
        WHERE install_id=$1 AND feature_id='page.calculate' ORDER BY version`, [installA])).rows
    assert.deepEqual(calculate, [{ version: '7.2.04', first_day: '2026-11-05' }, { version: '7.2.05', first_day: '2026-11-08' }])
})

test('one invalid record rejects the whole upload and names the record', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = body => f.request('/v1/usage-stats', { method: 'POST', body })
    const rejected = async (body, pattern) => {
        const result = await post(body)
        assert.equal(result.status, 400, JSON.stringify(body))
        assert.equal(result.body.error.code, 'INVALID_INPUT')
        assert.match(result.body.error.message, pattern)
        return result
    }
    const second = await rejected(upload({ records: [{ feature: 'page.calculate', day: '2026-11-07' }, { feature: 'action.unknown', day: '2026-11-07' }] }), /第 2 条.*功能 ID/)
    assert.equal(second.body.error.index, 1)
    await rejected(upload({ records: [{ feature: 'page.calculate', day: '2026-11-04' }] }), /第 1 条.*日期/)
    await rejected(upload({ records: [{ feature: 'page.calculate', day: '2026-11-10' }] }), /第 1 条.*日期/)
    await rejected(upload({ records: [{ feature: 'page.calculate', day: '2026-11-7' }] }), /第 1 条.*日期/)
    await rejected(upload({ records: [{ feature: 'page.calculate', day: '2026-02-30' }] }), /第 1 条.*日期/)
    await rejected(upload({ records: ['page.calculate'] }), /第 1 条/)
    await rejected(upload({ installId: 'not-a-uuid' }), /安装 ID/)
    await rejected(upload({ platform: 'ios' }), /平台/)
    await rejected(upload({ version: '' }), /版本/)
    await rejected(upload({ version: 'x'.repeat(33) }), /版本/)
    await rejected(upload({ records: [] }), /记录/)
    await rejected(upload({ records: 'page.calculate' }), /记录/)
    const tooMany = Array.from({ length: USAGE_UPLOAD_LIMITS.records + 1 }, () => ({ feature: 'page.calculate', day: '2026-11-07' }))
    await rejected(upload({ records: tooMany }), /记录/)
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM usage_stats_days')).rows[0].n, 0)
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM usage_stats_firsts')).rows[0].n, 0)
    // The edges of the accepted window are two days either side of the server day.
    assert.equal((await post(upload({ records: [{ feature: 'page.calculate', day: '2026-11-05' }, { feature: 'page.calculate', day: '2026-11-09' }] }))).status, 200)
})

test('uploads are rate limited per address in memory only', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = () => f.request('/v1/usage-stats', { method: 'POST', body: upload() })
    for (let i = 0; i < USAGE_UPLOAD_LIMITS.requestsPerWindow; i++) assert.equal((await post()).status, 200)
    const limited = await post()
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error.code, 'RATE_LIMITED')
    assert.ok(limited.body.error.retryAfterSeconds > 0)
    f.advance(USAGE_UPLOAD_LIMITS.windowSeconds * 1000)
    assert.equal((await post()).status, 200)
    // Nothing that names an address reaches the database.
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM rate_limits')).rows[0].n, 0)
    const columns = (await f.pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('usage_stats_days','usage_stats_firsts')`)).rows.map(r => r.column_name)
    assert.deepEqual([...new Set(columns)].sort(), ['day', 'feature_id', 'first_day', 'install_id', 'platform', 'version'])
})

test('usage uploads need no login', async t => {
    const f = await fixture(); t.after(() => f.close())
    assert.equal((await f.request('/v1/usage-stats', { method: 'POST', body: upload(), token: 'not-a-session' })).status, 200)
})
