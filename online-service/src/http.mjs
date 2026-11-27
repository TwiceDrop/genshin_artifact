import { createDslCatalog, dslAdminPageFile, DSL_CATALOG_BODY_LIMIT } from './dsl-catalog.mjs'
import { createShares } from './axis-shares.mjs'
import { renderShare, renderShareError, shareAsset, shareHeaders } from './share-page.mjs'
import { createServer } from 'node:http'
import { ApiError, invalid } from './errors.mjs'
import { createAuth } from './auth.mjs'
import { createCookieVaults, COOKIE_VAULT_BODY_LIMIT, COOKIE_VAULT_BATCH_LIMIT } from './cookie-vaults.mjs'
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
    const auth = createAuth({ ...options, onError }), cookieVaults = createCookieVaults(options), profiles = createProfiles(options)
    const shares = createShares(options)
    const dslCatalog = createDslCatalog(options)
    const usageStats = createUsageStats(options)
    return createServer(async (request, response) => {
        const send = (status, value) => {
            if (response.writableEnded) return
            response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
            response.end(JSON.stringify(value))
        }
        try {
            const url = new URL(request.url, 'http://service.local')
            const path = url.pathname
            const method = request.method
            const catalogPath = /^\/v1\/dsl-catalog\/([A-Za-z0-9]+)$/.exec(path)
            const publicRead = method === 'GET' && (path.startsWith('/s/') || path.startsWith('/share-assets/'))
            const origin = request.headers.origin
            // Browsers send Origin for the admin page's same-origin PUT as well.
            const sameOriginCatalogWrite = catalogPath && method === 'PUT'
                && (origin === 'https://' + request.headers.host || origin === 'http://' + request.headers.host)
            if (origin && !publicRead && !sameOriginCatalogWrite) {
                if (!config.allowedOrigins.includes(origin)) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '此来源不能访问在线服务')
                response.setHeader('Access-Control-Allow-Origin', origin)
                response.setHeader('Vary', 'Origin')
            }
            if (request.method === 'OPTIONS') {
                response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '600' })
                response.end(); return
            }
            if (method === 'GET' && path === '/healthz') {
                await pool.query('SELECT 1')
                return send(200, { ok: true })
            }
            const ip = config.trustProxy && request.headers['x-forwarded-for']
                ? request.headers['x-forwarded-for'].split(',')[0].trim() : request.socket.remoteAddress || 'unknown'
            if (method === 'POST' && path === '/v1/auth/email/request') return send(200, await auth.requestCode(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/auth/email/verify') return send(200, await auth.verifyCode(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/auth/register') return send(200, await auth.register(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/auth/password/login') return send(200, await auth.passwordLogin(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/auth/password/reset') return send(200, await auth.resetPassword(await bodyOf(request), ip))
            if (method === 'POST' && path === '/v1/usage-stats') return send(200, await usageStats.ingest(await bodyOf(request, USAGE_UPLOAD_LIMITS.bodyBytes), ip))
            if (method === 'GET' && path === '/v1/usage-stats/summary') return send(200, await usageStats.summary(url.searchParams, request.headers.authorization))
            if (method === 'GET' && path === '/v1/admin/dsl-catalog') {
                dslCatalog.authorize(request.headers.authorization)
                return send(200, await dslCatalog.list())
            }
            if (catalogPath && method === 'GET') return send(200, await dslCatalog.read(catalogPath[1]))
            if (catalogPath && method === 'PUT') {
                dslCatalog.authorize(request.headers.authorization)
                return send(200, await dslCatalog.publish(catalogPath[1], await bodyOf(request, DSL_CATALOG_BODY_LIMIT)))
            }
            const pageFile = method === 'GET' && path.startsWith('/admin/')
                ? await dslAdminPageFile(path) ?? await usageStatsPageFile(path) : null
            if (pageFile) {
                response.writeHead(200, { 'Content-Type': pageFile.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                    'Content-Security-Policy': USAGE_STATS_PAGE_POLICY, 'Referrer-Policy': 'no-referrer' })
                return response.end(pageFile.body)
            }
            const asset = /^\/share-assets\/([a-zA-Z0-9.-]+)$/.exec(path)
            if (method === 'GET' && asset) {
                const file = await shareAsset(asset[1])
                if (!file) return send(404, { error: { code: 'NOT_FOUND' } })
                response.writeHead(200, { ...shareHeaders, 'Content-Type': file.type })
                return response.end(file.body)
            }
            const publicLink = /^\/s\/([^/]+)(\/download)?$/.exec(path)
            if (method === 'GET' && publicLink) {
                let published
                try { published = await shares.read(publicLink[1]) }
                catch (error) {
                    if (publicLink[2]) throw error
                    if (!(error instanceof ApiError)) onError(error)
                    response.writeHead(error.status || 500, { ...shareHeaders, 'Content-Type':'text/html; charset=utf-8' })
                    return response.end(renderShareError(error.code))
                }
                if (publicLink[2]) {
                    if (published.kind !== 'axis') throw new ApiError(404, 'NOT_FOUND', '此分享没有轴文件')
                    const filename = encodeURIComponent(published.axis.id.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0,80)) + '.mona-axis.json'
                    response.setHeader('Content-Disposition', "attachment; filename=axis.mona-axis.json; filename*=UTF-8''" + filename)
                    return send(200, published.axis)
                }
                response.writeHead(200, { ...shareHeaders, 'Content-Type':'text/html; charset=utf-8' })
                return response.end(renderShare(published, publicLink[1]))
            }
            const identity = await auth.authenticate(request.headers.authorization)
            const userId = identity.user.id
            if (path === '/v1/shares' && method === 'POST') return send(200, await shares.create(userId, await bodyOf(request, 524288)))
            if (path === '/v1/shares' && method === 'GET') return send(200, await shares.list(userId))
            const sharePath = /^\/v1\/shares\/([^/]+)$/.exec(path)
            if (sharePath) {
                if (method === 'GET') return send(200, await shares.info(userId, sharePath[1]))
                if (method === 'PUT') return send(200, await shares.update(userId, sharePath[1], await bodyOf(request, 524288)))
                if (method === 'DELETE') return send(200, await shares.revoke(userId, sharePath[1]))
            }
            if (method === 'GET' && path === '/v1/me') return send(200, { user: identity.user })
            if (method === 'PATCH' && path === '/v1/me') return send(200, await auth.updateMe(identity, await bodyOf(request)))
            if (method === 'POST' && path === '/v1/me/password') return send(200, await auth.changePassword(identity, await bodyOf(request)))
            if (method === 'POST' && path === '/v1/me/email') return send(200, await auth.changeEmail(identity, await bodyOf(request)))
            if (method === 'DELETE' && path === '/v1/me') return send(200, await auth.deleteAccount(identity, await bodyOf(request)))
            if (method === 'POST' && path === '/v1/auth/logout') return send(200, await auth.revoke(identity, identity.sessionId))
            if (method === 'GET' && path === '/v1/sessions') return send(200, await auth.sessions(identity))
            const sessionPath = /^\/v1\/sessions\/([^/]+)$/.exec(path)
            if (sessionPath && method === 'DELETE') return send(200, await auth.revoke(identity, sessionPath[1]))
            if (path === '/v1/cookie-vaults' && method === 'GET') return send(200, await cookieVaults.list(userId))
            if (path === '/v1/cookie-vaults' && method === 'PUT') {
                await auth.limit(`bind-user:${userId}`, 600, 20)
                return send(200, await cookieVaults.replaceAll(userId, await bodyOf(request, COOKIE_VAULT_BATCH_LIMIT)))
            }
            const vaultPath = /^\/v1\/cookie-vaults\/([^/]+)\/([^/]+)$/.exec(path)
            if (vaultPath) {
                const [, platform, accountUid] = vaultPath
                if (method === 'GET') return send(200, await cookieVaults.get(userId, platform, accountUid))
                if (method === 'DELETE') return send(200, await cookieVaults.remove(userId, platform, accountUid))
                if (method === 'PUT') {
                    await auth.limit(`bind-user:${userId}`, 600, 20)
                    return send(200, await cookieVaults.save(userId, platform, accountUid, await bodyOf(request, COOKIE_VAULT_BODY_LIMIT)))
                }
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
            throw new ApiError(404, 'NOT_FOUND', '接口不存在')
        } catch (error) {
            if (!(error instanceof ApiError)) onError(error)
            if (error.details?.retryAfterSeconds) response.setHeader('Retry-After', error.details.retryAfterSeconds)
            send(error.status || 500, { error: { code: error.code && error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
                message: error instanceof ApiError ? error.message : '在线服务暂时不可用，请稍后重试', ...(error.details || {}) } })
        }
    })
}
