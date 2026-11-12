// Senders for usage stats batches. Each returns {ok, status, message} for a server answer and throws on a network error.
import { usageStatsTarget } from '../../server/usage-stats-forward.mjs'

// Desktop: through the local server (`server/usage-stats-forward.mjs`), the same way online account requests
// go through /api/cloud, so the page needs no CORS access.
export function desktopUsageStatsSender(endpoint, base = '') {
    return async (body, { keepalive = false } = {}) => {
        const response = await fetch(`${base}/api/usage-stats`, { method: 'POST', keepalive, cache: 'no-store',
            headers: { 'X-Mona-Local': '1', 'Content-Type': 'application/json', 'X-Mona-Usage-Stats-Url': encodeURIComponent(endpoint) },
            body: JSON.stringify(body) })
        const data = await response.json().catch(() => ({}))
        const error = data.error
        return { ok: response.ok, status: response.status, message: typeof error === 'object' ? error?.message : error }
    }
}

// Android: a native request (CapacitorHttp.request, passed in) straight to online-service, like the online account
// requests in cloud-mobile.mjs. No online account session or credential is sent. Native requests outlive a hidden
// page, so `keepalive` has nothing to do here.
export function nativeUsageStatsSender(endpoint, request) {
    return async body => {
        const target = usageStatsTarget(endpoint)
        const response = await request({ url: target.href, method: 'POST', headers: { 'Content-Type': 'application/json' }, data: body,
            responseType: 'json', connectTimeout: 15000, readTimeout: 30000, disableRedirects: true })
        let data = response.data
        if (typeof data === 'string') {
            try { data = JSON.parse(data) } catch { data = { error: { message: `在线服务返回了非 JSON 内容（HTTP ${response.status}）` } } }
        }
        const ok = response.status >= 200 && response.status < 300, error = data?.error
        return { ok, status: response.status, message: typeof error === 'object' ? error?.message : error }
    }
}
