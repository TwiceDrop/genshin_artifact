import {isNative, MonaLocal} from './native.mjs'

export const RELEASE_REPOSITORY = 'TwiceDrop/genshin_artifact'
export const RELEASE_API = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`
export const MANUAL_UPDATE_EVENT = 'mona:check-release-update'
export const AUTOMATIC_UPDATE_CHANGED_EVENT = 'mona:automatic-release-update-changed'
const AUTOMATIC_UPDATE_KEY = 'mona.automaticReleaseUpdates'
const RELEASE_PATH = `/${RELEASE_REPOSITORY}/releases/`

function officialReleaseUrl(value) {
    try {
        const parsed = new URL(String(value || ''))
        return parsed.protocol === 'https:' && parsed.hostname === 'github.com' &&
            !parsed.username && !parsed.password && parsed.pathname.startsWith(RELEASE_PATH)
            ? parsed.href : null
    } catch { return null }
}

export function compareVersions(left, right) {
    const parts = value => {
        const match = String(value || '').trim().match(/^v?(\d+(?:\.\d+)*)(?:[-+].*)?$/i)
        return match ? match[1].split('.').map(Number) : null
    }
    const a = parts(left), b = parts(right)
    if (!a || !b) return null
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const delta = (a[i] || 0) - (b[i] || 0)
        if (delta) return Math.sign(delta)
    }
    return 0
}

export function isAutomaticUpdateEnabled(storage) {
    try { return (storage || globalThis.localStorage)?.getItem(AUTOMATIC_UPDATE_KEY) !== 'false' }
    catch { return true }
}

export function setAutomaticUpdateEnabled(enabled, storage) {
    try {
        const target = storage || globalThis.localStorage
        if (!target?.setItem) return false
        target.setItem(AUTOMATIC_UPDATE_KEY, enabled ? 'true' : 'false')
        globalThis.window?.dispatchEvent(new Event(AUTOMATIC_UPDATE_CHANGED_EVENT))
        return true
    } catch { return false }
}

export async function checkLatestRelease(currentVersion, fetchImpl = globalThis.fetch, native = isNative) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    let response, release
    try {
        response = await fetchImpl(RELEASE_API, {
            headers: {'Accept':'application/vnd.github+json'},
            signal: controller.signal,
        })
        if (!response.ok) throw new Error(`GitHub Release 查询失败（HTTP ${response.status}）`)
        release = await response.json()
    } finally { clearTimeout(timeout) }
    const version = String(release.tag_name || '').trim()
    const difference = compareVersions(version, currentVersion)
    if (difference === null) throw new Error('GitHub Release 的版本号无法识别')
    const url = officialReleaseUrl(release.html_url)
    if (!url) throw new Error('GitHub Release 地址无效')
    const assets = Array.isArray(release.assets) ? release.assets : []
    const apk = assets.find(asset => /\.apk$/i.test(asset.name || '') &&
        officialReleaseUrl(asset.browser_download_url))
    return {
        currentVersion, version, newer: difference > 0, url,
        downloadUrl: native && apk ? officialReleaseUrl(apk.browser_download_url) : url,
        notes: String(release.body || '').trim() || '此版本未附更新日志。',
    }
}

export function createReleaseCheckCoordinator(currentVersion, fetchImpl = globalThis.fetch) {
    let pending = null
    return () => {
        if (!pending) {
            const request = checkLatestRelease(currentVersion, fetchImpl)
            pending = request
            const clear = () => { if (pending === request) pending = null }
            request.then(clear, clear)
        }
        return pending
    }
}

export function requestManualUpdateCheck() {
    window.dispatchEvent(new Event(MANUAL_UPDATE_EVENT))
}

export async function openReleaseDownload(url) {
    const trusted = officialReleaseUrl(url)
    if (!trusted) throw new Error('更新地址无效')
    if (isNative) await MonaLocal.openExternal({url: trusted})
    else window.open(trusted, '_blank', 'noopener,noreferrer')
}
