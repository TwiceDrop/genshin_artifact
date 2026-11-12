// Usage stats: receives anonymous per-day feature use from the clients.
// It reads and writes only the usage_stats_* tables; accounts, sessions and game data stay elsewhere.
// The address is used for rate limiting in memory and never stored or logged.
import { readFile } from 'node:fs/promises'
import { ApiError, invalid } from './errors.mjs'
import { transaction } from './db.mjs'
import { isUuid } from './auth.mjs'
import { sameSecret } from './crypto.mjs'
import { getUsageFeature, listUsageFeatures, USAGE_PLATFORMS, USAGE_UPLOAD_RULES } from '../../server/usage-stats-features.mjs'

export const USAGE_UPLOAD_LIMITS = Object.freeze({
    records: USAGE_UPLOAD_RULES.maxRecords,
    bodyBytes: 65536,
    pastDays: USAGE_UPLOAD_RULES.pastDays,
    futureDays: USAGE_UPLOAD_RULES.futureDays,
    requestsPerWindow: 120,
    windowSeconds: 600,
})
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/
const DAY_MS = 86400000
const RETENTION_DAYS = 400, DAILY_DAYS = 90
const utcDay = date => date.toISOString().slice(0, 10)

// Day rows older than 400 days go; the cumulative rows stay, so totals do not drop.
export async function pruneUsageStats(db, now) {
    await db.query('DELETE FROM usage_stats_days WHERE day < $1::date - $2::int', [utcDay(now), RETENTION_DAYS])
}

// The stats page: three fixed files, nothing else under /admin is served.
const PAGE_FILES = new Map([
    ['/admin/stats', ['stats.html', 'text/html; charset=utf-8']],
    ['/admin/stats.js', ['stats.js', 'text/javascript; charset=utf-8']],
    ['/admin/stats.css', ['stats.css', 'text/css; charset=utf-8']],
])
export const USAGE_STATS_PAGE_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
export async function usageStatsPageFile(path) {
    const entry = PAGE_FILES.get(path)
    if (!entry) return null
    return { type: entry[1], body: await readFile(new URL(`../static/${entry[0]}`, import.meta.url)) }
}

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
        if (day < today - USAGE_UPLOAD_LIMITS.pastDays || day > today + USAGE_UPLOAD_LIMITS.futureDays)
            reject(`日期超出服务器日期前 ${USAGE_UPLOAD_LIMITS.pastDays} 天到后 ${USAGE_UPLOAD_LIMITS.futureDays} 天的范围`)
    })
    return { installId: installId.toLowerCase(), platform, version, records }
}

function parseFilters(searchParams) {
    const platform = searchParams.get('platform') || '', version = searchParams.get('version') || ''
    if (platform && !USAGE_PLATFORMS.includes(platform)) throw invalid('平台不正确')
    if (version && !VERSION.test(version)) throw invalid('版本格式不正确')
    return { platform, version }
}

export function createUsageStats({ pool, config, clock = () => new Date() }) {
    function authorize(header) {
        const expected = config.usageStatsAdminToken
        const given = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
        // An unset token closes the page rather than opening it to an empty Authorization header.
        if (!expected || !given || !sameSecret(given, expected)) throw new ApiError(401, 'UNAUTHORIZED', '统计口令不正确')
    }
    async function summary(searchParams, authorization) {
        authorize(authorization)
        const { platform, version } = parseFilters(searchParams)
        const today = utcDay(clock())
        // Filter conditions numbered from `first`, so each query can put its own parameters ahead of them.
        const filter = first => {
            const sql = [], values = []
            if (platform) { values.push(platform); sql.push(`platform = $${first + values.length - 1}`) }
            if (version) { values.push(version); sql.push(`version = $${first + values.length - 1}`) }
            return { and: sql.map(s => ` AND ${s}`).join(''), values }
        }
        const firstsFilter = filter(1), daysFilter = filter(2)
        const days = [today, ...daysFilter.values]
        const window = length => `day BETWEEN $1::date - ${length - 1} AND $1::date`
        const [totals, recent, active, daily, versions] = await Promise.all([
            pool.query(`SELECT feature_id, count(DISTINCT install_id)::int AS n FROM usage_stats_firsts WHERE true${firstsFilter.and} GROUP BY feature_id`, firstsFilter.values),
            pool.query(`SELECT feature_id, count(DISTINCT install_id) FILTER (WHERE day >= $1::date - 6)::int AS last7,
                count(DISTINCT install_id)::int AS last30 FROM usage_stats_days WHERE ${window(30)}${daysFilter.and} GROUP BY feature_id`, days),
            pool.query(`SELECT count(DISTINCT install_id)::int AS n FROM usage_stats_days WHERE ${window(30)}${daysFilter.and}`, days),
            pool.query(`SELECT day::text AS day, count(DISTINCT install_id)::int AS n FROM usage_stats_days WHERE ${window(DAILY_DAYS)}${daysFilter.and} GROUP BY day`, days),
            pool.query('SELECT DISTINCT version FROM usage_stats_firsts ORDER BY version'),
        ])
        const total = new Map(totals.rows.map(r => [r.feature_id, r.n]))
        const windows = new Map(recent.rows.map(r => [r.feature_id, r]))
        const activeInstalls30 = active.rows[0].n
        const perDay = new Map(daily.rows.map(r => [r.day, r.n]))
        const start = Date.parse(`${today}T00:00:00Z`) - (DAILY_DAYS - 1) * DAY_MS
        return {
            today, filters: { platform, version }, activeInstalls30,
            platforms: [...USAGE_PLATFORMS], versions: versions.rows.map(r => r.version),
            features: listUsageFeatures().map(({ id, category, name }) => {
                const last30 = windows.get(id)?.last30 || 0
                return { id, category, name, total: total.get(id) || 0, last7: windows.get(id)?.last7 || 0, last30,
                    share30: activeInstalls30 ? last30 / activeInstalls30 : null }
            }),
            daily: Array.from({ length: DAILY_DAYS }, (_, i) => {
                const day = utcDay(new Date(start + i * DAY_MS))
                return { day, installs: perDay.get(day) || 0 }
            }),
        }
    }
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
    return { ingest, summary }
}
