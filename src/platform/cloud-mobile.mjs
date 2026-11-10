import { CapacitorHttp } from '@capacitor/core'
import { MonaLocal } from './native.mjs'
import { publicAccount } from '../../server/cookie.mjs'

let queue = Promise.resolve()
const publicConfig = config => ({ url: config.url || '', user: config.user || null, expiresAt: config.expiresAt || null })
function serviceUrl(value) {
    const url = new URL(value)
    if (!(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('服务地址须为 HTTPS 域名，开发时可使用本机 HTTP 地址')
    return url.origin
}
async function execute(path, method, body, expectedContext) {
    let config = JSON.parse((await MonaLocal.readCloudVault()).text)
    if (expectedContext && (config.url !== expectedContext.url || config.user?.id !== expectedContext.userId)) throw Object.assign(new Error('在线账号或服务地址已切换'), { status: 409, code: 'CLOUD_CONTEXT_CHANGED' })
    const write = async value => { config = value; await MonaLocal.writeCloudVault({ text: JSON.stringify(value) }) }
    if (path === 'config' && method === 'GET') return publicConfig(config)
    if (path === 'config' && method === 'PUT') {
        const url = serviceUrl(body.url)
        await write(url === config.url ? config : { url })
        return publicConfig(config)
    }
    if (path === 'local-accounts' && method === 'GET') return { accounts: JSON.parse((await MonaLocal.readVault()).text).accounts.map(publicAccount) }
    if (!config.url) throw new Error('请先设置在线服务地址')
    if (path === 'game-accounts/import-local' && method === 'POST') {
        const saved = JSON.parse((await MonaLocal.readVault()).text).accounts.find(account => account.id === body.id)
        if (!saved) throw new Error('未找到已保存 Cookie')
        path = 'v1/game-accounts'
        body = Object.fromEntries(['platform', 'cookie', 'device', 'deviceSeed', 'deviceFp'].filter(key => saved[key] !== undefined).map(key => [key, saved[key]]))
        body.platform ||= 'miyoushe'
    }
    const response = await CapacitorHttp.request({
        url: `${serviceUrl(config.url)}/${path}`, method,
        headers: { ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { data: body }), responseType: 'json',
        connectTimeout: 15000, readTimeout: 60000, disableRedirects: true,
    })
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    if (response.status < 200 || response.status >= 300) {
        if (response.status === 401 && !path.startsWith('v1/auth/email/')) await write({ url: config.url })
        throw Object.assign(new Error(data.error?.message || data.error || `在线服务 HTTP ${response.status}`), { ...(typeof data.error === 'object' ? data.error : {}), status: response.status, retryAfterSeconds: data.error?.retryAfterSeconds || data.retryAfterSeconds })
    }
    if (path === 'v1/auth/email/verify' && method === 'POST') {
        await write({ url: config.url, sessionToken: data.sessionToken, user: data.user, expiresAt: data.expiresAt })
        const { sessionToken, ...result } = data
        return result
    }
    if (path === 'v1/me') await write({ ...config, user: data.user })
    if (path === 'v1/auth/logout' || (method === 'DELETE' && path === `v1/sessions/${config.sessionToken?.split('.')[0]}`)) await write({ url: config.url })
    return data
}
export function mobileCloudApi(path, method = 'GET', body, expectedContext) {
    const task = queue.then(() => execute(path, method, body, expectedContext))
    queue = task.catch(() => {})
    return task
}
