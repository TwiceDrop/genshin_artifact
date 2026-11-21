export const RELEASE_REPOSITORY = 'TwiceDrop/genshin_artifact'
export const CNB_REPOSITORY = 'twicedrop/genshin_artifact'
export const RELEASE_API = 'https://api.github.com/repos/' + RELEASE_REPOSITORY + '/releases/latest'
export const CNB_RELEASES = 'https://cnb.cool/' + CNB_REPOSITORY + '/-/releases'
export const CNB_RELEASE_API = CNB_RELEASES + '/latest'
export const UPDATE_SOURCES = [
    {id: 'github', name: 'GitHub', prefix: ''},
    {id: 'cnb', name: 'CNB.cool', prefix: ''},
    {id: 'ghfast', name: 'ghfast.top', prefix: 'https://ghfast.top/'},
    {id: 'ghproxy', name: 'ghproxy.net', prefix: 'https://ghproxy.net/'},
    {id: 'gh-proxy', name: 'gh-proxy.com', prefix: 'https://gh-proxy.com/'},
]
// 版本号：数字段，可跟 EA（或 -EA），EA 后面可再跟补丁段，例如 7.2.05EA.01；其他 -/+ 后缀不参与比较。
// 数字段先比；数字相同时 EA 早于正式版，两个 EA 再比补丁段。
export function compareVersions(left, right) {
    const parts = value => {
        const version = String(value || '').trim().replace(/^(v?\d+\.\d+\.\d+)-hotfix(\d+)$/i, '$1.$2')
        const match = version.match(/^v?(\d+(?:\.\d+)*)(?:(-?EA)(?:\.(\d+(?:\.\d+)*))?|[-+].*)?$/i)
        return match ? {numbers: match[1].split('.').map(Number), early: !!match[2], patch: (match[3] || '').split('.').filter(Boolean).map(Number)} : null
    }
    const order = (x, y) => {
        for (let i = 0; i < Math.max(x.length, y.length); i++) {
            const delta = (x[i] || 0) - (y[i] || 0)
            if (delta) return Math.sign(delta)
        }
        return 0
    }
    const a = parts(left), b = parts(right)
    if (!a || !b) return null
    return order(a.numbers, b.numbers) || (Number(b.early) - Number(a.early)) || order(a.patch, b.patch)
}
export function sourceUrl(value, sourceId) {
    const source = UPDATE_SOURCES.find(item => item.id === sourceId)
    if (!source) throw new Error('下载线路不存在')
    if (sourceId === 'cnb' && value === RELEASE_API) return CNB_RELEASE_API
    let url = value
    const trusted = officialReleaseUrl(value)
    const location = trusted && new URL(trusted)
    const cnbPrefix = '/' + CNB_REPOSITORY + '/-/releases/download/'
    if (location?.hostname === 'cnb.cool' && location.pathname.startsWith(cnbPrefix))
        url = 'https://github.com/' + RELEASE_REPOSITORY + '/releases/download/' + location.pathname.slice(cnbPrefix.length)
    if (sourceId === 'cnb') {
        const asset = trusted && new URL(url).pathname.match(/^\/TwiceDrop\/genshin_artifact\/releases\/download\/([^/]+)\/([^/]+)$/)
        if (!asset) throw new Error('CNB线路只支持本项目发布附件')
        return CNB_RELEASES + '/download/' + asset[1] + '/' + asset[2]
    }
    return source.prefix + url
}
export function officialReleaseUrl(value) {
    try {
        const url = new URL(String(value || ''))
        const github = url.hostname === 'github.com' && url.pathname.startsWith('/' + RELEASE_REPOSITORY + '/releases/')
        const cnb = url.hostname === 'cnb.cool' && (url.pathname === '/' + CNB_REPOSITORY + '/-/releases' || url.pathname.startsWith('/' + CNB_REPOSITORY + '/-/releases/'))
        return url.protocol === 'https:' && !url.username && !url.password && (github || cnb) ? url.href : null
    } catch { return null }
}
export function releaseAsset(release, kind) {
    const pattern = {tauri: /_tauri_x64\.exe$/i, installer: /_windows_x64_setup\.exe$/i, portable: /_web\.zip$/i, android: /_android\.apk$/i, 'android-test': /_mobiletest_android\.apk$/i}[kind]
    const asset = release.assets.find(item => pattern.test(item.name) && (kind !== 'android' || !/_mobiletest_android\.apk$/i.test(item.name)) && officialReleaseUrl(item.browser_download_url))
    if (!asset) throw new Error('发布版本缺少对应的更新包（' + kind + '）')
    return asset
}
export async function fetchReleaseMetadata(fetchImpl, _accelerated = false, currentVersion) {
    // Version discovery is independent of the saved download acceleration setting.
    const sources = ['cnb', 'github'].map(id => UPDATE_SOURCES.find(source => source.id === id))
    const errors = []
    let newest
    for (const source of sources) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12000)
        try {
            const response = await fetchImpl(sourceUrl(RELEASE_API, source.id), {
                headers: {Accept: source.id === 'cnb' ? 'application/json' : 'application/vnd.github+json'}, signal: controller.signal,
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            let release = await response.json()
            if (source.id === 'cnb') release = {...release, html_url: CNB_RELEASES,
                assets: (release.assets || []).map(asset => ({...asset, browser_download_url: CNB_RELEASES + '/download/' + encodeURIComponent(release.tag_name) + '/' + encodeURIComponent(asset.name)}))}
            if (!officialReleaseUrl(release.html_url)) throw new Error('发布版本地址无效')
            if (compareVersions(release.tag_name, '0') === null) throw new Error('发布版本号无法识别')
            if (!newest || compareVersions(release.tag_name, newest.tag_name) > 0) newest = release
            if (!currentVersion || compareVersions(release.tag_name, currentVersion) > 0) return newest
        } catch (error) { errors.push(source.name + '：' + error.message) }
        finally { clearTimeout(timer) }
    }
    if (newest) return newest
    throw new Error('版本查询失败：' + errors.join('；'))
}
