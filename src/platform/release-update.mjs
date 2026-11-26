import {CapacitorHttp} from '@capacitor/core'
import {isNative, MonaLocal} from './native.mjs'
import {RELEASE_REPOSITORY, RELEASE_API, UPDATE_SOURCES, sourceUrl, officialReleaseUrl,
    fetchReleaseMetadata, findReleaseAsset, releaseAsset, compareVersions} from '../../server/update-sources.mjs'
export {RELEASE_REPOSITORY, RELEASE_API, UPDATE_SOURCES, findReleaseAsset, releaseAsset, compareVersions, sourceUrl}
export const MANUAL_UPDATE_EVENT = 'mona:check-release-update'
export const AUTOMATIC_UPDATE_CHANGED_EVENT = 'mona:automatic-release-update-changed'
const AUTOMATIC_UPDATE_KEY = 'mona.automaticReleaseUpdates'
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


export function describeRelease(release, currentVersion, native = isNative, apkKind = 'android') {
    const version = String(release.tag_name || '').trim()
    const difference = compareVersions(version, currentVersion)
    if (difference === null) throw new Error('发布版本号无法识别')
    const url = officialReleaseUrl(release.html_url)
    if (!url) throw new Error('发布版本地址无效')
    const assets = Array.isArray(release.assets) ? release.assets : []
    const asset = findReleaseAsset({assets}, native ? apkKind : 'tauri')
    return {currentVersion, version, newer: difference > 0, url, assets,
        downloadUrl: asset ? officialReleaseUrl(asset.browser_download_url) : url,
        notes: String(release.body || '').trim() || '此版本未附更新日志。'}
}
export async function checkLatestRelease(currentVersion, fetchImpl = globalThis.fetch, native = isNative) {
    const release = await fetchReleaseMetadata(fetchImpl, false, currentVersion)
    const kind = native && isNative ? (await getUpdatePlatform()).kind : 'android'
    return describeRelease(release, currentVersion, native, kind)
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
async function nativeReleaseFetch(url, options) {
    const response = await CapacitorHttp.request({url, method: 'GET',
        headers: options.headers, responseType: 'json',
        connectTimeout: 12000, readTimeout: 12000})
    return {ok: response.status >= 200 && response.status < 300, status: response.status,
        json: async () => typeof response.data === 'string' ? JSON.parse(response.data) : response.data}
}
export function createReleaseCheckCoordinator(currentVersion, fetchImpl) {
    let pending = null
    return () => {
        if (!pending) {
            const request = (async () => {
                if (fetchImpl) return checkLatestRelease(currentVersion, fetchImpl)
                if (local()) return describeRelease(await updateApi('latest', {currentVersion}), currentVersion)
                return checkLatestRelease(currentVersion, isNative ? nativeReleaseFetch : globalThis.fetch)
            })()
            pending = request
            const clear = () => {if (pending === request) pending = null}
            request.then(clear, clear)
        }
        return pending
    }
}
export async function getUpdatePlatform() {
    if (isNative) {
        const {id} = await MonaLocal.getApplicationId()
        return {kind: id.endsWith('.mobiletest') ? 'android-test' : 'android', canInstall: true}
    }
    if (local()) {
        const platform = await updateApi('info')
        if (platform.kind === 'tauri') return platform
    }
    return {kind: 'tauri', canInstall: false}
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
export async function getResumableUpdateStatus(release, kind) {
    const status = await getUpdateStatus()
    const idle = {phase: 'idle', downloaded: 0, total: 0}
    if (status.version !== release.version) return idle
    if (!isNative) return status
    const asset = findReleaseAsset(release, kind)
    const matches = asset && UPDATE_SOURCES.some(source => sourceUrl(asset.browser_download_url, source.id) === status.url)
    return matches ? status : idle
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
