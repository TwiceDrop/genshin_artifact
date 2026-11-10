import { CredentialStore, publicAccount } from './credentials.mjs'

export function cloudServiceUrl(value) {
    const url = new URL(String(value).trim())
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('服务地址须为 HTTPS；本机调试可使用 HTTP')
    }
    return url.href.replace(/\/+$/, '')
}
const publicConfig = saved => ({ url: saved?.url || '', user: saved?.user || null, expiresAt: saved?.expiresAt || null })
const remoteRoute = /^\/v1\/(?:auth\/email\/(?:request|verify)|auth\/logout|me|sessions(?:\/[a-zA-Z0-9-]+)?|game-accounts(?:\/[a-zA-Z0-9-]+(?:\/(?:sync|snapshots))?)?|jobs\/[a-zA-Z0-9-]+|profiles(?:\/[a-zA-Z0-9-]+(?:\/(?:revisions(?:\/[0-9]+)?|history(?:\/[a-zA-Z0-9-]+)?))?)?)$/

// Online sessions use a separate DPAPI file; the game Cookie vault is read only
// when the user explicitly selects a saved account for cloud hosting.
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
                await this.store.upsert({ id: 'online', url, sessionToken: null, user: null, expiresAt: null })
                saved = await this.store.get('online')
            }
            return { status: 200, data: publicConfig(saved) }
        }
        if (route === '/local-accounts' && method === 'GET') {
            return { status: 200, data: { accounts: (await this.credentials.all()).map(publicAccount) } }
        }
        if (!saved?.url) return { status: 400, data: { error: '请先设置服务地址' } }
        if (route === '/game-accounts/import-local' && method === 'POST') {
            const account = await this.credentials.get(String(body.id))
            if (!account) return { status: 404, data: { error: '已保存账号不存在' } }
            body = Object.fromEntries(['platform', 'cookie', 'device', 'deviceSeed', 'deviceFp'].filter(key => account[key] !== undefined).map(key => [key, account[key]]))
            body.platform ||= 'miyoushe'
            route = '/v1/game-accounts'
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
        if (response.ok && route === '/v1/auth/email/verify') {
            await this.store.upsert({ id: 'online', url: saved.url, sessionToken: data.sessionToken, user: data.user, expiresAt: data.expiresAt })
            delete data.sessionToken
        }
        if ((response.ok && (route === '/v1/auth/logout' || (method === 'DELETE' && route === `/v1/sessions/${saved.sessionToken?.split('.')[0]}`))) || (response.status === 401 && !route.startsWith('/v1/auth/email/'))) {
            await this.store.update('online', { sessionToken: null, user: null, expiresAt: null })
        }
        return { status: response.status, data }
    }
}
