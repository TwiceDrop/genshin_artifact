// Sends a usage stats batch from the desktop page through the local server (`server/usage-stats-forward.mjs`),
// the same way online account requests go through /api/cloud, so the page needs no CORS access.
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
