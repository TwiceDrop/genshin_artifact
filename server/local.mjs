import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MysClient } from './mys.mjs'
import { CredentialStore, normalizeCookie, publicAccount } from './credentials.mjs'

export function createLocalServer({ clientFactory = () => new MysClient(), root = fileURLToPath(new URL('../dist/', import.meta.url)),
    credentialStore = new CredentialStore(process.env.MONA_DATA_DIR ? path.join(process.env.MONA_DATA_DIR, 'miyoushe.dpapi') : fileURLToPath(new URL('../.local-data/miyoushe.dpapi', import.meta.url))) } = {}) {
    const sessions = new Map()
    const cleanup = s => { s.cancelled = true; s.client.clear() }
    const timer = setInterval(() => { for (const [id, s] of sessions) if (Date.now() > s.expires) { cleanup(s); sessions.delete(id) } }, 60000).unref()
    const server = http.createServer(async (req, res) => {
        const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)) }
        const port = server.address().port
        if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json({ error: '仅允许本机访问' }, 403)
        let url
        try { url = new URL(req.url, `http://${req.headers.host}`) } catch { return json({ error: '地址无效' }, 400) }
        if (url.pathname.startsWith('/api/')) {
            if (req.headers['x-mona-local'] !== '1' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) return json({ error: '请求来源无效' }, 403)
            const sid = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('mona_mys='))?.slice(9)
            let session = sessions.get(sid)
            if (session && Date.now() > session.expires) { cleanup(session); sessions.delete(sid); session = null }
            const input = async () => {
                let body = ''
                for await (const chunk of req) { body += chunk; if (body.length > 20000) throw new Error('请求过大') }
                return JSON.parse(body || '{}')
            }
            const activate = (client, accountId = null) => {
                if (session) { cleanup(session); sessions.delete(sid) }
                const id = randomBytes(32).toString('hex')
                session = { client, accountId, expires: Date.now() + 30 * 60000, busy: false, cancelled: false }
                sessions.set(id, session)
                res.setHeader('Set-Cookie', `mona_mys=${id}; HttpOnly; SameSite=Strict; Path=/api/mys; Max-Age=1800`)
            }
            const invalidate = (accountId, except) => {
                for (const [id, s] of sessions) if (s !== except && s.accountId === accountId) { cleanup(s); sessions.delete(id) }
            }
            const persistLogin = async s => {
                if (s.cancelled) throw new Error('登录已取消')
                const c = s.client, { id, cookie } = normalizeCookie(c.cookie)
                await credentialStore.upsert({ id, cookie, device: c.device, deviceSeed: c.deviceSeed, deviceFp: c.deviceFp,
                    roles: c.roles, status: 'saved', lastError: '', lastUsedAt: new Date().toISOString() })
                s.accountId = id
                invalidate(id, s)
            }
            const persistState = async s => {
                if (s.accountId && !s.cancelled) await credentialStore.update(s.accountId, {
                    roles: s.client.roles, deviceFp: s.client.deviceFp, lastUsedAt: new Date().toISOString(), status: 'ready', lastError: '',
                })
            }
            try {
                if (url.pathname === '/api/mys/accounts' && req.method === 'GET') {
                    const accounts = (await credentialStore.all()).map(publicAccount).sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || ''))
                    return json({ accounts, activeId: session?.accountId || null })
                }
                if (url.pathname === '/api/mys/accounts' && req.method === 'POST') {
                    if (session?.busy) return json({ error: '同步中，请先取消' }, 409)
                    const normalized = normalizeCookie((await input()).cookie), client = clientFactory()
                    client.cookie = normalized.cookie
                    // Validate ownership before accepting a manually supplied Cookie.
                    await client.getRoles()
                    activate(client, normalized.id)
                    await persistLogin(session)
                    return json({ account: publicAccount(await credentialStore.get(normalized.id)) })
                }
                if (url.pathname === '/api/mys/select' && req.method === 'POST') {
                    if (session?.busy) return json({ error: '同步中，请先取消' }, 409)
                    const saved = await credentialStore.get(String((await input()).id))
                    if (!saved) return json({ error: '已保存账号不存在，请添加账号' }, 404)
                    const client = clientFactory()
                    for (const key of ['cookie', 'device', 'deviceSeed', 'deviceFp', 'roles']) if (saved[key] !== undefined) client[key] = saved[key]
                    activate(client, saved.id)
                    await credentialStore.update(saved.id, { lastUsedAt: new Date().toISOString() })
                    return json({ account: publicAccount(saved), roles: client.roles })
                }
                if (url.pathname.startsWith('/api/mys/accounts/') && req.method === 'DELETE') {
                    const id = decodeURIComponent(url.pathname.slice('/api/mys/accounts/'.length))
                    await credentialStore.remove(id)
                    invalidate(id)
                    return json({ ok: true })
                }
                if (url.pathname === '/api/mys/login' && req.method === 'POST') {
                    if (session?.busy) return json({ error: '同步中，请先取消' }, 409)
                    const client = clientFactory()
                    const qr = await client.createQR()
                    activate(client)
                    return json(qr)
                }
                if (!session) return json({ error: '本地连接已结束，请重新选择已保存账号，无需重新扫码' }, 401)
                const c = session.client
                if (url.pathname === '/api/mys/logout' && req.method === 'POST') {
                    cleanup(session); sessions.delete(sid)
                    res.setHeader('Set-Cookie', 'mona_mys=; HttpOnly; SameSite=Strict; Path=/api/mys; Max-Age=0')
                    return json({ ok: true })
                }
                if (url.pathname === '/api/mys/cancel' && req.method === 'POST') { session.cancelled = true; return json({ ok: true }) }
                if (url.pathname === '/api/mys/poll' && req.method === 'POST') {
                    const state = await c.pollQR()
                    if (state.status === 'Confirmed' && !session.accountId) await persistLogin(session)
                    return json(state)
                }
                if (url.pathname === '/api/mys/roles' && req.method === 'GET') {
                    const roles = await c.getRoles(); await persistState(session); return json(roles)
                }
                if (url.pathname === '/api/mys/progress' && req.method === 'GET') return json(session.progress || { completed: 0, total: 0 })
                if (url.pathname === '/api/mys/import' && req.method === 'POST') {
                    if (session.busy) return json({ error: '已有同步正在进行' }, 409)
                    const { uid } = await input()
                    session.busy = true; session.cancelled = false; session.expires = Date.now() + 30 * 60000; session.progress = { completed: 0, total: 0 }
                    try {
                        const snapshot = await c.snapshot(String(uid), p => { session.progress = p }, () => session.cancelled)
                        if (session.cancelled) throw new Error('同步已取消')
                        await persistState(session)
                        return json(snapshot)
                    } finally { session.busy = false }
                }
                return json({ error: '接口不存在' }, 404)
            } catch (e) {
                if (session?.accountId && !session.cancelled && Number.isFinite(e.retcode)) {
                    await credentialStore.update(session.accountId, { status: [-100, 10001, 10002].includes(e.retcode) ? 'expired' : 'error', lastError: e.message }).catch(() => {})
                }
                return json({ error: e instanceof SyntaxError ? '请求格式无效' : e.message }, 502)
            }
        }
        if (!['GET', 'HEAD'].includes(req.method)) return json({ error: '方法无效' }, 405)
        try {
            const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
            if (!file.startsWith(path.resolve(root) + path.sep)) return json({ error: '路径无效' }, 403)
            if (!(await stat(file)).isFile()) throw new Error()
            const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
            res.end(req.method === 'HEAD' ? undefined : await readFile(file))
        } catch { res.writeHead(404); res.end('Not found. Run npm run build:local first.') }
    })
    server.on('close', () => { clearInterval(timer); for (const s of sessions.values()) cleanup(s); sessions.clear() })
    return server
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.MONA_PORT || 4174)
    createLocalServer().listen(port, '127.0.0.1', () => console.log(`莫娜本地版：http://127.0.0.1:${port}/#/calculate`))
}
