// The app's usage stats recorder. Pages call recordUsage(featureId) where a key action succeeds;
// page features are recorded by the router hook in install.mjs.
// MONA_USAGE_STATS_URL is set at build time; when it is empty usage stats stay off.
import { ref } from 'vue'
import { createUsageStatsRecorder } from './recorder.mjs'
import { installUsageStats as install } from './install.mjs'
import { CapacitorHttp } from '@capacitor/core'
import { isNative } from '../platform/native.mjs'
import { desktopUsageStatsSender, nativeUsageStatsSender } from '../platform/usage-stats-transport.mjs'

const storage = {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
}
const endpoint = process.env.MONA_USAGE_STATS_URL

export const usageStats = createUsageStatsRecorder({
    storage, endpoint, platform: isNative ? 'android' : 'windows', version: process.env.MONA_VERSION,
    send: isNative ? nativeUsageStatsSender(endpoint, options => CapacitorHttp.request(options)) : desktopUsageStatsSender(endpoint),
})
export const recordUsage = feature => usageStats.record(feature)
export const usageStatsDebugInfo = () => usageStats.debugInfo()
export const installUsageStats = router => install({ router, recorder: usageStats })

// For the first-run notice and the settings switch.
export const usageStatsAvailable = usageStats.available()
export const usageStatsConsent = ref(usageStats.consent())
export function setUsageStatsConsent(value) {
    usageStats.setConsent(value)
    usageStatsConsent.value = usageStats.consent()
    if (value === 'on') usageStats.flush()
}
