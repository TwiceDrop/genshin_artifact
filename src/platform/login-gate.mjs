// 进入软件时是否先显示登录页（2026-11-17 与开发者约定）：
// 选过「以离线模式继续」就记在本机，以后直接进入；否则向本机服务确认在线账号是否已登录。
// 确认失败（如没有本机服务）也先到登录页，失败原因由登录页显示。
import { cloudApi } from './cloud.mjs'

const OFFLINE_KEY = 'mona.offlineMode'

export function isOfflineChosen() {
    try { return localStorage.getItem(OFFLINE_KEY) === 'true' } catch { return false }
}

export function chooseOffline() {
    try { localStorage.setItem(OFFLINE_KEY, 'true') } catch (error) { console.error('无法记住离线模式选择', error) }
}

export function clearOfflineChoice() {
    try { localStorage.removeItem(OFFLINE_KEY) } catch (error) { console.error('无法清除离线模式选择', error) }
}

// 云档案同步跟随登录状态：已登录时启动，退出登录或会话失效后停止。
// 登录、注册、退出等接口成功后 cloudApi 会发出 mona-cloud-context-change，这里据此重新确认。
// 返回首次确认的 Promise；确认或启动失败照实报错，不改变当前状态。
export function followCloudSession(sync, { api = cloudApi, events = globalThis.window } = {}) {
    let running = false, queue = Promise.resolve()
    const check = () => {
        queue = queue.then(async () => {
            let user
            try { user = (await api('config')).user } catch (error) { console.error('确认在线账号登录状态失败，云档案同步保持原状', error); return }
            if (user && !running) {
                try { await sync.start(); running = true } catch (error) { console.error('启动云档案同步失败', error) }
            } else if (!user && running) { sync.stop(); running = false }
        })
        return queue
    }
    events?.addEventListener('mona-cloud-context-change', check)
    return check()
}

export async function needsLogin() {
    if (isOfflineChosen()) return false
    try { return !(await cloudApi('config')).user }
    catch (error) { console.error('确认在线账号登录状态失败', error); return true }
}
