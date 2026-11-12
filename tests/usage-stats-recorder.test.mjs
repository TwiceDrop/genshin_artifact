import test from 'node:test'
import assert from 'node:assert/strict'
import { createUsageStatsRecorder } from '../src/usage-stats/recorder.mjs'

function memoryStorage() {
    const map = new Map()
    return { map, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }
}
// Local time 2026-11-12 10:00; the recorder uses the player's local day.
function setup({ endpoint = 'https://stats.example.test', send, start = new Date(2026, 10, 12, 10) } = {}) {
    let now = start.getTime()
    const storage = memoryStorage(), sent = []
    let ids = 0
    const recorder = createUsageStatsRecorder({
        storage, endpoint, platform: 'windows', version: '7.2.04', clock: () => new Date(now),
        randomId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
        send: send || (async body => { sent.push(structuredClone(body)); return { ok: true, status: 200 } }),
    })
    return { recorder, storage, sent, advanceDays: n => { now += n * 86400000 } }
}

test('an empty endpoint turns usage stats off completely', async () => {
    const { recorder, storage, sent } = setup({ endpoint: '' })
    recorder.record('page.calculate')
    await recorder.flush()
    assert.equal(sent.length, 0)
    assert.equal(storage.map.size, 0)
    assert.equal(recorder.debugInfo().active, false)
})

test('an unregistered feature id is a programming error', () => {
    const { recorder } = setup()
    assert.throws(() => recorder.record('page.unknown'), /未登记的功能 ID：page\.unknown/)
    assert.throws(() => setup({ endpoint: '' }).recorder.record('page.unknown'), /未登记/)
})

test('records are queued once per feature and local day, then sent in one batch', async () => {
    const { recorder, sent, advanceDays } = setup()
    recorder.record('page.calculate')
    recorder.record('page.calculate')
    recorder.record('action.single-optimize')
    advanceDays(1)
    recorder.record('page.calculate')
    assert.equal(recorder.debugInfo().queued, 3)
    await recorder.flush()
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0], { installId: '00000000-0000-4000-8000-000000000001', platform: 'windows', version: '7.2.04', records: [
        { feature: 'page.calculate', day: '2026-11-12' },
        { feature: 'action.single-optimize', day: '2026-11-12' },
        { feature: 'page.calculate', day: '2026-11-13' },
    ] })
    assert.equal(recorder.debugInfo().queued, 0)
    // Already sent today: not queued again.
    recorder.record('page.calculate')
    assert.equal(recorder.debugInfo().queued, 0)
    recorder.record('action.team-dps')
    await recorder.flush()
    assert.equal(sent[1].installId, sent[0].installId, 'the install id is generated once and kept')
    assert.deepEqual(sent[1].records, [{ feature: 'action.team-dps', day: '2026-11-13' }])
    await recorder.flush()
    assert.equal(sent.length, 2, 'an empty queue sends nothing')
})

test('a failed send keeps the queue, records why, and the next flush retries', async () => {
    let mode = 'network'
    const sent = []
    const { recorder } = setup({ send: async body => {
        if (mode === 'network') throw new TypeError('Failed to fetch')
        if (mode === 'http') return { ok: false, status: 400, message: '第 1 条记录：功能 ID 未登记' }
        sent.push(body); return { ok: true, status: 200 }
    } })
    recorder.record('page.calculate')
    await recorder.flush()
    let info = recorder.debugInfo()
    assert.equal(info.queued, 1)
    assert.equal(info.lastFailure.stage, 'send')
    assert.equal(info.lastFailure.reason, 'Failed to fetch')
    assert.match(info.lastFailure.at, /^2026-11-12T/)
    mode = 'http'
    await recorder.flush()
    info = recorder.debugInfo()
    assert.deepEqual([info.queued, info.lastFailure.stage, info.lastFailure.status, info.lastFailure.reason], [1, 'response', 400, '第 1 条记录：功能 ID 未登记'])
    mode = 'ok'
    await recorder.flush()
    assert.equal(sent.length, 1)
    assert.equal(recorder.debugInfo().queued, 0)
    assert.equal(recorder.debugInfo().lastFailure.stage, 'response', 'the last failure stays visible after a later success')
    assert.ok(recorder.debugInfo().lastSentAt)
})

test('records older than the server accepts are dropped from the queue', async () => {
    const { recorder, sent, advanceDays } = setup()
    recorder.record('page.calculate')            // 11-12
    advanceDays(2)
    recorder.record('page.artifacts')            // 11-14: 11-12 is still within 2 days
    assert.equal(recorder.debugInfo().queued, 2)
    advanceDays(1)                               // 11-15: 11-12 is now 3 days old
    await recorder.flush()
    assert.deepEqual(sent[0].records, [{ feature: 'page.artifacts', day: '2026-11-14' }])
})

test('records added while a send is in flight survive its success, and flushes do not overlap', async () => {
    let release
    const calls = []
    const { recorder } = setup({ send: body => { calls.push(body); return new Promise(r => { release = () => r({ ok: true, status: 200 }) }) } })
    recorder.record('page.calculate')
    const first = recorder.flush(), second = recorder.flush()
    recorder.record('page.artifacts')
    release()
    await Promise.all([first, second])
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].records.map(r => r.feature), ['page.calculate'])
    assert.equal(recorder.debugInfo().queued, 1)
})

test('storage that throws is reported, not thrown into the page', async () => {
    const { recorder, storage } = setup()
    storage.setItem = () => { throw new Error('QuotaExceededError') }
    assert.doesNotThrow(() => recorder.record('page.calculate'))
    const { lastFailure } = recorder.debugInfo()
    assert.equal(lastFailure.stage, 'storage')
    assert.equal(lastFailure.reason, 'QuotaExceededError')
})

test('a corrupt queue in storage is reported and replaced', async () => {
    const { recorder, storage, sent } = setup()
    storage.setItem('mona-usage-stats-queue', '{not json')
    recorder.record('page.calculate')
    assert.equal(recorder.debugInfo().lastFailure.stage, 'storage')
    await recorder.flush()
    assert.deepEqual(sent[0].records, [{ feature: 'page.calculate', day: '2026-11-12' }])
})
