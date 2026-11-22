export function validateEnkaUid(uid) {
    if (typeof uid !== 'string' || !/^\d{9,10}$/.test(uid)) throw new Error('请输入 9 至 10 位原神 UID')
}

const errors = {
    400: 'UID 格式有误', 404: '未找到该 UID 的公开资料', 424: '游戏服务器维护中',
    429: '请求过于频繁，请稍后再试', 500: 'Enka 服务暂时不可用', 503: 'Enka 服务维护中',
}

// Both the local server and Android use the same fixed, anonymous public endpoint.
export function createEnkaReader(request = fetch) {
    const cache = new Map()
    return async uid => {
        validateEnkaUid(uid)
        for (const [key, entry] of cache) if (entry.expires <= Date.now()) cache.delete(key)
        if (cache.has(uid)) return cache.get(uid).data
        const response = await request('https://enka.network/api/uid/' + uid + '/', {
            method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'MonaArtifact (github.com/TwiceDrop/genshin_artifact)' },
            credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error(errors[response.status] || ('Enka 请求失败（HTTP ' + response.status + '）'))
        const data = await response.json()
        if (data?.uid != null && String(data.uid) !== uid) throw new Error('Enka 返回的 UID 与输入不一致')
        if (Number.isFinite(data?.ttl) && data.ttl > 0) {
            if (cache.size >= 32) cache.delete(cache.keys().next().value)
            cache.set(uid, { data, expires: Date.now() + data.ttl * 1000 })
        }
        return data
    }
}
