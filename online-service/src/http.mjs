import { createServer } from 'node:http'
import { ApiError, invalid } from './errors.mjs'
import { createAuth } from './auth.mjs'
import { createAccounts } from './accounts.mjs'
import { createProfiles, SYNC_BODY_LIMIT } from './profiles.mjs'
import { createUsageStats, USAGE_UPLOAD_LIMITS, USAGE_STATS_PAGE_POLICY, usageStatsPageFile } from './usage-stats.mjs'

export function logError(error, event = 'request_error') {
    console.error(JSON.stringify({ event, name: error.name, code: error.code || 'INTERNAL_ERROR', retcode: error.retcode, command: error.command, responseCode: error.responseCode, causeCode: error.cause?.code,
        frames: error.stack?.split('\n').slice(1, 5).map(frame => frame.trim()) }))
}
async function bodyOf(request, maximumBytes = 32768) {
    if (!['POST','PATCH','PUT','DELETE'].includes(request.method)) return {}
    const chunks = []
    let size = 0
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length
        if (size > maximumBytes) {
            request.resume()
            throw new ApiError(413, 'BODY_TOO_LARGE', '请求内容过大')
        }
        chunks.push(chunk)
    }
    if (!size) return {}
    const body = Buffer.concat(chunks).toString('utf8')
    if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw invalid('请求必须使用 JSON')
    try {
        const value = JSON.parse(body)
        if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error()
        return value
    } catch { throw invalid('JSON 格式不正确') }
}
export function createApi(options) {
    const { pool, config, onError = logError } = options
    const auth = createAuth({ ...options, onError }), accounts = createAccounts(options), profiles = createProfiles(options)
    const usageStats = createUsageStats(options)
    return createServer(async (request, response) => {
        const send = (status, value) => {
            if (response.writableEnded) return
            response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
            response.end(JSON.stringify(value))
        }
        try {
            const origin = request.headers.origin
            if (origin) {
                if (!config.allowedOrigins.includes(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '此来源不能访问在线服务')
                response.setHeader('Access-Control-Allow-Origin', origin)
                response.setHeader('Vary', 'Origin')
            }
            if (request.method === 'OPTIONS') {
                response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '600' })
                response.end(); return
            }
            const url = new URL(request.url, 'http://service.local')
            const path = url.pathname
            const method = request.method
            if (method === 'GET' && path === '/healthz') {
                await pool.query('SELECT 1')
                return send(200, { ok: true })
            }
            const ip = config.trustProxy && request.headers['x-forwarded-for']
                ? request.headers['x-forwarded-for'].split(',')[0].trim() : request.socket.remoteAddress || 'unknown'
            if (method === 'POST' && path === '/v1/auth/email/request') return send(200, await auth.requestCode(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/auth/email/verify') return send(200, await auth.verifyCode(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/usage-stats') return send(200, await usageStats.ingest(await bodyOf(request, USAGE_UPLOAD_LIMITS.bodyBytes), ip))
            if (method === 'GET' && path === '/v1/usage-stats/summary') return send(200, await usageStats.summary(url.searchParams, request.headers.authorization))
            const pageFile = method === 'GET' && path.startsWith('/admin/') ? await usageStatsPageFile(path) : null
            if (pageFile) {
                response.writeHead(200, { 'Content-Type': pageFile.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                    'Content-Security-Policy': USAGE_STATS_PAGE_POLICY, 'Referrer-Policy': 'no-referrer' })
                return response.end(pageFile.body)
            }
            const identity = await auth.authenticate(request.headers.authorization)
            const userId = identity.user.id
            if (method === 'GET' && path === '/v1/me') return send(200, { user: identity.user })
            if (method === 'POST' && path === '/v1/auth/logout') return send(200, await auth.revoke(identity, identity.sessionId))
            if (method === 'GET' && path === '/v1/sessions') return send(200, await auth.sessions(identity))
            const sessionPath = /^\/v1\/sessions\/([^/]+)$/.exec(path)
            if (sessionPath && method === 'DELETE') return send(200, await auth.revoke(identity, sessionPath[1]))
            if (path === '/v1/game-accounts' && method === 'GET') return send(200, await accounts.list(userId))
            if (path === '/v1/game-accounts' && method === 'POST') {
                await auth.limit(`bind-user:${userId}`, 600, 20)
                return send(200, await accounts.save(userId, await bodyOf(request)))
            }
            const accountPath = /^\/v1\/game-accounts\/([^/]+)(?:\/(sync|snapshots))?$/.exec(path)
            if (accountPath) {
                const [, id, action] = accountPath
                if (!action && method === 'PATCH') return send(200, await accounts.setEnabled(userId, id, await bodyOf(request)))
                if (!action && method === 'DELETE') return send(200, await accounts.remove(userId, id))
                if (action === 'sync' && method === 'POST') {
                    await auth.limit(`sync-user:${userId}`, 60, 20)
                    return send(200, await accounts.sync(userId, id))
                }
                if (action === 'snapshots' && method === 'GET') return send(200, await accounts.snapshots(userId, id))
            }
            if (path === '/v1/profiles' && method === 'POST') return send(200, await profiles.create(userId, await bodyOf(request)))
            if (path === '/v1/profiles' && method === 'GET') return send(200, await profiles.list(userId, url.searchParams))
            const profilePath = /^\/v1\/profiles\/([^/]+)(?:\/(revisions|history)(?:\/([^/]+))?)?$/.exec(path)
            if (profilePath) {
                const [, id, collection, item] = profilePath
                if (!collection && method === 'GET') return send(200, await profiles.get(userId, id))
                if (!collection && method === 'DELETE') return send(200, await profiles.remove(userId, id, await bodyOf(request)))
                if (collection === 'revisions' && !item && method === 'PUT') return send(200, await profiles.commit(userId, id, await bodyOf(request, SYNC_BODY_LIMIT)))
                if (collection === 'revisions' && !item && method === 'GET') return send(200, await profiles.revisions(userId, id, url.searchParams))
                if (collection === 'revisions' && item && method === 'GET') return send(200, await profiles.revision(userId, id, item))
                if (collection === 'history' && !item && method === 'POST') return send(200, await profiles.appendHistory(userId, id, await bodyOf(request, SYNC_BODY_LIMIT)))
                if (collection === 'history' && !item && method === 'GET') return send(200, await profiles.history(userId, id, url.searchParams))
                if (collection === 'history' && item && method === 'GET') return send(200, await profiles.historyEntry(userId, id, item))
            }
            const jobPath = /^\/v1\/jobs\/([^/]+)$/.exec(path)
            if (jobPath && method === 'GET') return send(200, await accounts.job(userId, jobPath[1]))
            throw new ApiError(404, 'NOT_FOUND', '接口不存在')
        } catch (error) {
            if (!(error instanceof ApiError)) onError(error)
            if (error.details?.retryAfterSeconds) response.setHeader('Retry-After', error.details.retryAfterSeconds)
            send(error.status || 500, { error: { code: error.code && error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
                message: error instanceof ApiError ? error.message : '在线服务暂时不可用，请稍后重试', ...(error.details || {}) } })
        }
    })
}
