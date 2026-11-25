import test from 'node:test'
import assert from 'node:assert/strict'

test('Android update links, probes and downloads follow the installed package ID', async () => {
    globalThis.androidBridge = {}
    let applicationId
    let queued
    const requests = []
    globalThis.Capacitor = {
        PluginHeaders: [{ name: 'MonaLocal', methods: ['getApplicationId', 'probeUpdate', 'downloadUpdate', 'updateStatus']
            .map(name => ({ name, rtype: 'promise' })) }],
        nativePromise(_plugin, method, options) {
            if (method === 'getApplicationId') return Promise.resolve({ id: applicationId })
            if (method === 'updateStatus') return Promise.resolve(queued)
            requests.push(options.url)
            return Promise.resolve({})
        },
    }
    const {checkLatestRelease, getUpdatePlatform, getResumableUpdateStatus, probeUpdateSource, startUpdateDownload, sourceUrl} =
        await import('../src/platform/release-update.mjs')
    const base = 'https://github.com/TwiceDrop/genshin_artifact/releases'
    const files = ['mobiletest_android.apk', 'android.apk'].map(suffix => ({
        name: 'synthetic_' + suffix, browser_download_url: base + '/download/v2/synthetic_' + suffix, size: 1,
    }))
    const metadata = { tag_name: 'v2', html_url: base + '/tag/v2', assets: files }
    const fetchMetadata = async url => ({ok: url.startsWith('https://api.github.com'), json: async () => metadata})
    for (const [id, expectedKind, asset] of [
        ['com.mona.artifact.local.mobiletest', 'android-test', files[0]],
        ['com.mona.artifact.local', 'android', files[1]],
    ]) {
        applicationId = id
        const platform = await getUpdatePlatform()
        assert.equal(platform.kind, expectedKind)
        const release = await checkLatestRelease('1', fetchMetadata)
        assert.equal(release.downloadUrl, asset.browser_download_url)
        await probeUpdateSource(release, platform.kind, 'github')
        await startUpdateDownload(release, platform.kind, 'github')
        assert.deepEqual(requests.splice(0), [asset.browser_download_url, asset.browser_download_url])
        const otherAsset = files.find(file => file !== asset)
        for (const source of ['github', 'cnb', 'ghproxy']) {
            for (const phase of ['downloading', 'ready']) {
                queued = {version: release.version, phase, url: sourceUrl(asset.browser_download_url, source)}
                assert.deepEqual(await getResumableUpdateStatus(release, platform.kind), queued)
                queued.url = sourceUrl(otherAsset.browser_download_url, source)
                assert.equal((await getResumableUpdateStatus(release, platform.kind)).phase, 'idle')
            }
        }
        queued = {version: 'v1', phase: 'ready', url: asset.browser_download_url}
        assert.equal((await getResumableUpdateStatus(release, platform.kind)).phase, 'idle')
    }
    applicationId = 'com.mona.artifact.local.mobiletest'
    metadata.assets = [files[1]]
    const release = await checkLatestRelease('1', fetchMetadata)
    assert.equal(release.downloadUrl, metadata.html_url)
    queued = {version: release.version, phase: 'ready', url: files[1].browser_download_url}
    assert.equal((await getResumableUpdateStatus(release, 'android-test')).phase, 'idle')
    await assert.rejects(startUpdateDownload(release, (await getUpdatePlatform()).kind, 'github'), /缺少对应的更新包/)
    assert.deepEqual(requests, [])
})
