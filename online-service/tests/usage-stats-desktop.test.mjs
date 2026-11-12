import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { fixture } from './helpers.mjs'
import { createLocalServer } from '../../server/local.mjs'
import { createUsageStatsRecorder } from '../../src/usage-stats/recorder.mjs'
import { desktopUsageStatsSender } from '../../src/platform/usage-stats-transport.mjs'
import { usageStatsTarget } from '../../server/usage-stats-forward.mjs'

// The whole desktop path: recorder → page sender → local server /api/usage-stats → online-service → database.
test('a desktop record reaches the online-service tables through the local server', async t => {
    const f = await fixture(); t.after(() => f.close())
    // Test output stays in the ignored .cache/test folder of the repository.
    const data = fileURLToPath(new URL('../../.cache/test/usage-stats-desktop/', import.meta.url))
    await mkdir(data, { recursive: true }); t.after(() => rm(data, { recursive: true, force: true }))
    const local = createLocalServer({ root: data, credentialStore: { file: path.join(data, 'miyoushe.dpapi') }, updater: {} })
    local.listen(0, '127.0.0.1'); await once(local, 'listening'); t.after(() => new Promise(r => local.close(r)))
    const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) } }
    const recorder = createUsageStatsRecorder({
        storage: memory(),
        endpoint: f.base, platform: 'windows', version: '7.2.04', clock: () => new Date(2026, 10, 7, 10),
        send: desktopUsageStatsSender(f.base, `http://127.0.0.1:${local.address().port}`),
    })
    recorder.setConsent('on')
    recorder.record('page.calculate')
    recorder.record('action.team-dps')
    await recorder.flush()
    assert.equal(recorder.debugInfo().lastFailure, null)
    assert.equal(recorder.debugInfo().queued, 0)
    const rows = (await f.pool.query('SELECT feature_id, day::text AS day, platform, version FROM usage_stats_days ORDER BY feature_id')).rows
    assert.deepEqual(rows, [
        { feature_id: 'action.team-dps', day: '2026-11-07', platform: 'windows', version: '7.2.04' },
        { feature_id: 'page.calculate', day: '2026-11-07', platform: 'windows', version: '7.2.04' },
    ])

    // A rejection from online-service comes back to the recorder as a response failure with the server's reason.
    const bad = createUsageStatsRecorder({ storage: memory(),
        endpoint: f.base, platform: 'windows', version: 'bad version', clock: () => new Date(2026, 10, 7, 10),
        send: desktopUsageStatsSender(f.base, `http://127.0.0.1:${local.address().port}`) })
    bad.setConsent('on')
    bad.record('page.calculate')
    await bad.flush()
    assert.deepEqual([bad.debugInfo().lastFailure.stage, bad.debugInfo().lastFailure.status], ['response', 400])
    assert.match(bad.debugInfo().lastFailure.reason, /版本/)
})

test('the local server forwards only to https, or http on this machine, and only to the upload path', () => {
    assert.equal(usageStatsTarget('https://stats.example.test').href, 'https://stats.example.test/v1/usage-stats')
    assert.equal(usageStatsTarget('https://stats.example.test/mona/').href, 'https://stats.example.test/mona/v1/usage-stats')
    assert.equal(usageStatsTarget('http://127.0.0.1:4198').href, 'http://127.0.0.1:4198/v1/usage-stats')
    for (const bad of ['', 'not a url', 'http://stats.example.test', 'file:///etc/passwd', 'https://user:pass@stats.example.test'])
        assert.throws(() => usageStatsTarget(bad), /使用统计地址/, bad)
})
