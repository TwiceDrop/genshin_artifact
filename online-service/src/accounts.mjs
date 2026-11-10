import { randomUUID } from 'node:crypto'
import { communityAccount } from '../../server/cookie.mjs'
import { credentialsFrom, createGameClient } from './game-client.mjs'
import { transaction } from './db.mjs'
import { ApiError, invalid, missing, gameFailure } from './errors.mjs'
import { isUuid } from './auth.mjs'

const accountFields = `a.id,a.platform,a.account_uid AS "accountUid",a.roles,a.status,a.last_error AS "lastError",
    a.sync_enabled AS "syncEnabled",a.interval_minutes AS "intervalMinutes",a.next_run_at AS "nextRunAt",a.last_synced_at AS "lastSyncedAt",
    (SELECT j.id FROM sync_jobs j WHERE j.account_id=a.id AND j.status IN ('queued','running')) AS "activeJobId"`
export function publicJob(row) {
    return { id: row.id, accountId: row.account_id, status: row.status, attempts: row.attempts, createdAt: row.created_at,
        startedAt: row.started_at, finishedAt: row.finished_at, error: row.error, errorCode: row.error_code }
}
export async function ownedAccount(db, userId, id, lock = false) {
    if (!isUuid(id)) throw missing()
    const { rows: [account] } = await db.query(`SELECT * FROM game_accounts WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, userId])
    if (!account) throw missing()
    return account
}
export async function queueJob(db, account, now) {
    const { rows: [active] } = await db.query("SELECT * FROM sync_jobs WHERE account_id=$1 AND status IN ('queued','running')", [account.id])
    if (active) return active
    const { rows: [job] } = await db.query(`INSERT INTO sync_jobs(id,account_id,revision,status,available_at,created_at)
        VALUES($1,$2,$3,'queued',$4,$4) RETURNING *`, [randomUUID(), account.id, account.revision, now])
    await db.query('UPDATE game_accounts SET next_run_at=$2 WHERE id=$1', [account.id, new Date(now.getTime() + account.interval_minutes * 60000)])
    return job
}
export function createAccounts({ pool, vault, config, clock = () => new Date(), gameClient = createGameClient }) {
    async function list(userId) {
        return { accounts: (await pool.query(`SELECT ${accountFields} FROM game_accounts a WHERE a.user_id=$1 ORDER BY a.created_at`, [userId])).rows }
    }
    async function get(userId, id) {
        return (await pool.query(`SELECT ${accountFields} FROM game_accounts a WHERE a.user_id=$1 AND a.id=$2`, [userId, id])).rows[0]
    }
    async function save(userId, input) {
        if (!['miyoushe','hoyolab'].includes(input.platform)) throw invalid('请选择米游社或 HoYoLAB')
        let normalized
        try { normalized = communityAccount(input.cookie, input.platform) }
        catch (error) { throw invalid(error.message) }
        const credential = { cookie: normalized.cookie }
        for (const key of ['device', 'deviceSeed', 'deviceFp']) {
            if (input[key] === undefined || input[key] === '') continue
            if (typeof input[key] !== 'string' || input[key].length > 128 || !/^[A-Za-z0-9-]+$/.test(input[key])) throw invalid('游戏设备信息格式不正确')
            credential[key] = input[key]
        }
        const client = gameClient(input.platform, credential, { signal: AbortSignal.timeout(30000) })
        let roles
        try { roles = await client.getRoles() }
        catch (error) { const failure = gameFailure(error); throw new ApiError(422, failure.code, failure.message) }
        if (!Array.isArray(roles) || !roles.length) throw new ApiError(422, 'NO_GAME_ROLES', '该游戏账号没有可托管的原神角色')
        const now = clock()
        const id = await transaction(pool, async db => {
            // Lock the owner row so concurrent first binds of the same game account serialize.
            await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
            const { rows: [old] } = await db.query('SELECT * FROM game_accounts WHERE user_id=$1 AND platform=$2 AND account_uid=$3 FOR UPDATE', [userId, input.platform, normalized.accountUid])
            const id = old?.id || randomUUID()
            const sealed = vault.seal(credentialsFrom(client), `account:${id}`)
            if (old) {
                await db.query(`UPDATE sync_jobs SET status='cancelled',finished_at=$2,lease_token=NULL,lease_until=NULL,error='托管凭据已更新',error_code='CREDENTIAL_UPDATED'
                    WHERE account_id=$1 AND status IN ('queued','running')`, [id, now])
                await db.query(`UPDATE game_accounts SET credential_cipher=$2,revision=revision+1,roles=$3,status='ready',last_error='',next_run_at=$4,updated_at=$4 WHERE id=$1`, [id, sealed, JSON.stringify(roles), now])
            } else {
                await db.query(`INSERT INTO game_accounts(id,user_id,platform,account_uid,credential_cipher,roles,interval_minutes,next_run_at,created_at,updated_at)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$8)`, [id, userId, input.platform, normalized.accountUid, sealed, JSON.stringify(roles), config.syncIntervalMinutes, now])
            }
            return id
        })
        return { account: await get(userId, id) }
    }
    async function setEnabled(userId, id, input) {
        if (typeof input.syncEnabled !== 'boolean') throw invalid('syncEnabled 必须是布尔值')
        await transaction(pool, async db => {
            const account = await ownedAccount(db, userId, id, true)
            if (account.sync_enabled === input.syncEnabled) return
            const now = clock()
            if (!input.syncEnabled) await db.query(`UPDATE sync_jobs SET status='cancelled',finished_at=$2,lease_token=NULL,lease_until=NULL,error='已停止自动刷新',error_code='SYNC_DISABLED'
                WHERE account_id=$1 AND status IN ('queued','running')`, [id, now])
            await db.query(`UPDATE game_accounts SET sync_enabled=$2,revision=revision+CASE WHEN $2 THEN 0 ELSE 1 END,next_run_at=$3,updated_at=$3,
                status=CASE WHEN status='syncing' THEN 'ready' ELSE status END WHERE id=$1`, [id, input.syncEnabled, now])
        })
        return { account: await get(userId, id) }
    }
    async function remove(userId, id) {
        await transaction(pool, async db => {
            await ownedAccount(db, userId, id, true)
            await db.query('DELETE FROM game_accounts WHERE id=$1 AND user_id=$2', [id, userId])
        })
        return { ok: true }
    }
    async function sync(userId, id) {
        return transaction(pool, async db => {
            const account = await ownedAccount(db, userId, id, true)
            const job = await queueJob(db, account, clock())
            return { jobId: job.id, status: job.status }
        })
    }
    async function job(userId, id) {
        if (!isUuid(id)) throw missing()
        const { rows: [row] } = await pool.query('SELECT j.* FROM sync_jobs j JOIN game_accounts a ON a.id=j.account_id WHERE j.id=$1 AND a.user_id=$2', [id, userId])
        if (!row) throw missing()
        return { job: publicJob(row) }
    }
    async function snapshots(userId, id) {
        await ownedAccount(pool, userId, id)
        const { rows } = await pool.query(`SELECT s.uid,s.region,s.updated_at AS "updatedAt",s.snapshot FROM game_snapshots s
            JOIN game_accounts a ON a.id=s.account_id WHERE s.account_id=$1 AND a.user_id=$2 ORDER BY s.region,s.uid`, [id, userId])
        return { snapshots: rows }
    }
    return { list, save, setEnabled, remove, sync, job, snapshots }
}
