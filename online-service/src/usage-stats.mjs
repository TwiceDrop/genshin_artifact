// Usage stats: receives anonymous per-day feature use from the clients, and for single optimisation and team DPS
// also the characters they ran for.
// It reads and writes only the usage_stats_* tables; accounts, sessions and game data stay elsewhere.
// The address is used for rate limiting in memory and never stored or logged.
import { readFile } from 'node:fs/promises'
import { ApiError, invalid } from './errors.mjs'
import { transaction } from './db.mjs'
import { isUuid } from './auth.mjs'
import { sameSecret } from './crypto.mjs'
import { getUsageFeature, listUsageFeatures, USAGE_PLATFORMS, USAGE_UPLOAD_RULES } from '../../server/usage-stats-features.mjs'
import { getUsageCharacter } from '../../server/usage-stats-characters.mjs'

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
// Maintenance runs every minute, so this deletes only when the UTC day has changed since the last run.
export function createUsageStatsPruner() {
    let prunedDay = null
    return async (db, now) => {
        const day = utcDay(now)
        if (day === prunedDay) return
        await db.query('DELETE FROM usage_stats_days WHERE day < $1::date - $2::int', [day, RETENTION_DAYS])
        await db.query('DELETE FROM usage_stats_character_days WHERE day < $1::date - $2::int', [day, RETENTION_DAYS])
        prunedDay = day
    }
}

// The stats page: a fixed set of files, nothing else under /admin is served.
const PAGE_FILES = new Map([
    ['/admin/stats', ['stats.html', 'text/html; charset=utf-8']],
    ['/admin/stats.js', ['stats.js', 'text/javascript; charset=utf-8']],
    ['/admin/stats.css', ['stats.css', 'text/css; charset=utf-8']],
    ['/admin/avatars.js', ['avatars.js', 'text/javascript; charset=utf-8']],
    ['/admin/mona.png', ['mona.png', 'image/png']],
])
// Pictures may also come from the game's own CDN hosts, for character avatars; nothing else leaves the origin.
export const USAGE_STATS_PAGE_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https://act-webstatic.mihoyo.com https://upload-bbs.mihoyo.com https://fastcdn.mihoyo.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
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
    // 内容补丁号可选：没有补丁的客户端不带这个字段，存成空字符串
    const patch = input.patch === undefined ? '' : input.patch
    if (!isUuid(installId)) throw invalid('匿名安装 ID 格式不正确')
    if (!USAGE_PLATFORMS.includes(platform)) throw invalid('平台不正确')
    if (typeof version !== 'string' || !VERSION.test(version)) throw invalid('版本格式不正确')
    if (patch !== '' && (typeof patch !== 'string' || !VERSION.test(patch))) throw invalid('补丁号格式不正确')
    if (input.patch === '') throw invalid('补丁号格式不正确')
    if (!Array.isArray(records) || !records.length || records.length > USAGE_UPLOAD_LIMITS.records)
        throw invalid(`记录必须是 1～${USAGE_UPLOAD_LIMITS.records} 条的列表`)
    records.forEach((record, index) => {
        const reject = reason => { throw new ApiError(400, 'INVALID_INPUT', `第 ${index + 1} 条记录：${reason}`, { index }) }
        if (!record || typeof record !== 'object' || Array.isArray(record)) reject('格式不正确')
        const feature = typeof record.feature === 'string' ? getUsageFeature(record.feature) : undefined
        if (!feature) reject('功能 ID 未登记')
        if (record.character !== undefined) {
            if (!feature.characters) reject('该功能不记录角色')
            if (typeof record.character !== 'string' || !getUsageCharacter(record.character)) reject('角色未登记')
        }
        const day = dayNumber(record.day)
        if (day === null) reject('日期格式不正确')
        if (day < today - USAGE_UPLOAD_LIMITS.pastDays || day > today + USAGE_UPLOAD_LIMITS.futureDays)
            reject(`日期超出服务器日期前 ${USAGE_UPLOAD_LIMITS.pastDays} 天到后 ${USAGE_UPLOAD_LIMITS.futureDays} 天的范围`)
    })
    return { installId: installId.toLowerCase(), platform, version, patch, records }
}

