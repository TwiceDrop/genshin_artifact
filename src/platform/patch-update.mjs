import {isNative} from './native.mjs'

// 页面端的内容补丁检查：启动时查一次，之后每隔几小时查一次，玩家打开计算页时也查（不短于最小间隔）。
// 实际的下载和校验在本机服务里（server/patch-updater.mjs），这里只负责什么时候触发。
// 补丁地址和公钥来自构建配置 MONA_PATCH_BASE_URL、MONA_PATCH_PUBLIC_KEY，任一为空就不检查。
// 第一版只做 Windows 桌面，Android 没有本机服务，不检查。装好的补丁下次启动才生效。
const AUTOMATIC_PATCH_KEY = 'mona.automaticContentPatches'

// 玩家开关，默认开启；关闭后不再发起检查。界面入口见任务 06。
export function isAutomaticPatchEnabled(storage) {
    try { return (storage || globalThis.localStorage)?.getItem(AUTOMATIC_PATCH_KEY) !== 'false' } catch { return true }
}
export function setAutomaticPatchEnabled(enabled, storage) {
    try {
        const target = storage || globalThis.localStorage
        if (!target?.setItem) return false
        target.setItem(AUTOMATIC_PATCH_KEY, enabled ? 'true' : 'false')
        return true
    } catch { return false }
}

export function createPatchChecker({fetchImpl = globalThis.fetch, version = process.env.MONA_VERSION, baseUrl = process.env.MONA_PATCH_BASE_URL,
    publicKey = process.env.MONA_PATCH_PUBLIC_KEY, storage, native = isNative, now = Date.now, minGap = 10 * 60 * 1000, log = console.warn} = {}) {
    let last = null, lastAt = 0
    return async function check({force = false} = {}) {
        if (native) return {status: 'disabled', reason: 'Android 暂不支持内容补丁'}
        if (!baseUrl || !publicKey) return {status: 'disabled', reason: '没有配置补丁地址或公钥'}
        if (!isAutomaticPatchEnabled(storage)) return {status: 'disabled', reason: '已关闭自动获取内容补丁'}
        if (!force && last && now() - lastAt < minGap) return last
        lastAt = now()
        try {
            const response = await fetchImpl('/api/patch/check', {method: 'POST', headers: {'x-mona-local': '1', 'Content-Type': 'application/json'},
                body: JSON.stringify({version, baseUrl, publicKey}), cache: 'no-store'})
            const body = await response.json()
            last = response.ok ? body : {status: 'unavailable', reason: body?.error || 'HTTP ' + response.status}
        } catch (error) { last = {status: 'unavailable', reason: '本机服务无法访问：' + error.message} }
        if (last.status === 'failed') log('内容补丁检查失败，保持现有数据，下次再试：', last.reason)
        return last
    }
}

// 启动后立即查一次，之后定时再查；requestCheck 给「打开计算页」这类时机用
export function startPatchChecks({check, interval = 4 * 60 * 60 * 1000, setTimer = setInterval, clearTimer = clearInterval} = {}) {
    check().catch(error => console.error('内容补丁检查出错', error))
    const timer = setTimer(() => check({force: true}).catch(error => console.error('内容补丁检查出错', error)), interval)
    return {requestCheck: () => check(), stop: () => clearTimer(timer)}
}
