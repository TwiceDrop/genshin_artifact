// Usage stats: receives anonymous per-day feature use from the clients.
// It reads and writes only the usage_stats_* tables; accounts, sessions and game data stay elsewhere.
// The address is used for rate limiting in memory and never stored or logged.
import { ApiError, invalid } from './errors.mjs'
import { transaction } from './db.mjs'
import { isUuid } from './auth.mjs'
import { getUsageFeature, USAGE_PLATFORMS } from '../../server/usage-stats-features.mjs'

export const USAGE_UPLOAD_LIMITS = Object.freeze({
    records: 500,          // the client queue holds at most 500 records
    bodyBytes: 65536,
    dayTolerance: 2,       // days either side of the server's UTC day
    requestsPerWindow: 120,
    windowSeconds: 600,
})
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/
const DAY_MS = 86400000

function dayNumber(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / DAY_MS : null
}

function createMemoryLimiter(clock, maximum, seconds) {
    let current = -1
    const hits = new Map()
    return address => {
        const now = clock().getTime(), window = Math.floor(now / (seconds * 1000))
        if (window !== current) { hits.clear(); current = window }
        const count = (hits.get(address) || 0) + 1
        hits.set(address, count)
        if (count > maximum) throw new ApiError(429, 'RATE_LIMITED', '上报过于频繁，请稍后重试',
            { retryAfterSeconds: Math.ceil(((window + 1) * seconds * 1000 - now) / 1000) })
    }
}

function parseUpload(input, today) {
    const { installId, platform, version, records } = input
    if (!isUuid(installId)) throw invalid('匿名安装 ID 格式不正确')
    if (!USAGE_PLATFORMS.includes(platform)) throw invalid('平台不正确')
    if (typeof version !== 'string' || !VERSION.test(version)) throw invalid('版本格式不正确')
    if (!Array.isArray(records) || !records.length || records.length > USAGE_UPLOAD_LIMITS.records)
        throw invalid(`记录必须是 1～${USAGE_UPLOAD_LIMITS.records} 条的列表`)
    records.forEach((record, index) => {
        const reject = reason => { throw new ApiError(400, 'INVALID_INPUT', `第 ${index + 1} 条记录：${reason}`, { index }) }
        if (!record || typeof record !== 'object' || Array.isArray(record)) reject('格式不正确')
        if (typeof record.feature !== 'string' || !getUsageFeature(record.feature)) reject('功能 ID 未登记')
        const day = dayNumber(record.day)
        if (day === null) reject('日期格式不正确')
        if (Math.abs(day - today) > USAGE_UPLOAD_LIMITS.dayTolerance) reject('日期和服务器日期相差超过 2 天')
    })
    return { installId: installId.toLowerCase(), platform, version, records }
}

export function createUsageStats({ pool, clock = () => new Date() }) {
    const limit = createMemoryLimiter(clock, USAGE_UPLOAD_LIMITS.requestsPerWindow, USAGE_UPLOAD_LIMITS.windowSeconds)
    async function ingest(input, address) {
        limit(address)
        const today = Math.floor(clock().getTime() / DAY_MS)
        const { installId, platform, version, records } = parseUpload(input, today)
        // Collapse repeats inside one upload: ON CONFLICT cannot touch the same row twice in one statement.
        const days = new Map(), firsts = new Map()
        for (const { feature, day } of records) {
            days.set(`${feature}|${day}`, [feature, day])
            if (!firsts.has(feature) || day < firsts.get(feature)) firsts.set(feature, day)
        }
        await transaction(pool, async db => {
            await db.query(`INSERT INTO usage_stats_days(install_id, feature_id, day, platform, version)
                SELECT $1, f, d, $2, $3 FROM unnest($4::text[], $5::date[]) AS r(f, d)
                ON CONFLICT DO NOTHING`, [installId, platform, version, [...days.values()].map(r => r[0]), [...days.values()].map(r => r[1])])
            await db.query(`INSERT INTO usage_stats_firsts(install_id, feature_id, platform, version, first_day)
                SELECT $1, f, $2, $3, d FROM unnest($4::text[], $5::date[]) AS r(f, d)
                ON CONFLICT (install_id, feature_id, platform, version)
                DO UPDATE SET first_day = LEAST(usage_stats_firsts.first_day, EXCLUDED.first_day)`,
            [installId, platform, version, [...firsts.keys()], [...firsts.values()]])
        })
        return { accepted: records.length }
    }
    return { ingest }
}
