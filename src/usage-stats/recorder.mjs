// Usage stats recorder: queues "feature used on this local day" and sends the queue in batches.
// Storage, sending, the clock and the endpoint are injected, so pages never touch storage or the network
// for usage stats, and the tests run without a browser.
// A send never throws into the page; the latest failure is kept for the Debug exports instead.
import { getUsageFeature, USAGE_UPLOAD_RULES } from '../../server/usage-stats-features.mjs'

export const USAGE_STATS_KEYS = Object.freeze({
    installId: 'mona-usage-stats-id',
    queue: 'mona-usage-stats-queue',
    failure: 'mona-usage-stats-failure',
    sent: 'mona-usage-stats-sent',
    sentAt: 'mona-usage-stats-sent-at',
})
const DAY_MS = 86400000

function localDay(date) {
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const dayNumber = day => Date.parse(`${day}T00:00:00Z`) / DAY_MS

export function createUsageStatsRecorder({ storage, send, endpoint, platform, version, clock = () => new Date(),
    isEnabled = () => true, randomId = () => crypto.randomUUID() }) {
    let failure = null, inflight = null
    const active = () => Boolean(endpoint) && isEnabled()

    function fail(stage, error, extra = {}) {
        failure = { stage, reason: error?.message || String(error), ...extra, at: clock().toISOString() }
        // Keep it in memory even when storage is the thing that failed.
        try { storage.setItem(USAGE_STATS_KEYS.failure, JSON.stringify(failure)) } catch {}
    }
    try { failure = JSON.parse(storage.getItem(USAGE_STATS_KEYS.failure) || 'null') } catch (error) { fail('storage', error) }

    // The queue and the already-sent list are both [{feature, day}] arrays in storage.
    function readList(key) {
        try {
            const list = JSON.parse(storage.getItem(key) || '[]')
            if (!Array.isArray(list)) throw new Error(`${key} 不是列表`)
            return list
        } catch (error) {
            fail('storage', error)
            return []
        }
    }
    const readQueue = () => readList(USAGE_STATS_KEYS.queue)
    const key = r => `${r.feature}|${r.day}`
    // The server rejects days further than dayTolerance from its own day, so older records cannot be sent.
    function current(queue) {
        const oldest = dayNumber(localDay(clock())) - USAGE_UPLOAD_RULES.dayTolerance
        return queue.filter(r => dayNumber(r.day) >= oldest)
    }
    function writeList(name, list) {
        if (list.length) storage.setItem(name, JSON.stringify(list))
        else storage.removeItem(name)
    }
    const writeQueue = queue => writeList(USAGE_STATS_KEYS.queue, queue)
    function installId() {
        let id = storage.getItem(USAGE_STATS_KEYS.installId)
        if (!id) { id = randomId(); storage.setItem(USAGE_STATS_KEYS.installId, id) }
        return id
    }

    function record(feature) {
        if (!getUsageFeature(feature)) throw new Error(`未登记的功能 ID：${feature}`)
        if (!active()) return
        try {
            const entry = { feature, day: localDay(clock()) }, queue = current(readQueue())
            // Once per feature and day: skip it when it is queued or was already sent today.
            if ([...queue, ...readList(USAGE_STATS_KEYS.sent)].some(r => key(r) === key(entry))) return
            queue.push(entry)
            writeQueue(queue)
        } catch (error) { fail('storage', error) }
    }

    async function sendQueue(options) {
        let batch, body
        try {
            batch = current(readQueue()).slice(0, USAGE_UPLOAD_RULES.maxRecords)
            if (!batch.length) return
            body = { installId: installId(), platform, version, records: batch }
        } catch (error) { return fail('storage', error) }
        let result
        try { result = await send(body, options) } catch (error) { return fail('send', error) }
        if (!result.ok) return fail('response', new Error(result.message || `HTTP ${result.status}`), { status: result.status })
        try {
            const sent = new Set(batch.map(key))
            writeQueue(current(readQueue()).filter(r => !sent.has(key(r))))
            writeList(USAGE_STATS_KEYS.sent, current([...readList(USAGE_STATS_KEYS.sent), ...batch]))
            storage.setItem(USAGE_STATS_KEYS.sentAt, clock().toISOString())
        } catch (error) { fail('storage', error) }
    }
    function flush(options = {}) {
        if (!active()) return Promise.resolve()
        inflight ||= sendQueue(options).finally(() => { inflight = null })
        return inflight
    }

    function debugInfo() {
        let queued = 0, lastSentAt = null
        try { queued = current(readQueue()).length; lastSentAt = storage.getItem(USAGE_STATS_KEYS.sentAt) } catch {}
        // No install id here: a Debug export must not link a player's report to their usage rows.
        return { active: active(), queued, lastSentAt, lastFailure: failure }
    }

    return { record, flush, debugInfo, active }
}
