import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { migrate } from '../src/migrate.mjs'
import { createVault } from '../src/crypto.mjs'
import { createApi } from '../src/http.mjs'
import { createMaintenance } from '../src/maintenance.mjs'

async function database() {
    if (process.env.TEST_DATABASE_URL) {
        const schema = `synthetic_${randomUUID().replaceAll('-', '')}`
        const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
        await admin.query(`CREATE SCHEMA ${schema}`)
        const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` })
        return { pool, close: async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end() } }
    }
    const instance = new PGlite()
    let tail = Promise.resolve()
    async function acquire() {
        const previous = tail
        let unlock
        tail = new Promise(resolve => { unlock = resolve })
        await previous
        return unlock
    }
    async function query(sql, values) {
        const result = values?.length ? await instance.query(sql, values) : (await instance.exec(sql)).at(-1)
        return { rows: result.rows || [], rowCount: result.rows?.length || result.affectedRows || 0 }
    }
    // PGlite is one PostgreSQL connection. Serialize complete transactions rather than
    // interleaving BEGIN/COMMIT from concurrent HTTP requests on that single connection.
    const pool = {
        query: async (sql, values) => { const release = await acquire(); try { return await query(sql, values) } finally { release() } },
        connect: async () => { const release = await acquire(); return { query, release } },
    }
    return { pool, close: () => instance.close() }
}
export const SYNTHETIC_PASSWORD = 'synthetic-password'
export async function fixture() {
    const db = await database()
    await migrate(db.pool)
    await migrate(db.pool)
    let now = Date.parse('2026-11-07T00:00:00.000Z')
    const emails = [], errors = [], state = { mailFailure: false }
    const config = { otpTtlSeconds: 600, otpResendSeconds: 60, sessionTtlDays: 30,
        maintenancePollMs: 100, allowedOrigins: ['http://localhost:43199'], trustProxy: false }
    const vault = createVault(randomBytes(32))
    const options = { pool: db.pool, config, vault, clock: () => new Date(now),
        sendCode: async message => { if (state.mailFailure) throw Object.assign(new Error('SYNTHETIC_SMTP_ERROR'), { code: 'EAUTH', command: 'AUTH', responseCode: 535 }); emails.push(message) },
        onError: (error, event) => errors.push({ code: error.code, event }) }
    const server = createApi(options)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
        const result = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
            ...(body ? { body: JSON.stringify(body) } : {}) })
        return { status: result.status, body: await result.json() }
    }
    // 验证码登录不再自动建号：邮箱未注册时用同一个验证码注册，用户名取邮箱 @ 前的部分。
    async function login(email = 'synthetic-a@example.test') {
        const challenge = await request('/v1/auth/email/request', { method: 'POST', body: { email } })
        if (challenge.status !== 200) throw new Error(`Synthetic code request failed: ${JSON.stringify(challenge)}`)
        const proof = { challengeId: challenge.body.challengeId, code: emails.at(-1).code, deviceName: '合成测试设备' }
        let verified = await request('/v1/auth/email/verify', { method: 'POST', body: proof })
        if (verified.status === 404) verified = await request('/v1/auth/register', { method: 'POST',
            body: { ...proof, username: email.split('@')[0].slice(0, 16), password: SYNTHETIC_PASSWORD } })
        if (verified.status !== 200) throw new Error(`Synthetic login failed: ${JSON.stringify(verified)}`)
        return { ...verified.body, challengeId: challenge.body.challengeId, code: emails.at(-1).code }
    }
    return { ...options, ...db, base, request, login, emails, errors, state, advance: milliseconds => { now += milliseconds }, maintenance: createMaintenance(options),
        close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close() } }
}
