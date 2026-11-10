import { randomUUID } from 'node:crypto'
import { transaction } from './db.mjs'
import { ApiError, invalid, missing } from './errors.mjs'
import { isUuid } from './auth.mjs'

export const SYNC_BODY_LIMIT = 16 * 1024 * 1024
const DATA_KEYS = ['name','artifacts','presets','kumi','miyoushe','comparisonSettings','teamDpsConfigurations','teamDpsTasks']
const COMMIT_KEYS = ['operationId','baseRevision','deviceId','schemaVersion','appVersion','engineVersion','data']
const HISTORY_PRIVATE_KEYS = ['id','accountId','progress','storageError','syncId']
const revisionColumns = `r.revision,r.base_revision,r.operation_id,r.status,r.device_id,r.schema_version,r.app_version,r.engine_version,r.created_at`
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function exactFields(value, fields) {
    if (!isObject(value) || Object.keys(value).length !== fields.length || !fields.every(key => Object.hasOwn(value, key))) throw invalid('同步数据字段不完整或包含不支持的字段')
}
function validName(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[\x00-\x1f]/.test(value)) throw invalid('档案名称需要 1 至 80 个字符')
}
function validId(value, label = '操作') { if (!isUuid(value)) throw invalid(`${label}标识无效`) }
function validRevision(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) throw invalid('修订编号无效')
}
function boundedNumber(value, fallback, max = 100) {
    if (value === undefined || value === null) return fallback
    if (!/^\d+$/.test(String(value))) throw invalid('分页参数无效')
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number < 1 || number > max) throw invalid('分页参数无效')
    return number
}
export function publicProfile(row) {
    return { id: row.id, name: row.name, revision: row.current_revision, deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at }
}
function publicRevision(row, withData = false) {
    return { revision: row.revision, baseRevision: row.base_revision, status: row.status, deviceId: row.device_id,
        schemaVersion: row.schema_version, appVersion: row.app_version, engineVersion: row.engine_version,
        createdAt: row.created_at, ...(withData ? { data: row.request_json?.data ?? row.data } : {}) }
}
function publicHistory(row, withDetail = false) {
    return { syncId: row.sync_id, sequence: row.sequence, summary: row.summary, createdAt: row.created_at, ...(withDetail ? { detail: row.detail } : {}) }
}
function deleted(profile) { return new ApiError(410, 'PROFILE_DELETED', '该云端档案已删除，请保留本地副本或另建云端档案', { profile: publicProfile(profile) }) }
function reused() { return new ApiError(409, 'OPERATION_ID_REUSED', '该操作标识已用于不同内容，请为新操作生成新的标识') }
function conflict(profile, revision, replayed) {
    return new ApiError(409, 'PROFILE_CONFLICT', '云端档案已有更新，本次内容已保存为冲突副本', { profile: publicProfile(profile), revision: publicRevision(revision), replayed })
}
async function ownedProfile(db, userId, id, { lock = false, allowDeleted = false } = {}) {
    if (!isUuid(id)) throw missing()
    const { rows: [profile] } = await db.query(`SELECT * FROM profiles WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, userId])
    if (!profile) throw missing()
    if (profile.deleted_at && !allowDeleted) throw deleted(profile)
    return profile
}
function validateCommit(input) {
    exactFields(input, COMMIT_KEYS)
    validId(input.operationId); validId(input.deviceId, '设备'); validRevision(input.baseRevision)
    if (input.schemaVersion !== 1) throw new ApiError(422, 'UNSUPPORTED_PROFILE_SCHEMA', '当前服务不支持该档案格式版本')
    for (const key of ['appVersion', 'engineVersion']) if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 128) throw invalid('应用与引擎版本信息无效')
    exactFields(input.data, DATA_KEYS)
    validName(input.data.name)
    for (const key of DATA_KEYS.slice(1)) if (input.data[key] !== null && typeof input.data[key] !== 'object') throw invalid(`档案 ${key} 必须是结构化数据或 null`)
}
export function createProfiles({ pool, clock = () => new Date() }) {
    async function create(userId, input) {
        exactFields(input, ['operationId','name']); validId(input.operationId); validName(input.name)
        return transaction(pool, async db => {
            await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
            const { rows: [existing] } = await db.query('SELECT *,create_request=$3::jsonb AS same_request FROM profiles WHERE user_id=$1 AND create_operation_id=$2', [userId, input.operationId, JSON.stringify(input)])
            if (existing) {
                if (existing.deleted_at) throw deleted(existing)
                if (!existing.same_request) throw reused()
                return { profile: publicProfile(existing), replayed: true }
            }
            const now = clock()
            const { rows: [profile] } = await db.query(`INSERT INTO profiles(id,user_id,name,create_operation_id,create_request,created_at,updated_at)
                VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING *`, [randomUUID(), userId, input.name, input.operationId, JSON.stringify(input), now])
            return { profile: publicProfile(profile), replayed: false }
        })
    }
    async function list(userId, query) {
        const includeDeleted = query.get('includeDeleted')
        if (includeDeleted !== null && !['true','false'].includes(includeDeleted)) throw invalid('includeDeleted 参数无效')
        const { rows } = await pool.query(`SELECT * FROM profiles WHERE user_id=$1 ${includeDeleted === 'true' ? '' : 'AND deleted_at IS NULL'} ORDER BY updated_at DESC,id`, [userId])
        return { profiles: rows.map(publicProfile) }
    }
    async function get(userId, id) {
        if (!isUuid(id)) throw missing()
        const { rows: [row] } = await pool.query(`SELECT p.*,row_to_json(r.*) AS head FROM profiles p
            LEFT JOIN profile_revisions r ON r.profile_id=p.id AND r.revision=p.current_revision WHERE p.id=$1 AND p.user_id=$2`, [id, userId])
        if (!row) throw missing()
        if (row.deleted_at) throw deleted(row)
        return { profile: publicProfile(row), revision: row.head ? publicRevision(row.head, true) : null }
    }
    async function commit(userId, id, input) {
        validateCommit(input)
        const outcome = await transaction(pool, async db => {
            const profile = await ownedProfile(db, userId, id, { lock: true })
            const serialized = JSON.stringify(input)
            const { rows: [existing] } = await db.query(`SELECT *,request_json=$3::jsonb AS same_request FROM profile_revisions WHERE profile_id=$1 AND operation_id=$2`, [id, input.operationId, serialized])
            if (existing) {
                if (!existing.same_request) throw reused()
                return { profile, revision: existing, replayed: true }
            }
            const status = input.baseRevision === profile.current_revision ? 'applied' : 'conflict'
            const now = clock(), number = profile.last_revision + 1
            const { rows: [revision] } = await db.query(`INSERT INTO profile_revisions(profile_id,revision,base_revision,operation_id,status,device_id,schema_version,app_version,engine_version,request_json,created_at)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [id, number, input.baseRevision, input.operationId, status, input.deviceId, input.schemaVersion, input.appVersion, input.engineVersion, serialized, now])
            const { rows: [updated] } = await db.query(`UPDATE profiles SET last_revision=$2,current_revision=CASE WHEN $3 THEN $2 ELSE current_revision END,
                name=CASE WHEN $3 THEN $4 ELSE name END,updated_at=$5 WHERE id=$1 RETURNING *`, [id, number, status === 'applied', input.data.name, now])
            return { profile: updated, revision, replayed: false }
        })
        // Commit the conflict branch before returning 409; throwing inside the transaction would discard it.
        if (outcome.revision.status === 'conflict') throw conflict(outcome.profile, outcome.revision, outcome.replayed)
        return { profile: publicProfile(outcome.profile), revision: publicRevision(outcome.revision), replayed: outcome.replayed }
    }
    async function revisions(userId, id, query) {
        await ownedProfile(pool, userId, id)
        const limit = boundedNumber(query.get('limit'), 50), before = boundedNumber(query.get('before'), 2147483647, 2147483647)
        const { rows } = await pool.query(`SELECT ${revisionColumns} FROM profile_revisions r JOIN profiles p ON p.id=r.profile_id
            WHERE r.profile_id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL AND r.revision<$3 ORDER BY r.revision DESC LIMIT $4`, [id, userId, before, limit + 1])
        const page = rows.slice(0, limit)
        return { revisions: page.map(row => publicRevision(row)), nextCursor: rows.length > limit ? page.at(-1).revision : null }
    }
    async function revision(userId, id, number) {
        await ownedProfile(pool, userId, id)
        const parsed = boundedNumber(number, null, 2147483647)
        const { rows: [row] } = await pool.query(`SELECT ${revisionColumns},r.request_json->'data' AS data FROM profile_revisions r JOIN profiles p ON p.id=r.profile_id
            WHERE r.profile_id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL AND r.revision=$3`, [id, userId, parsed])
        if (!row) throw missing()
        return { revision: publicRevision(row, true) }
    }
    async function remove(userId, id, input) {
        exactFields(input, ['operationId','baseRevision','deviceId']); validId(input.operationId); validId(input.deviceId, '设备'); validRevision(input.baseRevision)
        return transaction(pool, async db => {
            const profile = await ownedProfile(db, userId, id, { lock: true, allowDeleted: true })
            if (profile.deleted_at) {
                if (profile.delete_operation_id !== input.operationId) throw deleted(profile)
                const { rows: [comparison] } = await db.query('SELECT delete_request=$2::jsonb AS same_request FROM profiles WHERE id=$1', [id, JSON.stringify(input)])
                if (!comparison.same_request) throw reused()
                return { profile: publicProfile(profile), tombstone: { revision: profile.current_revision, deletedAt: profile.deleted_at }, replayed: true }
            }
            if ((await db.query('SELECT 1 FROM profile_revisions WHERE profile_id=$1 AND operation_id=$2', [id, input.operationId])).rowCount) throw reused()
            if (profile.current_revision !== input.baseRevision) throw new ApiError(409, 'PROFILE_CONFLICT', '云端档案已有更新，请核对最新修订后再删除', { profile: publicProfile(profile) })
            const { rows: [tombstone] } = await db.query(`UPDATE profiles SET name=NULL,create_request=NULL,current_revision=last_revision+1,last_revision=last_revision+1,
                deleted_at=$2,updated_at=$2,delete_operation_id=$3,delete_request=$4 WHERE id=$1 RETURNING *`, [id, clock(), input.operationId, JSON.stringify(input)])
            await db.query('DELETE FROM profile_revisions WHERE profile_id=$1', [id])
            await db.query('DELETE FROM profile_history WHERE profile_id=$1', [id])
            return { profile: publicProfile(tombstone), tombstone: { revision: tombstone.current_revision, deletedAt: tombstone.deleted_at }, replayed: false }
        })
    }
    async function appendHistory(userId, id, input) {
        exactFields(input, ['syncId','summary','detail']); validId(input.syncId, '历史记录')
        if (!isObject(input.summary) || !isObject(input.detail)) throw invalid('历史摘要和正文必须是对象')
        if (HISTORY_PRIVATE_KEYS.some(key => Object.hasOwn(input.summary, key))) throw invalid('历史摘要包含设备专属字段')
        if (!['completed','failed','cancelled','interrupted'].includes(input.summary.status)) throw invalid('仅同步已结束的计算历史')
        if (!['single','team'].includes(input.summary.kind)) throw invalid('历史计算类型无效')
        const summary = JSON.stringify(input.summary), detail = JSON.stringify(input.detail)
        if (Buffer.byteLength(summary, 'utf8') > 65536) throw new ApiError(413, 'BODY_TOO_LARGE', '历史摘要超过 64 KiB')
        return transaction(pool, async db => {
            const profile = await ownedProfile(db, userId, id, { lock: true })
            const { rows: [existing] } = await db.query(`SELECT *,summary=$3::jsonb AND detail=$4::jsonb AS same_request FROM profile_history WHERE profile_id=$1 AND sync_id=$2`, [id, input.syncId, summary, detail])
            if (existing) {
                if (!existing.same_request) throw new ApiError(409, 'HISTORY_ID_REUSED', '该历史标识已用于不同内容')
                return { entry: publicHistory(existing), accepted: true, replayed: true }
            }
            const { rows: [entry] } = await db.query(`INSERT INTO profile_history(profile_id,sync_id,sequence,summary,detail,created_at)
                VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [id, input.syncId, profile.history_sequence + 1, summary, detail, clock()])
            await db.query('UPDATE profiles SET history_sequence=$2 WHERE id=$1', [id, entry.sequence])
            return { entry: publicHistory(entry), accepted: true, replayed: false }
        })
    }
    async function history(userId, id, query) {
        await ownedProfile(pool, userId, id)
        const limit = boundedNumber(query.get('limit'), 100)
        const rawAfter = query.get('after'), after = rawAfter === null || rawAfter === '0' ? 0 : boundedNumber(rawAfter, 0, 2147483647)
        const { rows } = await pool.query(`SELECT h.sync_id,h.sequence,h.summary,h.created_at FROM profile_history h JOIN profiles p ON p.id=h.profile_id
            WHERE h.profile_id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL AND h.sequence>$3 ORDER BY h.sequence LIMIT $4`, [id, userId, after, limit + 1])
        const page = rows.slice(0, limit)
        return { entries: page.map(row => publicHistory(row)), nextCursor: rows.length > limit ? page.at(-1).sequence : null }
    }
    async function historyEntry(userId, id, syncId) {
        await ownedProfile(pool, userId, id)
        if (!isUuid(syncId)) throw missing()
        const { rows: [row] } = await pool.query(`SELECT h.* FROM profile_history h JOIN profiles p ON p.id=h.profile_id WHERE h.profile_id=$1 AND p.user_id=$2
            AND p.deleted_at IS NULL AND h.sync_id=$3`, [id, userId, syncId])
        if (!row) throw missing()
        return { entry: publicHistory(row, true) }
    }
    return { create, list, get, commit, revisions, revision, remove, appendHistory, history, historyEntry }
}
