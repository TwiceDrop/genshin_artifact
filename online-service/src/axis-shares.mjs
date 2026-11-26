import { contentSnapshot } from './content-snapshot.mjs'
import { randomUUID } from 'node:crypto'
import metadata from '../static/share-catalog.json' with { type: 'json' }
import { sharedAxis } from '../../beta-data/shared-axis.mjs'
import { ApiError, invalid } from './errors.mjs'
import { transaction } from './db.mjs'

const catalog = Object.fromEntries(Object.entries(metadata).map(([id, value]) => [id, value.actions]))
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const missing = () => new ApiError(404, 'SHARE_NOT_FOUND', '分享链接不存在')
function snapshot(axis) {
    try { return sharedAxis(axis, catalog) }
    catch (error) { throw invalid('无法分享四人轴：' + error.message) }
}
function state(row, now) {
    if (row.revoked_at) return 'revoked'
    return row.expires_at && row.expires_at <= now ? 'expired' : 'active'
}
function available(row, now) {
    const status = state(row, now)
    if (status === 'expired') throw new ApiError(410, 'SHARE_EXPIRED', '该分享链接已过期')
    if (status === 'revoked') throw new ApiError(410, 'SHARE_REVOKED', '该分享已取消')
}
function describe(row, now) {
    return { kind: row.kind, id: row.id, title: row.title, version: row.version, publishedAt: row.published_at,
        expiresAt: row.expires_at, status: state(row, now) }
}
const columns = "kind, id, version, published_at, expires_at, revoked_at, axis->>'title' AS title"
async function owned(db, owner, id, lock = false) {
    if (!uuid.test(id)) throw missing()
    const { rows } = await db.query('SELECT *, axis->>\'title\' AS title FROM axis_shares WHERE owner_id=$1 AND id=$2' + (lock ? ' FOR UPDATE' : ''), [owner, id])
    if (!rows.length) throw missing()
    return rows[0]
}

export function createShares({ pool, clock = () => new Date() }) {
    return {
        async create(owner, { axis, days, requestId, kind = 'axis', content }) {
            if (!uuid.test(requestId) || ![7, 30, null].includes(days)) throw invalid('分享请求标识或有效期无效')
            const payload = kind === 'axis' ? snapshot(axis) : contentSnapshot(kind,content), now = clock()
            const expires = days === null ? null : new Date(+now + days * 86400000)
            const { rows } = await pool.query(`INSERT INTO axis_shares(id, owner_id, request_id, axis, published_at, expires_at, kind)
                VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id
                RETURNING ${columns}, axis`, [randomUUID(), owner, requestId, JSON.stringify(payload), now, expires, kind])
            if (rows[0].kind !== kind) throw invalid('分享请求标识已用于其他类型')
            return { ...describe(rows[0], now), [kind === 'axis' ? 'axis' : 'content']: rows[0].axis }
        },
        async list(owner) {
            const { rows } = await pool.query('SELECT ' + columns + ' FROM axis_shares WHERE owner_id=$1 ORDER BY published_at DESC,id', [owner])
            return { shares: rows.map(row => describe(row, clock())) }
        },
        async info(owner, id) {
            const row = await owned(pool, owner, id)
            return { ...describe(row, clock()), [row.kind === 'axis' ? 'axis' : 'content']: row.axis }
        },
        async update(owner, id, { axis, version }) {
            return transaction(pool, async db => {
                const row = await owned(db, owner, id, true), now = clock()
                available(row, now)
                if (row.kind !== 'axis') throw invalid('只有四人轴支持发布更新到原链接')
                if (version !== row.version) throw new ApiError(409, 'SHARE_CONFLICT', '线上版本已更新，请核对后再发布')
                const content = snapshot(axis)
                const { rows } = await db.query('UPDATE axis_shares SET axis=$2, version=version+1, published_at=$3 WHERE id=$1 RETURNING ' + columns + ', axis', [id, JSON.stringify(content), now])
                return { ...describe(rows[0], now), axis: rows[0].axis }
            })
        },
        async revoke(owner, id) {
            return transaction(pool, async db => {
                const row = await owned(db, owner, id, true)
                if (!row.revoked_at) {
                    available(row, clock())
                    await db.query('UPDATE axis_shares SET revoked_at=$2 WHERE id=$1', [id, clock()])
                }
                return { ok: true }
            })
        },
        async read(id) {
            if (!uuid.test(id)) throw missing()
            const { rows } = await pool.query('SELECT kind, axis, published_at, expires_at, revoked_at FROM axis_shares WHERE id=$1', [id])
            if (!rows.length) throw missing()
            available(rows[0], clock())
            return { kind:rows[0].kind, [rows[0].kind === 'axis' ? 'axis' : 'content']:rows[0].axis, publishedAt: rows[0].published_at }
        },
    }
}
