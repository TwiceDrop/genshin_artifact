import {CapacitorHttp} from '@capacitor/core'
import {isNative, MonaLocal} from './native.mjs'
import {RELEASE_REPOSITORY, RELEASE_API, UPDATE_SOURCES, sourceUrl, officialReleaseUrl,
    fetchReleaseMetadata, releaseAsset} from '../../server/update-sources.mjs'
export {RELEASE_REPOSITORY, RELEASE_API, UPDATE_SOURCES, releaseAsset}
export const MANUAL_UPDATE_EVENT = 'mona:check-release-update'
export const AUTOMATIC_UPDATE_CHANGED_EVENT = 'mona:automatic-release-update-changed'
const AUTOMATIC_UPDATE_KEY = 'mona.automaticReleaseUpdates'
const ACCELERATED_UPDATE_KEY = 'mona.acceleratedReleaseUpdates'
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


export function isAcceleratedUpdateEnabled() {
    return globalThis.localStorage?.getItem(ACCELERATED_UPDATE_KEY) !== 'false'
}
export function setAcceleratedUpdateEnabled(enabled) {
    globalThis.localStorage.setItem(ACCELERATED_UPDATE_KEY, String(enabled))
}
export function describeRelease(release, currentVersion, native = isNative) {
    const version = String(release.tag_name || '').trim()
    const difference = compareVersions(version, currentVersion)
    if (difference === null) throw new Error('GitHub Release 的版本号无法识别')
    const url = officialReleaseUrl(release.html_url)
    if (!url) throw new Error('GitHub Release 地址无效')
    const assets = Array.isArray(release.assets) ? release.assets : []
    const apk = assets.find(asset => /\.apk$/i.test(asset.name || '') && officialReleaseUrl(asset.browser_download_url))
    return {currentVersion, version, newer: difference > 0, url, assets,
        downloadUrl: native && apk ? officialReleaseUrl(apk.browser_download_url) : url,
        notes: String(release.body || '').trim() || '此版本未附更新日志。'}
}
export async function checkLatestRelease(currentVersion, fetchImpl = globalThis.fetch, native = isNative) {
    return describeRelease(await fetchReleaseMetadata(fetchImpl), currentVersion, native)
}
const local = () => !isNative && ['127.0.0.1', 'localhost'].includes(globalThis.location?.hostname)
async function updateApi(action, body) {
    const response = await fetch('/api/update/' + action, {method: body === undefined ? 'GET' : 'POST',
        headers: {'x-mona-local': '1', 'Content-Type': 'application/json'},
        ...(body === undefined ? {} : {body: JSON.stringify(body)})})
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    return data
}
async function nativeReleaseFetch(url) {
    const response = await CapacitorHttp.request({url, method: 'GET',
        headers: {Accept: 'application/vnd.github+json'}, responseType: 'json',
        connectTimeout: 12000, readTimeout: 12000})
    return {ok: response.status >= 200 && response.status < 300, status: response.status,
        json: async () => typeof response.data === 'string' ? JSON.parse(response.data) : response.data}
}
export function createReleaseCheckCoordinator(currentVersion, fetchImpl) {
    let pending = null
    return () => {
        if (!pending) {
            const accelerated = isAcceleratedUpdateEnabled()
            const request = (async () => {
                if (fetchImpl) return checkLatestRelease(currentVersion, fetchImpl)
                const release = local() ? await updateApi('latest', {accelerated}) :
                    await fetchReleaseMetadata(isNative ? nativeReleaseFetch : globalThis.fetch, accelerated)
                return describeRelease(release, currentVersion)
            })()
            pending = request
            const clear = () => {if (pending === request) pending = null}
            request.then(clear, clear)
        }
        return pending
    }
}
export async function getUpdatePlatform() {
    if (isNative) return {kind: 'android', canInstall: true}
    if (local()) return updateApi('info')
    return {kind: 'portable', canInstall: false}
}
export async function probeUpdateSource(release, kind, source) {
    if (isNative) return MonaLocal.probeUpdate({url: sourceUrl(releaseAsset(release, kind).browser_download_url, source)})
    return updateApi('probe', {version: release.version, source})
}
export async function startUpdateDownload(release, kind, source) {
    if (isNative) {
        const asset = releaseAsset(release, kind)
        return MonaLocal.downloadUpdate({url: sourceUrl(asset.browser_download_url, source), size: asset.size, version: release.version})
    }
    return updateApi('download', {version: release.version, source})
}
export async function getUpdateStatus() {
    return isNative ? MonaLocal.updateStatus() : updateApi('status')
}
export async function cancelUpdateDownload() {
    return isNative ? MonaLocal.cancelUpdate() : updateApi('cancel', {})
}
export async function installDownloadedUpdate() {
    return isNative ? MonaLocal.installUpdate() : updateApi('install', {})
}
export function requestManualUpdateCheck() {window.dispatchEvent(new Event(MANUAL_UPDATE_EVENT))}
export async function openReleaseDownload(url) {
    const trusted = officialReleaseUrl(url)
    if (!trusted) throw new Error('更新地址无效')
    if (isNative) await MonaLocal.openExternal({url: trusted})
    else window.open(trusted, '_blank', 'noopener,noreferrer')
}
