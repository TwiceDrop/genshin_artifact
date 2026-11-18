import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { transaction } from './db.mjs'
import { hashPassword, sameSecret, verifyPassword } from './crypto.mjs'
import { ApiError, invalid, unauthorized } from './errors.mjs'

export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const USER_FIELDS = 'id,email,username'
// 用户名全站唯一（不区分大小写，由 users_username_unique 索引保证）：去掉首尾空格后 2–16 个字，只含中文、字母、数字、下划线和短横线
function usernameFrom(value) {
    const username = typeof value === 'string' ? value.trim() : ''
    const length = [...username].length
    if (length < 2 || length > 16 || !/^[\p{Script=Han}A-Za-z0-9_-]+$/u.test(username)) throw invalid('用户名需为 2–16 个字，只能包含中文、字母、数字、下划线和短横线')
    return username
}
// 密码 8–64 个字符，不限字符种类，首尾空格保留（开发者 2026-11-18 确认）
function passwordFrom(value) {
    const length = typeof value === 'string' ? [...value].length : 0
    if (length < 8 || length > 64) throw invalid('密码需为 8–64 个字符')
    return value
}
function checkDeviceName(value) {
    if (value !== undefined && (typeof value !== 'string' || value.length > 80 || /[\r\n\x00]/.test(value))) throw invalid('设备名称格式不正确')
}
function checkCodeProof(input) {
    if (!isUuid(input.challengeId) || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) throw invalid('验证码格式不正确')
    checkDeviceName(input.deviceName)
}
const invalidCode = () => new ApiError(400, 'INVALID_CODE', '验证码错误、已使用或已过期，请重新获取')
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
    // 验证码正确时返回该验证码记录（加锁、未删除）；错误时计一次失败并返回 null。
    async function provenChallenge(db, input, now) {
        const { rows: [challenge] } = await db.query('SELECT * FROM email_challenges WHERE id=$1 FOR UPDATE', [input.challengeId])
        if (!challenge || challenge.expires_at <= now || challenge.attempts >= 5) return null
        if (!sameSecret(vault.open(challenge.code_cipher, `otp:${challenge.id}`), input.code)) {
            await db.query('UPDATE email_challenges SET attempts=attempts+1 WHERE id=$1', [challenge.id])
            return null
        }
        return challenge
    }
    async function openSession(db, user, deviceName, now) {
        const id = randomUUID(), secret = randomBytes(32).toString('base64url')
        const expires = new Date(now.getTime() + config.sessionTtlDays * 86400000)
        await db.query(`INSERT INTO sessions(id,user_id,secret_cipher,device_name,created_at,last_used_at,expires_at)
            VALUES($1,$2,$3,$4,$5,$5,$6)`, [id, user.id, vault.seal(secret, `session:${id}`), deviceName?.trim() || '未命名设备', now, expires])
        return { user, sessionToken: `${id}.${secret}`, expiresAt: expires.toISOString() }
    }
    // 验证码登录只认已注册的邮箱；未注册时不消耗验证码，客户端可以接着用它注册。
    async function verifyCode(input, ip) {
        checkCodeProof(input)
        await limit(`verify-ip:${ip}`, 600, 120)
        const now = clock()
        const result = await transaction(pool, async db => {
            const challenge = await provenChallenge(db, input, now)
            if (!challenge) return null
            const { rows: [user] } = await db.query(`SELECT ${USER_FIELDS} FROM users WHERE email=$1`, [challenge.email])
            if (!user) return { unregistered: true }
            await db.query('DELETE FROM email_challenges WHERE id=$1', [challenge.id])
            return openSession(db, user, input.deviceName, now)
        })
        if (!result) throw invalidCode()
        if (result.unregistered) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', '该邮箱尚未注册，请先注册')
        return result
    }
    async function register(input, ip) {
        checkCodeProof(input)
        const username = usernameFrom(input.username), password = passwordFrom(input.password)
        await limit(`verify-ip:${ip}`, 600, 120)
        const passwordHash = await hashPassword(password)
        const now = clock()
        const result = await transaction(pool, async db => {
            const challenge = await provenChallenge(db, input, now)
            if (!challenge) return null
            if ((await db.query('SELECT 1 FROM users WHERE email=$1', [challenge.email])).rowCount) throw new ApiError(409, 'EMAIL_TAKEN', '该邮箱已注册，请直接登录')
            if ((await db.query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [username])).rowCount) throw new ApiError(409, 'USERNAME_TAKEN', '用户名已被使用')
            let user
            try {
                ({ rows: [user] } = await db.query(`INSERT INTO users(id,email,username,password_hash,created_at) VALUES($1,$2,$3,$4,$5)
                    RETURNING ${USER_FIELDS}`, [randomUUID(), challenge.email, username, passwordHash, now]))
            } catch (error) {
                // 上面已查过重；这里只会是并发注册撞上唯一索引。
                if (error.code === '23505') throw error.constraint === 'users_username_unique'
                    ? new ApiError(409, 'USERNAME_TAKEN', '用户名已被使用') : new ApiError(409, 'EMAIL_TAKEN', '该邮箱已注册，请直接登录')
                throw error
            }
            await db.query('DELETE FROM email_challenges WHERE id=$1', [challenge.id])
            return openSession(db, user, input.deviceName, now)
        })
        if (!result) throw invalidCode()
        return result
    }
    // 账号可填邮箱或用户名（用户名规则不含 @）。同一 IP 每小时 20 次，同一账号每小时 10 次；
    // 账号不存在和密码错误给出相同的回复。
    async function passwordLogin(input, ip) {
        const account = typeof input.account === 'string' ? input.account.trim() : ''
        const password = typeof input.password === 'string' ? input.password : ''
        if (!account || !password || account.length > 254 || [...password].length > 64) throw invalid('请输入账号和密码')
        checkDeviceName(input.deviceName)
        await limit(`login-ip:${ip}`, 3600, 20)
        const { rows: [found] } = await pool.query(`SELECT ${USER_FIELDS},password_hash FROM users WHERE
            ${account.includes('@') ? 'email=lower($1)' : 'lower(username)=lower($1)'}`, [account])
        await limit(`login-account:${found?.id || account.toLowerCase()}`, 3600, 10)
        if (!await verifyPassword(password, found?.password_hash)) throw new ApiError(400, 'INVALID_CREDENTIALS', '账号或密码错误')
        const { password_hash: _, ...user } = found
        return transaction(pool, db => openSession(db, user, input.deviceName, clock()))
    }
    async function authenticate(header) {
        const match = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(header || '')
        if (!match || !isUuid(match[1])) throw unauthorized()
        const { rows: [row] } = await pool.query(`SELECT s.*,u.email,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [match[1]])
        if (!row || row.expires_at <= clock() || !sameSecret(vault.open(row.secret_cipher, `session:${row.id}`), match[2])) throw unauthorized()
        await pool.query('UPDATE sessions SET last_used_at=$2 WHERE id=$1', [row.id, clock()])
        return { sessionId: row.id, user: { id: row.user_id, email: row.email, username: row.username } }
    }
    // 已登录时再次确认本人：核对当前密码，同一账号每小时最多 10 次。改密码和注销账号共用。
    async function confirmPassword(auth, password) {
        if (typeof password !== 'string' || !password || [...password].length > 64) throw invalid('请输入当前密码')
        await limit(`reauth-user:${auth.user.id}`, 3600, 10)
        const { rows: [row] } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [auth.user.id])
        if (!await verifyPassword(password, row?.password_hash)) throw new ApiError(400, 'WRONG_PASSWORD', '当前密码不正确')
    }
    // 改密码后注销本设备以外的会话。
    async function changePassword(auth, input) {
        const password = passwordFrom(input?.newPassword)
        await confirmPassword(auth, input?.currentPassword)
        const passwordHash = await hashPassword(password)
        await transaction(pool, async db => {
            await db.query('UPDATE users SET password_hash=$2 WHERE id=$1', [auth.user.id, passwordHash])
            await db.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2', [auth.user.id, auth.sessionId])
        })
        return { ok: true }
    }
    // 新邮箱的验证码走公开的 /v1/auth/email/request，这里核对后更换。
    async function changeEmail(auth, input) {
        checkCodeProof(input)
        const now = clock()
        const result = await transaction(pool, async db => {
            const challenge = await provenChallenge(db, input, now)
            if (!challenge) return null
            if ((await db.query('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [challenge.email, auth.user.id])).rowCount)
                throw new ApiError(409, 'EMAIL_TAKEN', '该邮箱已被其他账号使用')
            const { rows: [user] } = await db.query(`UPDATE users SET email=$2 WHERE id=$1 RETURNING ${USER_FIELDS}`, [auth.user.id, challenge.email])
            await db.query('DELETE FROM email_challenges WHERE id=$1', [challenge.id])
            return { user }
        })
        if (!result) throw invalidCode()
        return result
    }
    // 忘记密码：用注册邮箱收到的验证码重设，并注销所有会话。发码接口对任何邮箱的回复都一样，不暴露是否注册。
    async function resetPassword(input, ip) {
        checkCodeProof(input)
        const password = passwordFrom(input.newPassword)
        await limit(`verify-ip:${ip}`, 600, 120)
        const passwordHash = await hashPassword(password)
        const now = clock()
        const result = await transaction(pool, async db => {
            const challenge = await provenChallenge(db, input, now)
            if (!challenge) return null
            const { rows: [user] } = await db.query('UPDATE users SET password_hash=$2 WHERE email=$1 RETURNING id', [challenge.email, passwordHash])
            if (!user) return { unregistered: true }
            await db.query('DELETE FROM sessions WHERE user_id=$1', [user.id])
            await db.query('DELETE FROM email_challenges WHERE id=$1', [challenge.id])
            return { ok: true }
        })
        if (!result) throw invalidCode()
        if (result.unregistered) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', '该邮箱尚未注册，请先注册')
        return result
    }
    // 注销账号：用当前密码或本人邮箱的验证码确认，删除账号；会话、云端档案和 Cookie 密文随外键级联删除。
    async function deleteAccount(auth, input) {
        if (input?.password !== undefined) {
            await confirmPassword(auth, input.password)
            await pool.query('DELETE FROM users WHERE id=$1', [auth.user.id])
            return { ok: true }
        }
        if (input?.challengeId === undefined) throw invalid('请输入当前密码或邮箱验证码')
        checkCodeProof(input)
        await limit(`reauth-user:${auth.user.id}`, 3600, 10)
        const now = clock()
        const deleted = await transaction(pool, async db => {
            const challenge = await provenChallenge(db, input, now)
            if (!challenge || challenge.email !== auth.user.email) return false
            await db.query('DELETE FROM email_challenges WHERE id=$1', [challenge.id])
            await db.query('DELETE FROM users WHERE id=$1', [auth.user.id])
            return true
        })
        if (!deleted) throw invalidCode()
        return { ok: true }
    }
    async function setUsername(auth, input) {
        const username = usernameFrom(input?.username)
        try {
            const { rows: [user] } = await pool.query('UPDATE users SET username=$2 WHERE id=$1 RETURNING id,email,username', [auth.user.id, username])
            return { user }
        } catch (error) {
            if (error.code === '23505') throw new ApiError(409, 'USERNAME_TAKEN', '用户名已被使用')
            throw error
        }
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
    return { requestCode, verifyCode, register, passwordLogin, resetPassword, authenticate, changePassword, changeEmail, deleteAccount, setUsername, sessions, revoke, limit }
}
