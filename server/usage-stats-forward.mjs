// Forwards a usage stats upload from the desktop page to online-service.
// The page sends the build-time endpoint; only https, or http on this machine for local checks, is accepted,
// and only the usage stats upload path is reached. No online account session or credential is used.
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function usageStatsTarget(endpoint) {
    let base
    try { base = new URL(endpoint) } catch { throw Object.assign(new Error('使用统计地址无效'), { status: 400 }) }
    if (base.username || base.password || !(base.protocol === 'https:' || (base.protocol === 'http:' && LOOPBACK.has(base.hostname))))
        throw Object.assign(new Error('使用统计地址必须是 https'), { status: 400 })
    return new URL('v1/usage-stats', base.href.endsWith('/') ? base.href : `${base.href}/`)
}

export async function forwardUsageStats(endpoint, body, fetchImpl = globalThis.fetch) {
    const target = usageStatsTarget(endpoint)
    const response = await fetchImpl(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { error: { message: `在线服务返回了非 JSON 内容（HTTP ${response.status}）` } } }
    return { status: response.status, data }
}
