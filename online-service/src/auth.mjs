import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { transaction } from './db.mjs'
import { sameSecret } from './crypto.mjs'
import { ApiError, invalid, unauthorized } from './errors.mjs'

export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function createAuth({ pool, vault, config, sendCode, onError = () => {}, clock = () => new Date() }) {
    async function limit(bucket, seconds, maximum) {
        const now = clock()
        const start = new Date(Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000)
        const result = await pool.query(`INSERT INTO rate_limits(bucket,window_start,hits) VALUES($1,$2,1)
            ON CONFLICT(bucket,window_start) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits`, [bucket, start])
        if (result.rows[0].hits > maximum) throw new ApiError(429, 'RATE_LIMITED', '请求过于频繁，请稍后重试', { retryAfterSeconds: Math.ceil((start.getTime() + seconds * 1000 - now.getTime()) / 1000) })
    }
    async function requestCode(input, ip) {
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
        if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email)) throw invalid('请输入有效的邮箱地址')
        await limit(`send-ip:${ip}`, 3600, 20)
        await limit(`send-email:${email}`, 3600, 10)
        const now = clock(), id = randomUUID(), code = String(randomInt(1000000)).padStart(6, '0')
        const expires = new Date(now.getTime() + config.otpTtlSeconds * 1000)
        // The email's unique row also serializes concurrent sends across API processes.
        const result = await pool.query(`INSERT INTO email_challenges(id,email,code_cipher,created_at,expires_at)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO UPDATE SET id=EXCLUDED.id,code_cipher=EXCLUDED.code_cipher,
            created_at=EXCLUDED.created_at,expires_at=EXCLUDED.expires_at,attempts=0
            WHERE email_challenges.created_at <= $6 RETURNING id`,
        [id, email, vault.seal(code, `otp:${id}`), now, expires, new Date(now.getTime() - config.otpResendSeconds * 1000)])
        if (!result.rowCount) throw new ApiError(429, 'RATE_LIMITED', '验证码已发送，请稍后再试', { retryAfterSeconds: config.otpResendSeconds })
        try { await sendCode({ email, code, expiresAt: expires }) }
        catch (error) {
            await pool.query('DELETE FROM email_challenges WHERE id=$1', [id])
            onError(error, 'mail_send')
            throw new ApiError(503, 'MAIL_UNAVAILABLE', '验证码邮件暂时无法发送，请稍后重试')
        }
        return { challengeId: id, expiresAt: expires.toISOString(), resendAfterSeconds: config.otpResendSeconds }
    }
    async function verifyCode(input, ip) {
        if (!isUuid(input.challengeId) || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) throw invalid('验证码格式不正确')
        if (input.deviceName !== undefined && (typeof input.deviceName !== 'string' || input.deviceName.length > 80 || /[\r\n\x00]/.test(input.deviceName))) throw invalid('设备名称格式不正确')
        await limit(`verify-ip:${ip}`, 600, 120)
        const now = clock()
        const result = await transaction(pool, async db => {
            const { rows: [challenge] } = await db.query('SELECT * FROM email_challenges WHERE id=$1 FOR UPDATE', [input.challengeId])
            if (!challenge || challenge.expires_at <= now || challenge.attempts >= 5) return null
            if (!sameSecret(vault.open(challenge.code_cipher, `otp:${challenge.id}`), input.code)) {
                await db.query('UPDATE email_challenges SET attempts=attempts+1 WHERE id=$1', [challenge.id])
                return null
            }
            const { rows: [user] } = await db.query(`INSERT INTO users(id,email,created_at) VALUES($1,$2,$3)
                ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email`, [randomUUID(), challenge.email, now])
            const id = randomUUID(), secret = randomBytes(32).toString('base64url')
            const expires = new Date(now.getTime() + config.sessionTtlDays * 86400000)
            await db.query(`INSERT INTO sessions(id,user_id,secret_cipher,device_name,created_at,last_used_at,expires_at)
                VALUES($1,$2,$3,$4,$5,$5,$6)`, [id, user.id, vault.seal(secret, `session:${id}`), input.deviceName?.trim() || '未命名设备', now, expires])
            await db.query('DELETE FROM email_challenges WHERE id=$1', [challenge.id])
            return { user, sessionToken: `${id}.${secret}`, expiresAt: expires.toISOString() }
        })
        if (!result) throw new ApiError(400, 'INVALID_CODE', '验证码错误、已使用或已过期，请重新获取')
        return result
    }
    async function authenticate(header) {
        const match = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(header || '')
        if (!match || !isUuid(match[1])) throw unauthorized()
        const { rows: [row] } = await pool.query(`SELECT s.*,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [match[1]])
        if (!row || row.expires_at <= clock() || !sameSecret(vault.open(row.secret_cipher, `session:${row.id}`), match[2])) throw unauthorized()
        await pool.query('UPDATE sessions SET last_used_at=$2 WHERE id=$1', [row.id, clock()])
        return { sessionId: row.id, user: { id: row.user_id, email: row.email } }
    }
    async function sessions(auth) {
        const { rows } = await pool.query(`SELECT id,device_name AS "deviceName",created_at AS "createdAt",last_used_at AS "lastUsedAt"
            FROM sessions WHERE user_id=$1 AND expires_at>$2 ORDER BY created_at DESC`, [auth.user.id, clock()])
        return { sessions: rows.map(row => ({ ...row, current: row.id === auth.sessionId })) }
    }
    async function revoke(auth, id) {
        if (!isUuid(id)) throw invalid('设备会话标识无效')
        await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2', [id, auth.user.id])
        return { ok: true }
    }
    return { requestCode, verifyCode, authenticate, sessions, revoke, limit }
}