function parseFilters(searchParams) {
    const platform = searchParams.get('platform') || '', version = searchParams.get('version') || '', patch = searchParams.get('patch') || ''
    if (platform && !USAGE_PLATFORMS.includes(platform)) throw invalid('平台不正确')
    if (version && !VERSION.test(version)) throw invalid('版本格式不正确')
    if (patch && !VERSION.test(patch)) throw invalid('补丁号格式不正确')
    return { platform, version, patch }
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
        const { platform, version, patch } = parseFilters(searchParams)
        const today = utcDay(clock())
        // Filter conditions numbered from `first`, so each query can put its own parameters ahead of them.
        // 补丁只记在按天的行里，累计表不按补丁拆分，所以补丁筛选只作用于按天的查询（近 7 天、近 30 天和每日活跃）。
        const filter = (first, byPatch = false) => {
            const sql = [], values = []
            if (platform) { values.push(platform); sql.push(`platform = $${first + values.length - 1}`) }
            if (version) { values.push(version); sql.push(`version = $${first + values.length - 1}`) }
            if (patch && byPatch) { values.push(patch); sql.push(`patch = $${first + values.length - 1}`) }
            return { and: sql.map(s => ` AND ${s}`).join(''), values }
        }
        const firstsFilter = filter(1), daysFilter = filter(2, true)
        const days = [today, ...daysFilter.values]
        // 按角色的按天表没有补丁列，这里的查询不按补丁筛选
        const characterDaysFilter = filter(2), characterDays = [today, ...characterDaysFilter.values]
        const window = length => `day BETWEEN $1::date - ${length - 1} AND $1::date`
        const [totals, recent, active, daily, versions, characterTotals, characterRecent, installs, patches] = await Promise.all([
            pool.query(`SELECT feature_id, count(DISTINCT install_id)::int AS n FROM usage_stats_firsts WHERE true${firstsFilter.and} GROUP BY feature_id`, firstsFilter.values),
            pool.query(`SELECT feature_id, count(DISTINCT install_id) FILTER (WHERE day >= $1::date - 6)::int AS last7,
                count(DISTINCT install_id)::int AS last30 FROM usage_stats_days WHERE ${window(30)}${daysFilter.and} GROUP BY feature_id`, days),
            pool.query(`SELECT count(DISTINCT install_id)::int AS n, count(DISTINCT install_id) FILTER (WHERE day >= $1::date - 6)::int AS last7 FROM usage_stats_days WHERE ${window(30)}${daysFilter.and}`, days),
            pool.query(`SELECT day::text AS day, count(DISTINCT install_id)::int AS n FROM usage_stats_days WHERE ${window(DAILY_DAYS)}${daysFilter.and} GROUP BY day`, days),
            pool.query('SELECT DISTINCT version FROM usage_stats_firsts ORDER BY version'),
            pool.query(`SELECT character, feature_id, count(DISTINCT install_id)::int AS n FROM usage_stats_character_firsts WHERE true${firstsFilter.and} GROUP BY character, feature_id`, firstsFilter.values),
            pool.query(`SELECT character, feature_id, count(DISTINCT install_id) FILTER (WHERE day >= $1::date - 6)::int AS last7,
                count(DISTINCT install_id)::int AS last30 FROM usage_stats_character_days WHERE ${window(30)}${characterDaysFilter.and} GROUP BY character, feature_id`, characterDays),
            pool.query(`SELECT count(DISTINCT install_id)::int AS n FROM usage_stats_firsts WHERE true${firstsFilter.and}`, firstsFilter.values),
            pool.query("SELECT DISTINCT patch FROM usage_stats_days WHERE patch <> '' ORDER BY patch"),
        ])
        const characterFeatures = listUsageFeatures().filter(f => f.characters).map(({ id, name }) => ({ id, name }))
        const characters = new Map()
        const countsFor = (character, feature) => {
            // A stored character that left the list later still shows, under its id.
            if (!characters.has(character)) characters.set(character, { name: character, zh: getUsageCharacter(character)?.zh ?? character,
                counts: Object.fromEntries(characterFeatures.map(f => [f.id, { total: 0, last7: 0, last30: 0 }])) })
            return characters.get(character).counts[feature]
        }
        for (const r of characterTotals.rows) countsFor(r.character, r.feature_id).total = r.n
        for (const r of characterRecent.rows) Object.assign(countsFor(r.character, r.feature_id), { last7: r.last7, last30: r.last30 })
        // Most-computed first: by the first character feature (single optimisation) in the last 30 days, then overall.
        const order = c => characterFeatures.flatMap(f => [c.counts[f.id].last30, c.counts[f.id].total])
        const characterRows = [...characters.values()].sort((a, b) => {
            const x = order(a), y = order(b)
            for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]
            return a.name.localeCompare(b.name, 'en')
        })
        const total = new Map(totals.rows.map(r => [r.feature_id, r.n]))
        const windows = new Map(recent.rows.map(r => [r.feature_id, r]))
        const activeInstalls30 = active.rows[0].n
        const perDay = new Map(daily.rows.map(r => [r.day, r.n]))
        const start = Date.parse(`${today}T00:00:00Z`) - (DAILY_DAYS - 1) * DAY_MS
        return {
            today, filters: { platform, version, patch }, activeInstalls30, activeInstalls7: active.rows[0].last7, totalInstalls: installs.rows[0].n,
            platforms: [...USAGE_PLATFORMS], versions: versions.rows.map(r => r.version), patches: patches.rows.map(r => r.patch),
            features: listUsageFeatures().map(({ id, category, name }) => {
                const last30 = windows.get(id)?.last30 || 0
                return { id, category, name, total: total.get(id) || 0, last7: windows.get(id)?.last7 || 0, last30,
                    share30: activeInstalls30 ? last30 / activeInstalls30 : null }
            }),
            characterFeatures, characters: characterRows,
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
        const { installId, platform, version, patch, records } = parseUpload(input, today)
        // Collapse repeats inside one upload: ON CONFLICT cannot touch the same row twice in one statement.
        const days = new Map(), firsts = new Map(), characterDays = new Map(), characterFirsts = new Map()
        for (const { feature, day, character } of records) {
            if (character === undefined) {
                days.set(`${feature}|${day}`, [feature, day])
                if (!firsts.has(feature) || day < firsts.get(feature)[1]) firsts.set(feature, [feature, day])
            } else {
                characterDays.set(`${character}|${feature}|${day}`, [character, feature, day])
                const key = `${character}|${feature}`
                if (!characterFirsts.has(key) || day < characterFirsts.get(key)[2]) characterFirsts.set(key, [character, feature, day])
            }
        }
        const column = (rows, i) => [...rows.values()].map(r => r[i])
        await transaction(pool, async db => {
            if (days.size) {
                await db.query(`INSERT INTO usage_stats_days(install_id, feature_id, day, platform, version, patch)
                    SELECT $1, f, d, $2, $3, $6 FROM unnest($4::text[], $5::date[]) AS r(f, d)
                    ON CONFLICT DO NOTHING`, [installId, platform, version, column(days, 0), column(days, 1), patch])
                await db.query(`INSERT INTO usage_stats_firsts(install_id, feature_id, platform, version, first_day)
                    SELECT $1, f, $2, $3, d FROM unnest($4::text[], $5::date[]) AS r(f, d)
                    ON CONFLICT (install_id, feature_id, platform, version)
                    DO UPDATE SET first_day = LEAST(usage_stats_firsts.first_day, EXCLUDED.first_day)`,
                [installId, platform, version, column(firsts, 0), column(firsts, 1)])
            }
            if (characterDays.size) {
                await db.query(`INSERT INTO usage_stats_character_days(install_id, character, feature_id, day, platform, version)
                    SELECT $1, c, f, d, $2, $3 FROM unnest($4::text[], $5::text[], $6::date[]) AS r(c, f, d)
                    ON CONFLICT DO NOTHING`, [installId, platform, version, column(characterDays, 0), column(characterDays, 1), column(characterDays, 2)])
                await db.query(`INSERT INTO usage_stats_character_firsts(install_id, character, feature_id, platform, version, first_day)
                    SELECT $1, c, f, $2, $3, d FROM unnest($4::text[], $5::text[], $6::date[]) AS r(c, f, d)
                    ON CONFLICT (install_id, character, feature_id, platform, version)
                    DO UPDATE SET first_day = LEAST(usage_stats_character_firsts.first_day, EXCLUDED.first_day)`,
                [installId, platform, version, column(characterFirsts, 0), column(characterFirsts, 1), column(characterFirsts, 2)])
            }
        })
        return { accepted: records.length }
    }
    return { ingest, summary }
}
