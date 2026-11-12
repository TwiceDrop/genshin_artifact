// Usage stats recorder: queues "feature used on this local day" and sends the queue in batches.
// Storage, sending, the clock and the endpoint are injected, so pages never touch storage or the network
// for usage stats, and the tests run without a browser.
// A send never throws into the page; the latest failure is kept for the Debug exports instead.
// The player's answer to the first-run notice is kept here too: unanswered records but does not send,
// on records and sends, off records nothing and forgets the queue and the install id.
import { getUsageFeature, USAGE_UPLOAD_RULES } from '../../server/usage-stats-features.mjs'
import { getUsageCharacter } from '../../server/usage-stats-characters.mjs'

export const USAGE_STATS_KEYS = Object.freeze({
    installId: 'mona-usage-stats-id',
    queue: 'mona-usage-stats-queue',
    failure: 'mona-usage-stats-failure',
    sent: 'mona-usage-stats-sent',
    sentAt: 'mona-usage-stats-sent-at',
    consent: 'mona-usage-stats-consent',
})
const DAY_MS = 86400000

function localDay(date) {
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const dayNumber = day => Date.parse(`${day}T00:00:00Z`) / DAY_MS

export function createUsageStatsRecorder({ storage, send, endpoint, platform, version, clock = () => new Date(),
    randomId = () => crypto.randomUUID() }) {
    let failure = null, inflight = null
    // Usage stats exist in this build only when it was built with an endpoint.
    const available = () => Boolean(endpoint)

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
    function consent() {
        try { return storage.getItem(USAGE_STATS_KEYS.consent) } catch (error) { fail('storage', error); return null }
    }
    const canRecord = () => available() && consent() !== 'off'
    const canSend = () => available() && consent() === 'on'
    const needsNotice = () => available() && consent() === null
    function setConsent(value) {
        if (value !== 'on' && value !== 'off') throw new Error(`使用统计开关只能是 on 或 off：${value}`)
        storage.setItem(USAGE_STATS_KEYS.consent, value)
        if (value === 'off') {
            for (const name of [USAGE_STATS_KEYS.queue, USAGE_STATS_KEYS.sent, USAGE_STATS_KEYS.installId, USAGE_STATS_KEYS.failure, USAGE_STATS_KEYS.sentAt]) storage.removeItem(name)
            failure = null
        }
    }
    const key = r => `${r.feature}|${r.day}|${r.character ?? ''}`
    // Keep what the server still accepts (see USAGE_UPLOAD_RULES), newest last, at most maxRecords.
    function current(queue) {
        const oldest = dayNumber(localDay(clock())) - (USAGE_UPLOAD_RULES.pastDays - 1)
        return queue.filter(r => dayNumber(r.day) >= oldest).slice(-USAGE_UPLOAD_RULES.maxRecords)
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

    // `character` is only for actions that carry one (single optimisation, team DPS).
    function record(feature, character) {
        const registered = getUsageFeature(feature)
        if (!registered) throw new Error(`未登记的功能 ID：${feature}`)
        if (character !== undefined && !registered.characters) throw new Error(`功能 ${feature} 不记录角色`)
        if (!canRecord()) return
        // A character comes from player data, so an unknown one is reported for Debug instead of thrown into the page.
        if (character !== undefined && !getUsageCharacter(character)) return fail('record', new Error(`未登记的角色：${character}`))
        try {
            const entry = { feature, day: localDay(clock()), ...(character === undefined ? {} : { character }) }, queue = current(readQueue())
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
        let result, sendError
        try { result = await send(body, options) } catch (error) { sendError = error }
        // Turned off while the batch was on its way: the queue, ids and failure are already gone, keep it that way.
        if (consent() !== 'on') return
        if (sendError) return fail('send', sendError)
        if (!result.ok) return fail('response', new Error(result.message || `HTTP ${result.status}`), { status: result.status })
        try {
            const sent = new Set(batch.map(key))
            writeQueue(current(readQueue()).filter(r => !sent.has(key(r))))
            writeList(USAGE_STATS_KEYS.sent, current([...readList(USAGE_STATS_KEYS.sent), ...batch]))
            storage.setItem(USAGE_STATS_KEYS.sentAt, clock().toISOString())
        } catch (error) { fail('storage', error) }
    }
    function flush(options = {}) {
        if (!canSend()) return Promise.resolve()
        inflight ||= sendQueue(options).finally(() => { inflight = null })
        return inflight
    }

    function debugInfo() {
        let queued = 0, lastSentAt = null
        try { queued = current(readQueue()).length; lastSentAt = storage.getItem(USAGE_STATS_KEYS.sentAt) } catch (error) { fail('storage', error) }
        // No install id here: a Debug export must not link a player's report to their usage rows.
        return { active: canSend(), consent: consent(), queued, lastSentAt, lastFailure: failure }
    }

    return { record, flush, debugInfo, available, consent, setConsent, needsNotice }
}
