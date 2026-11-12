import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.mjs'

// The fixture clock is 2026-11-07T00:00:00Z. Windows: last 7 days = 11-01..11-07, last 30 days = 10-09..11-07.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const dayRows = [
    [A, 'page.calculate', '2026-11-07', 'windows', '7.2.04'],
    [A, 'page.calculate', '2026-11-07', 'windows', '7.2.05'],   // same install, same day, second version
    [A, 'page.calculate', '2026-11-01', 'windows', '7.2.04'],   // 6 days ago: inside 7 days
    [A, 'action.single-optimize', '2026-10-20', 'windows', '7.2.04'], // 18 days ago: inside 30, outside 7
    [B, 'page.calculate', '2026-11-06', 'windows', '7.2.05'],
    [B, 'page.calculate', '2025-01-01', 'windows', '7.2.04'],   // older than 400 days: cleaned up
    [C, 'page.artifacts', '2026-10-01', 'android', '7.2.04'],   // 37 days ago: outside 30
    [C, 'page.calculate', '2026-10-31', 'android', '7.2.04'],   // 7 days ago: outside 7, inside 30
]
const firstRows = [
    [A, 'page.calculate', 'windows', '7.2.04', '2026-11-01'],
    [A, 'page.calculate', 'windows', '7.2.05', '2026-11-07'],
    [A, 'action.single-optimize', 'windows', '7.2.04', '2026-10-20'],
    [B, 'page.calculate', 'windows', '7.2.05', '2026-11-06'],
    [B, 'page.calculate', 'windows', '7.2.04', '2025-01-01'],
    [C, 'page.artifacts', 'android', '7.2.04', '2026-10-01'],
    [C, 'page.calculate', 'android', '7.2.04', '2026-10-31'],
]
const TOKEN = 'synthetic-admin-token-0123456789abcdef'

async function seeded(t) {
    const f = await fixture(); t.after(() => f.close())
    f.config.usageStatsAdminToken = TOKEN
    for (const row of dayRows) await f.pool.query('INSERT INTO usage_stats_days(install_id,feature_id,day,platform,version) VALUES($1,$2,$3,$4,$5)', row)
    for (const row of firstRows) await f.pool.query('INSERT INTO usage_stats_firsts(install_id,feature_id,platform,version,first_day) VALUES($1,$2,$3,$4,$5)', row)
    f.summary = (query = '', token = TOKEN) => f.request(`/v1/usage-stats/summary${query}`, { token })
    return f
}
const pick = (body, id) => {
    const { total, last7, last30, share30 } = body.features.find(x => x.id === id)
    return { total, last7, last30, share30 }
}

test('the summary counts each install once per feature and window', async t => {
    const f = await seeded(t)
    const { status, body } = await f.summary()
    assert.equal(status, 200)
    assert.equal(body.today, '2026-11-07')
    assert.equal(body.activeInstalls30, 3)                       // A, B, C
    assert.deepEqual(pick(body, 'page.calculate'), { total: 3, last7: 2, last30: 3, share30: 1 })
    assert.deepEqual(pick(body, 'action.single-optimize'), { total: 1, last7: 0, last30: 1, share30: 1 / 3 })
    assert.deepEqual(pick(body, 'page.artifacts'), { total: 1, last7: 0, last30: 0, share30: 0 })
    assert.deepEqual(pick(body, 'action.team-dps'), { total: 0, last7: 0, last30: 0, share30: 0 })
    const calculate = body.features.find(x => x.id === 'page.calculate')
    assert.equal(calculate.name, '配装计算')
    assert.equal(calculate.category, 'page')
    assert.equal(body.features.length, 26)
    assert.deepEqual(body.platforms, ['windows', 'android'])
    assert.deepEqual(body.versions, ['7.2.04', '7.2.05'])
    // 90 days ending today; A on 11-07 in two versions is one install.
    assert.equal(body.daily.length, 90)
    assert.deepEqual(body.daily.at(-1), { day: '2026-11-07', installs: 1 })
    assert.deepEqual(body.daily[0], { day: '2026-08-10', installs: 0 })
    const nonZero = Object.fromEntries(body.daily.filter(d => d.installs).map(d => [d.day, d.installs]))
    assert.deepEqual(nonZero, { '2026-10-01': 1, '2026-10-20': 1, '2026-10-31': 1, '2026-11-01': 1, '2026-11-06': 1, '2026-11-07': 1 })
})

