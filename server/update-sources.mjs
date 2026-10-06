export const RELEASE_REPOSITORY = 'TwiceDrop/genshin_artifact'
export const RELEASE_API = 'https://api.github.com/repos/' + RELEASE_REPOSITORY + '/releases/latest'
export const UPDATE_SOURCES = [
    {id: 'github', name: 'GitHub', prefix: ''},
    {id: 'ghfast', name: 'ghfast.top', prefix: 'https://ghfast.top/'},
    {id: 'ghproxy', name: 'ghproxy.net', prefix: 'https://ghproxy.net/'},
    {id: 'gh-proxy', name: 'gh-proxy.com', prefix: 'https://gh-proxy.com/'},
]
export function sourceUrl(url, sourceId) {
    const source = UPDATE_SOURCES.find(item => item.id === sourceId)
    if (!source) throw new Error('下载线路不存在')
    return source.prefix + url
}
export function officialReleaseUrl(value) {
    try {
        const url = new URL(String(value || ''))
        return url.protocol === 'https:' && url.hostname === 'github.com' &&
            !url.username && !url.password && url.pathname.startsWith('/' + RELEASE_REPOSITORY + '/releases/')
            ? url.href : null
    } catch { return null }
}
export function releaseAsset(release, kind) {
    const pattern = {installer: /_windows_x64_setup\.exe$/i, portable: /_web\.zip$/i, android: /\.apk$/i}[kind]
    const asset = release.assets.find(item => pattern.test(item.name) && officialReleaseUrl(item.browser_download_url))
    if (!asset) throw new Error('发布版本缺少对应的更新包（' + kind + '）')
    return asset
}
export async function fetchReleaseMetadata(fetchImpl, accelerated = false) {
    const sources = accelerated ? UPDATE_SOURCES : UPDATE_SOURCES.slice(0, 1)
    const requests = sources.map(async source => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12000)
        try {
            const response = await fetchImpl(sourceUrl(RELEASE_API, source.id), {
                headers: {Accept: 'application/vnd.github+json'}, signal: controller.signal,
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            const release = await response.json()
            if (!officialReleaseUrl(release.html_url)) throw new Error('GitHub Release 地址无效')
            return release
        } catch (error) { throw new Error(source.name + '：' + error.message) }
        finally { clearTimeout(timer) }
    })
    try { return await Promise.any(requests) }
    catch (error) { throw new Error('版本查询失败：' + error.errors.map(item => item.message).join('；')) }
}
