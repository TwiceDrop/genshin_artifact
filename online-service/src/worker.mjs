import { randomUUID } from 'node:crypto'
import { transaction } from './db.mjs'
import { pruneUsageStats } from './usage-stats.mjs'
import { queueJob } from './accounts.mjs'
import { gameFailure } from './errors.mjs'
import { credentialsFrom, createGameClient } from './game-client.mjs'

const MAX_ATTEMPTS = 3
export function createWorker({ pool, vault, config, clock = () => new Date(), gameClient = createGameClient, onError = () => {} }) {
    let stopping = false, activeAbort = null
    const leaseEnd = () => new Date(clock().getTime() + config.jobLeaseSeconds * 1000)
    async function recover() {
        const now = clock()
        await transaction(pool, async db => {
            const { rows: expired } = await db.query(`SELECT a.id FROM game_accounts a
                WHERE EXISTS (SELECT 1 FROM sync_jobs j WHERE j.account_id=a.id AND j.status='running' AND j.lease_until<$1)
                FOR UPDATE OF a SKIP LOCKED`, [now])
            for (const account of expired) {
                const { rows: [job] } = await db.query(`UPDATE sync_jobs SET status=CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
                    available_at=$1,lease_until=NULL,lease_token=NULL,finished_at=CASE WHEN attempts >= $2 THEN $1 ELSE NULL END,
                    error='上次任务中断，已回收任务租约',error_code='LEASE_EXPIRED'
                    WHERE account_id=$3 AND status='running' AND lease_until<$1 RETURNING status,revision`, [now, MAX_ATTEMPTS, account.id])
                if (job) await db.query(`UPDATE game_accounts SET status=$3,last_error=$4 WHERE id=$1 AND revision=$2`,
                    [account.id, job.revision, job.status === 'failed' ? 'error' : 'ready', job.status === 'failed' ? '任务连续中断，等待下次刷新' : ''])
            }
            await db.query('DELETE FROM email_challenges WHERE expires_at<$1', [now])
            await db.query('DELETE FROM sessions WHERE expires_at<$1', [now])
            await db.query('DELETE FROM rate_limits WHERE window_start<$1', [new Date(now.getTime() - 86400000)])
            await db.query("DELETE FROM sync_jobs WHERE status IN ('succeeded','failed','cancelled') AND finished_at<$1", [new Date(now.getTime() - 30 * 86400000)])
            await pruneUsageStats(db, now)
        })
    }
    async function schedule() {
        return transaction(pool, async db => {
            const now = clock()
            const { rows } = await db.query(`SELECT a.* FROM game_accounts a WHERE a.sync_enabled AND a.next_run_at <= $1
                AND a.status NOT IN ('expired','verification_required')
                AND NOT EXISTS (SELECT 1 FROM sync_jobs j WHERE j.account_id=a.id AND j.status IN ('queued','running'))
                ORDER BY a.next_run_at LIMIT 50 FOR UPDATE OF a SKIP LOCKED`, [now])
            for (const account of rows) await queueJob(db, account, now)
            return rows.length
        })
    }
    async function claim() {
        return transaction(pool, async db => {
            const now = clock()
            const { rows: [job] } = await db.query(`SELECT * FROM sync_jobs WHERE status='queued' AND available_at <= $1
                ORDER BY available_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED`, [now])
            if (!job) return null
            const { rows: [claimed] } = await db.query(`UPDATE sync_jobs SET status='running',attempts=attempts+1,
                started_at=$2,lease_until=$3,lease_token=$4 WHERE id=$1 RETURNING *`, [job.id, now, leaseEnd(), randomUUID()])
            return claimed
        })
    }
    async function current(db, job) {
        const { rows: [account] } = await db.query('SELECT * FROM game_accounts WHERE id=$1 AND revision=$2 FOR UPDATE', [job.account_id, job.revision])
        if (!account) return null
        const result = await db.query("SELECT id FROM sync_jobs WHERE id=$1 AND status='running' AND lease_token=$2", [job.id, job.lease_token])
        return result.rowCount ? account : null
    }
    async function complete(job, client, snapshots) {
        return transaction(pool, async db => {
            if (!await current(db, job)) return false
            const now = clock()
            for (const snapshot of snapshots) {
                await db.query(`INSERT INTO game_snapshots(account_id,uid,region,updated_at,snapshot) VALUES($1,$2,$3,$4,$5)
                    ON CONFLICT(account_id,uid,region) DO UPDATE SET updated_at=EXCLUDED.updated_at,snapshot=EXCLUDED.snapshot`,
                [job.account_id, snapshot.role.uid, snapshot.role.region, now, JSON.stringify(snapshot)])
            }
            await db.query(`UPDATE game_accounts SET status='ready',last_error='',roles=$2,credential_cipher=$3,last_synced_at=$4,updated_at=$4 WHERE id=$1`,
                [job.account_id, JSON.stringify(client.roles), vault.seal(credentialsFrom(client), `account:${job.account_id}`), now])
            await db.query("UPDATE sync_jobs SET status='succeeded',finished_at=$2,lease_until=NULL,lease_token=NULL,error='',error_code='' WHERE id=$1", [job.id, now])
            return true
        })
    }
    async function fail(job, error, client) {
        const failure = gameFailure(error)
        return transaction(pool, async db => {
            if (!await current(db, job)) return false
            const now = clock(), retry = failure.retry && job.attempts < MAX_ATTEMPTS
            await db.query(`UPDATE sync_jobs SET status=$2,error=$3,error_code=$4,available_at=$5,lease_until=NULL,lease_token=NULL,finished_at=$6 WHERE id=$1`,
                [job.id, retry ? 'queued' : 'failed', failure.message, failure.code, new Date(now.getTime() + 30000 * job.attempts), retry ? null : now])
            await db.query(`UPDATE game_accounts SET status=$2,last_error=$3,credential_cipher=$4,updated_at=$5 WHERE id=$1`,
                [job.account_id, failure.status, failure.message, vault.seal(credentialsFrom(client), `account:${job.account_id}`), now])
            return true
        })
    }
    async function runOne() {
        if (stopping) return false
        const job = await claim()
        if (!job) return false
        const { rows: [account] } = await pool.query('SELECT * FROM game_accounts WHERE id=$1 AND revision=$2', [job.account_id, job.revision])
        if (!account) {
            await pool.query("UPDATE sync_jobs SET status='cancelled',finished_at=$2,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$3", [job.id, clock(), job.lease_token])
            return true
        }
        // A worker can resume after another worker has reclaimed and completed its lease.
        // Fence the first account mutation as well as all final writes, before any game request.
        const started = await transaction(pool, async db => {
            if (!await current(db, job)) return false
            await db.query("UPDATE game_accounts SET status='syncing' WHERE id=$1 AND revision=$2", [account.id, job.revision])
            return true
        })
        if (!started) return true
        const abort = new AbortController()
        activeAbort = abort
        let heartbeatBusy = false
        const heartbeat = setInterval(async () => {
            if (heartbeatBusy || abort.signal.aborted) return
            heartbeatBusy = true
            try {
                const result = await pool.query(`UPDATE sync_jobs j SET lease_until=$3 WHERE j.id=$1 AND j.lease_token=$2 AND j.status='running'
                    AND EXISTS (SELECT 1 FROM game_accounts a WHERE a.id=j.account_id AND a.revision=j.revision)`, [job.id, job.lease_token, leaseEnd()])
                if (!result.rowCount) abort.abort()
            } catch (error) { abort.abort(); onError(error, 'worker_heartbeat') }
            finally { heartbeatBusy = false }
        }, Math.min(10000, config.jobLeaseSeconds * 1000 / 3))
        heartbeat.unref()
        let client
        try {
            const credential = vault.open(account.credential_cipher, `account:${account.id}`)
            client = gameClient(account.platform, credential, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(600000)]) })
            const roles = await client.getRoles()
            if (!Array.isArray(roles) || !roles.length) throw Object.assign(new Error('No game roles'), { retcode: 10001 })
            const snapshots = []
            for (const role of roles) {
                if (abort.signal.aborted) throw abort.signal.reason
                const snapshot = await client.snapshot(role.uid, () => {}, () => abort.signal.aborted)
                if (!snapshot.characters?.length || snapshot.failures?.length) throw Object.assign(new Error('Incomplete game snapshot'), { code: 'INCOMPLETE_SNAPSHOT' })
                snapshots.push(snapshot)
            }
            if (!abort.signal.aborted) await complete(job, client, snapshots)
        } catch (error) {
            if (client && !stopping) { onError(error, 'game_sync'); await fail(job, error, client) }
            else if (!client) {
                onError(error, 'worker_credentials')
                await transaction(pool, async db => {
                    if (!await current(db, job)) return
                    await db.query("UPDATE sync_jobs SET status='failed',finished_at=$2,lease_until=NULL,lease_token=NULL,error='托管凭据无法解密，请检查服务器密钥',error_code='VAULT_ERROR' WHERE id=$1", [job.id, clock()])
                    await db.query("UPDATE game_accounts SET status='error',last_error='托管凭据无法解密，请检查服务器密钥' WHERE id=$1", [account.id])
                })
            }
        } finally { clearInterval(heartbeat); activeAbort = null }
        return true
    }
    async function tick() { await recover(); await schedule(); return runOne() }
    function stop() { stopping = true; activeAbort?.abort() }
    return { tick, runOne, recover, schedule, stop }
}