test('platform and version filters narrow every number', async t => {
    const f = await seeded(t)
    const windows = (await f.summary('?platform=windows')).body
    assert.equal(windows.activeInstalls30, 2)                    // A, B
    assert.deepEqual(pick(windows, 'page.calculate'), { total: 2, last7: 2, last30: 2, share30: 1 })
    assert.deepEqual(pick(windows, 'action.single-optimize'), { total: 1, last7: 0, last30: 1, share30: 0.5 })
    assert.deepEqual(pick(windows, 'page.artifacts'), { total: 0, last7: 0, last30: 0, share30: 0 })
    const v204 = (await f.summary('?version=7.2.04')).body
    assert.equal(v204.activeInstalls30, 2)                       // A (11-01, 10-20), C (10-31)
    assert.deepEqual(pick(v204, 'page.calculate'), { total: 3, last7: 1, last30: 2, share30: 1 })
    const both = (await f.summary('?platform=android&version=7.2.05')).body
    assert.equal(both.activeInstalls30, 0)
    assert.deepEqual(pick(both, 'page.calculate'), { total: 0, last7: 0, last30: 0, share30: null })
    assert.equal((await f.summary('?platform=ios')).status, 400)
    assert.equal((await f.summary('?version=%3Cscript%3E')).status, 400)
})

test('cleanup removes day rows older than 400 days and keeps cumulative counts', async t => {
    const f = await seeded(t)
    await f.worker.recover()
    const days = (await f.pool.query('SELECT day::text AS day FROM usage_stats_days ORDER BY day')).rows.map(r => r.day)
    assert.equal(days.length, 7)
    assert.equal(days[0], '2026-10-01')
    const after = (await f.summary('?version=7.2.04')).body
    assert.deepEqual(pick(after, 'page.calculate'), { total: 3, last7: 1, last30: 2, share30: 1 })
})

test('the summary needs the admin token, and no token is configured means no access', async t => {
    const f = await seeded(t)
    assert.equal((await f.request('/v1/usage-stats/summary')).status, 401)
    assert.equal((await f.summary('', 'wrong-token')).status, 401)
    f.config.usageStatsAdminToken = ''
    const empty = await f.request('/v1/usage-stats/summary', { headers: { Authorization: 'Bearer ' } })
    assert.equal(empty.status, 401)
    assert.equal((await f.summary('', '')).status, 401)
})

test('the stats page is served as static files with a strict policy', async t => {
    const f = await seeded(t)
    const page = await fetch(`${f.base}/admin/stats`)
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-type'), /^text\/html/)
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/)
    const html = await page.text()
    assert.match(html, /<script src="\/admin\/stats\.js"/)
    assert.doesNotMatch(html, /https?:\/\//)
    for (const [path, type] of [['/admin/stats.js', /javascript/], ['/admin/stats.css', /css/]]) {
        const asset = await fetch(f.base + path)
        assert.equal(asset.status, 200, path)
        assert.match(asset.headers.get('content-type'), type)
        // The SVG namespace is an identifier, not a request.
        const text = (await asset.text()).replaceAll('http://www.w3.org/2000/svg', '')
        assert.doesNotMatch(text, /https?:\/\//, `${path} loads nothing from outside`)
    }
    for (const path of ['/admin/stats.html', '/admin/package.json', '/admin/stats/../../src/main.mjs'])
        assert.notEqual((await fetch(f.base + path)).status, 200, path)
})
