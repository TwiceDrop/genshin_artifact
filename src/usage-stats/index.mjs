// The app's usage stats recorder. Pages call recordUsage(featureId) where a key action succeeds;
// page features are recorded by the router hook in install.mjs.
// MONA_USAGE_STATS_URL is set at build time; when it is empty usage stats stay off.
import { createUsageStatsRecorder } from './recorder.mjs'
import { installUsageStats as install } from './install.mjs'
import { isNative } from '../platform/native.mjs'
import { desktopUsageStatsSender } from '../platform/usage-stats-transport.mjs'

const storage = {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
}
// The Android sender arrives with its own task; until then the Android build reports nothing.
const endpoint = isNative ? '' : process.env.MONA_USAGE_STATS_URL

export const usageStats = createUsageStatsRecorder({
    storage, endpoint, platform: isNative ? 'android' : 'windows', version: process.env.MONA_VERSION,
    send: desktopUsageStatsSender(endpoint),
})
export const recordUsage = feature => usageStats.record(feature)
export const usageStatsDebugInfo = () => usageStats.debugInfo()
export const installUsageStats = router => install({ router, recorder: usageStats })
