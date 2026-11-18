// 首次使用弹窗的判断（2026-11-18 与开发者约定）：
// 本机所有本地账号都没有圣遗物和预设，且本设备没记过「已完成首次引导」，才弹出。
// 读写 localStorage 出错时不拦：读不到「已完成」就当没完成，本次照常弹出。

export const FIRST_USE_KEY = 'mona.firstUseDone'

// 存储里没有数据：不存在、空数组、空对象，或只含这类空值（圣遗物按部位存，各部位为空数组）
export function isDataEmpty(value) {
    if (value === null || value === undefined) return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.values(value).every(isDataEmpty)
    return false
}

// accountData: [{ artifacts, presets }]，每个本地账号一项，值是 mona_account_artifacts_<id> / mona_account_presets_<id> 的内容
export function needsFirstUse({ done, accountData }) {
    if (done) return false
    return accountData.every(({ artifacts, presets }) => isDataEmpty(artifacts) && isDataEmpty(presets))
}

export function isFirstUseDone() {
    try { return localStorage.getItem(FIRST_USE_KEY) === 'true' } catch { return false }
}

export function markFirstUseDone() {
    try { localStorage.setItem(FIRST_USE_KEY, 'true') } catch (error) { console.error('无法记住首次引导已完成', error) }
}
