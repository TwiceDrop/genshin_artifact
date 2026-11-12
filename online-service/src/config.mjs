import { readFileSync } from 'node:fs'

function secret(env, name) {
    const file = env[`${name}_FILE`]
    return file ? readFileSync(file, 'utf8').trim() : (env[name] || '')
}
function integer(env, name, fallback, min = 1, max = 2147483647) {
    const value = Number(env[name] ?? fallback)
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`)
    return value
}
export function loadConfig(env = process.env, { mailRequired = true, vaultRequired = true } = {}) {
    const databaseUrl = secret(env, 'DATABASE_URL')
    if (!databaseUrl) throw new Error('DATABASE_URL_FILE or DATABASE_URL is required')
    const vaultValue = secret(env, 'VAULT_KEY')
    const vaultKey = Buffer.from(vaultValue, 'base64')
    if (vaultRequired && (vaultKey.length !== 32 || vaultKey.toString('base64') !== vaultValue)) throw new Error('VAULT_KEY_FILE must contain a base64-encoded 32-byte key')
    if (mailRequired && (!env.SMTP_HOST || !env.MAIL_FROM)) throw new Error('SMTP_HOST and MAIL_FROM are required')
    return {
        databaseUrl, vaultKey,
        host: env.HOST || '0.0.0.0', port: integer(env, 'PORT', 8080, 1, 65535),
        allowedOrigins: (env.CORS_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean),
        trustProxy: ['true', '1'].includes(env.TRUST_PROXY),
        otpTtlSeconds: integer(env, 'OTP_TTL_SECONDS', 600, 60, 3600),
        otpResendSeconds: integer(env, 'OTP_RESEND_SECONDS', 60, 30, 600),
        sessionTtlDays: integer(env, 'SESSION_TTL_DAYS', 30, 1, 365),
        syncIntervalMinutes: integer(env, 'SYNC_INTERVAL_MINUTES', 360, 15, 43200),
        workerPollMs: integer(env, 'WORKER_POLL_MS', 2000, 100, 60000),
        jobLeaseSeconds: integer(env, 'JOB_LEASE_SECONDS', 120, 30, 3600),
        smtp: {
            host: env.SMTP_HOST, port: integer(env, 'SMTP_PORT', 587, 1, 65535),
            secure: env.SMTP_SECURE === 'true', requireTLS: env.SMTP_REQUIRE_TLS !== 'false',
            ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: secret(env, 'SMTP_PASSWORD') } } : {}),
            connectionTimeout: integer(env, 'SMTP_TIMEOUT_MS', 15000, 1000, 60000),
            greetingTimeout: integer(env, 'SMTP_TIMEOUT_MS', 15000, 1000, 60000),
            socketTimeout: integer(env, 'SMTP_TIMEOUT_MS', 15000, 1000, 60000),
            logger: false, debug: false,
        },
        mailFrom: env.MAIL_FROM,
        usageStatsAdminToken: secret(env, 'USAGE_STATS_ADMIN_TOKEN'),
    }
}
