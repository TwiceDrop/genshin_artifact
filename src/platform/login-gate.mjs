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

export async function needsLogin() {
    if (isOfflineChosen()) return false
    try { return !(await cloudApi('config')).user }
    catch (error) { console.error('确认在线账号登录状态失败', error); return true }
}
