import { isNative } from './native.mjs'

async function request(path, method = 'GET', body, expectedContext) {
    if (isNative) return (await import('./cloud-mobile.mjs')).mobileCloudApi(path, method, body, expectedContext)
    const response = await fetch(`/api/cloud/${path}`, {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: { 'X-Mona-Local': '1', ...(expectedContext ? { 'X-Mona-Cloud-Url': encodeURIComponent(expectedContext.url), 'X-Mona-Cloud-User': expectedContext.userId } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('在线账号需要本机服务，请从桌面启动器打开')
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.error?.message || data.error || `在线服务 HTTP ${response.status}`), { ...(typeof data.error === 'object' ? data.error : {}), status: response.status, retryAfterSeconds: data.error?.retryAfterSeconds || data.retryAfterSeconds })
    return data
}

export async function cloudApi(path, method = 'GET', body, expectedContext) {
    const changed = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('mona-cloud-context-change')) }
    try {
        const result = await request(path, method, body, expectedContext)
        if ((path === 'config' && method === 'PUT') || path === 'v1/auth/email/verify' || path === 'v1/auth/logout' || (path.startsWith('v1/sessions/') && method === 'DELETE')) changed()
        return result
    } catch (error) { if (error.status === 401 || error.code === 'CLOUD_CONTEXT_CHANGED') changed(); throw error }
}
