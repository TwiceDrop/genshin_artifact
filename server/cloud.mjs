import { CredentialStore, publicAccount } from './credentials.mjs'

export function cloudServiceUrl(value) {
    const url = new URL(String(value).trim())
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('服务地址须为 HTTPS；本机调试可使用 HTTP')
    }
    return url.href.replace(/\/+$/, '')
}
const publicKey = value => ({ key: value.key, salt: value.salt, kdf: value.kdf })
// 这些接口成功时返回新会话：本机保存令牌，不交给页面
const sessionRoutes = new Set(['/v1/auth/email/verify', '/v1/auth/register', '/v1/auth/password/login'])
const publicConfig = saved => ({ url: saved?.url || '', user: saved?.user || null, expiresAt: saved?.expiresAt || null })
const remoteRoute = /^\/v1\/(?:auth\/email\/(?:request|verify)|auth\/register|auth\/password\/(?:login|reset)|auth\/logout|me(?:\/(?:password|email))?|sessions(?:\/[a-zA-Z0-9-]+)?|cookie-vaults(?:\/(?:miyoushe|hoyolab)\/[0-9]{1,20})?|profiles(?:\/[a-zA-Z0-9-]+(?:\/(?:revisions(?:\/[0-9]+)?|history(?:\/[a-zA-Z0-9-]+)?))?)?)$/

// Online sessions use a separate DPAPI file; the game Cookie vault is read only
// when the user explicitly selects a saved account to encrypt and upload.
// 云端只收客户端加密后的 Cookie（任务 08）：明文 Cookie 交给页面加密，本机只存解密密码派生出的密钥
// （cookieKey，随在线账号保存，退出登录时清除）。
export class CloudGateway {
    constructor({ file, credentialStore, sessionStore = new CredentialStore(file), fetcher = fetch }) {
        this.store = sessionStore
        this.credentials = credentialStore
        this.fetcher = fetcher
        this.queue = Promise.resolve()
    }
    handle(route, method, body = {}, expectedContext) {
        const task = this.queue.then(() => this.request(route, method, body, expectedContext))
        this.queue = task.catch(() => {})
        return task
    }
    async request(route, method, body, expectedContext) {
        let saved = await this.store.get('online')
        if (expectedContext && (saved?.url !== expectedContext.url || saved?.user?.id !== expectedContext.userId)) {
            return { status: 409, data: { error: { code: 'CLOUD_CONTEXT_CHANGED', message: '在线账号或服务已切换，本次同步已停止' } } }
        }
        if (route === '/config' && method === 'GET') return { status: 200, data: publicConfig(saved) }
        if (route === '/config' && method === 'PUT') {
            const url = cloudServiceUrl(body.url)
            if (saved?.url !== url) {
                await this.store.upsert({ id: 'online', url, sessionToken: null, user: null, expiresAt: null, cookieKey: null })
                saved = await this.store.get('online')
            }
            return { status: 200, data: publicConfig(saved) }
        }
        if (route === '/local-accounts' && method === 'GET') {
            return { status: 200, data: { accounts: (await this.credentials.all()).map(publicAccount) } }
        }
        if (route === '/local-accounts/cookie' && method === 'POST') {
            const account = await this.credentials.get(String(body.id))
            if (!account) return { status: 404, data: { error: '已保存账号不存在' } }
            const { platform, accountUid } = publicAccount(account)
            return { status: 200, data: { platform, accountUid, cookie: account.cookie } }
        }
        if (!saved?.url) return { status: 400, data: { error: '请先设置服务地址' } }
        if (route === '/cookie-key') {
            if (!saved.user) return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: '请先登录在线账号' } } }
            if (method === 'GET') return { status: 200, data: { cookieKey: saved.cookieKey?.userId === saved.user.id ? publicKey(saved.cookieKey) : null } }
            if (method === 'PUT') { await this.store.update('online', { cookieKey: { userId: saved.user.id, ...publicKey(body) } }); return { status: 200, data: { ok: true } } }
            if (method === 'DELETE') { await this.store.update('online', { cookieKey: null }); return { status: 200, data: { ok: true } } }
        }
        const remoteUrl = new URL(route, 'https://local.invalid')
        if (!remoteRoute.test(remoteUrl.pathname) || remoteUrl.origin !== 'https://local.invalid') return { status: 404, data: { error: '接口不存在' } }
        const headers = { 'Content-Type': 'application/json' }
        if (saved.sessionToken) headers.Authorization = `Bearer ${saved.sessionToken}`
        const response = await this.fetcher(saved.url + remoteUrl.pathname + remoteUrl.search, {
            method, headers, redirect: 'error', signal: AbortSignal.timeout(60000),
            ...(!['GET', 'HEAD'].includes(method) ? { body: JSON.stringify(body) } : {}),
        })
        const data = await response.json()
        if (response.ok && sessionRoutes.has(route)) {
            await this.store.upsert({ id: 'online', url: saved.url, sessionToken: data.sessionToken, user: data.user, expiresAt: data.expiresAt })
            delete data.sessionToken
        }
        // 读取或修改个人信息（如用户名）后刷新缓存的登录用户，与 Android 的 cloud-mobile.mjs 一致
        if (response.ok && ((route === '/v1/me' && method !== 'DELETE') || route === '/v1/me/email')) await this.store.update('online', { user: data.user })
        // 退出登录、撤销本机会话、注销账号成功后，清掉本机保存的会话和 Cookie 密钥
        if ((response.ok && (route === '/v1/auth/logout' || (method === 'DELETE' && route === '/v1/me') || (method === 'DELETE' && route === `/v1/sessions/${saved.sessionToken?.split('.')[0]}`))) || (response.status === 401 && !route.startsWith('/v1/auth/email/'))) {
            await this.store.update('online', { sessionToken: null, user: null, expiresAt: null, cookieKey: null })
        }
        return { status: response.status, data }
    }
}
