// Hooks a usage stats recorder into the app: page features from the router, sends on start,
// every 10 minutes and when the page is hidden or closed.
import { usageFeatureIdForRoute } from '../../server/usage-stats-features.mjs'

export const USAGE_STATS_SEND_INTERVAL_MS = 10 * 60 * 1000

// The feature of the route record a navigation landed on; an alias (such as `/` for `/intro`) counts as the page it aliases.
export function routeUsageFeature(to) {
    const matched = to.matched?.at(-1)
    if (!matched) return null
    const path = (matched.aliasOf || matched).path
    return { path, feature: usageFeatureIdForRoute(path) }
}

export function installUsageStats({ router, recorder, target = window, timers = globalThis, report = console.error }) {
    router.afterEach((to, from, failure) => {
        if (failure) return
        const route = routeUsageFeature(to)
        if (!route) return
        // tests/usage-stats-features.test.mjs keeps every page route registered; reaching this is a missed registration.
        if (!route.feature) return report(`使用统计：路由 ${route.path} 没有登记功能 ID`)
        recorder.record(route.feature)
    })
    if (!recorder.active()) return
    timers.setTimeout(() => recorder.flush(), 5000)
    timers.setInterval(() => recorder.flush(), USAGE_STATS_SEND_INTERVAL_MS)
    target.addEventListener('pagehide', () => recorder.flush({ keepalive: true }))
    target.document?.addEventListener('visibilitychange', () => {
        if (target.document.visibilityState === 'hidden') recorder.flush({ keepalive: true })
    })
}
