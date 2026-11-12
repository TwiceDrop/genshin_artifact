import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// The fixture clock is 2026-11-07T00:00:00Z: last 7 days = 11-01..11-07, last 30 days = 10-09..11-07.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TOKEN = 'synthetic-admin-token-0123456789abcdef'
const upload = (installId, records, platform = 'windows') => ({ installId, platform, version: '7.2.04', records })
const single = (character, day = '2026-11-07') => ({ feature: 'action.single-optimize', day, character })
const team = (character, day = '2026-11-07') => ({ feature: 'action.team-dps', day, character })

test('records naming a character are stored per install, character, action and day', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = body => f.request('/v1/usage-stats', { method: 'POST', body })
    const result = await post(upload(A, [single('Mona'), single('Mona'), team('Mona'), team('Furina'),
        { feature: 'action.single-optimize', day: '2026-11-07' }, single('Mona', '2026-11-05')]))
    assert.deepEqual(result.body, { accepted: 6 })
    const rows = (await f.pool.query(`SELECT character, feature_id, day::text AS day FROM usage_stats_character_days ORDER BY character, feature_id, day`)).rows
    assert.deepEqual(rows.map(r => [r.character, r.feature_id, r.day]), [
        ['Furina', 'action.team-dps', '2026-11-07'],
        ['Mona', 'action.single-optimize', '2026-11-05'],
        ['Mona', 'action.single-optimize', '2026-11-07'],
        ['Mona', 'action.team-dps', '2026-11-07'],
    ])
    const firsts = (await f.pool.query(`SELECT character, feature_id, first_day::text AS first_day FROM usage_stats_character_firsts ORDER BY character, feature_id`)).rows
    assert.deepEqual(firsts.map(r => [r.character, r.feature_id, r.first_day]),
        [['Furina', 'action.team-dps', '2026-11-07'], ['Mona', 'action.single-optimize', '2026-11-05'], ['Mona', 'action.team-dps', '2026-11-07']])
    // The record without a character is plain feature use.
    assert.deepEqual((await f.pool.query('SELECT feature_id FROM usage_stats_days')).rows, [{ feature_id: 'action.single-optimize' }])
})

test('a character on an action that does not carry one, or an unknown character, rejects the upload', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = body => f.request('/v1/usage-stats', { method: 'POST', body })
    const notCarried = await post(upload(A, [single('Mona'), { feature: 'page.calculate', day: '2026-11-07', character: 'Mona' }]))
    assert.equal(notCarried.status, 400)
    assert.match(notCarried.body.error.message, /第 2 条记录：该功能不记录角色/)
    const unknown = await post(upload(A, [single('NotACharacter')]))
    assert.equal(unknown.status, 400)
    assert.match(unknown.body.error.message, /第 1 条记录：角色未登记/)
    assert.equal((await post(upload(A, [single(42)]))).status, 400)
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM usage_stats_character_days')).rows[0].n, 0)
})

test('the summary ranks characters by installs that ran them, per action and window', async t => {
    const f = await fixture(); t.after(() => f.close())
    f.config.usageStatsAdminToken = TOKEN
    const rows = [
        [A, 'Mona', 'action.single-optimize', '2026-11-07', 'windows'],
        [A, 'Mona', 'action.single-optimize', '2026-11-01', 'windows'],  // same install: still one
        [B, 'Mona', 'action.single-optimize', '2026-10-20', 'windows'],  // inside 30, outside 7
        [C, 'Mona', 'action.single-optimize', '2026-10-20', 'android'],
        [A, 'Furina', 'action.single-optimize', '2026-10-01', 'windows'], // outside 30
        [A, 'Furina', 'action.team-dps', '2026-11-06', 'windows'],
        [B, 'Furina', 'action.team-dps', '2026-11-06', 'windows'],
    ]
    for (const [install, character, feature, day, platform] of rows) {
        await f.pool.query('INSERT INTO usage_stats_character_days VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [install, character, feature, day, platform, '7.2.04'])
        await f.pool.query(`INSERT INTO usage_stats_character_firsts VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (install_id, character, feature_id, platform, version)
            DO UPDATE SET first_day = LEAST(usage_stats_character_firsts.first_day, EXCLUDED.first_day)`, [install, character, feature, platform, '7.2.04', day])
    }
    const summary = async (query = '') => (await f.request(`/v1/usage-stats/summary${query}`, { token: TOKEN })).body
    const all = await summary()
    assert.deepEqual(all.characterFeatures, [{ id: 'action.single-optimize', name: '单人配装' }, { id: 'action.team-dps', name: '四人轴计算' }])
    assert.deepEqual(all.characters.map(c => c.name), ['Mona', 'Furina'])
    assert.equal(all.characters[0].zh, '莫娜')
    assert.deepEqual(all.characters[0].counts, {
        'action.single-optimize': { total: 3, last7: 1, last30: 3 },   // A, B, C; only A within 7 days
        'action.team-dps': { total: 0, last7: 0, last30: 0 },
    })
    assert.deepEqual(all.characters[1].counts, {
        'action.single-optimize': { total: 1, last7: 0, last30: 0 },   // A, 37 days ago
        'action.team-dps': { total: 2, last7: 2, last30: 2 },          // A, B
    })
    const android = await summary('?platform=android')
    assert.deepEqual(android.characters.map(c => [c.name, c.counts['action.single-optimize'].total]), [['Mona', 1]])
    // Day rows past 400 days go with the feature rows; cumulative rows stay.
    await f.pool.query(`INSERT INTO usage_stats_character_days VALUES($1,'Qiqi','action.team-dps','2025-01-01','windows','7.2.04')`, [C])
    await f.worker.recover()
    assert.equal((await f.pool.query(`SELECT count(*)::int AS n FROM usage_stats_character_days WHERE character='Qiqi'`)).rows[0].n, 0)
})
