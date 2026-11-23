import {ref} from 'vue'
import {isNative} from './native.mjs'
import {isAutomaticPatchEnabled, patchChannelAvailable} from './patch-update.mjs'

// 页面上看得到的内容补丁状态：设置页显示补丁号，Debug 导出和使用统计也读这里。
// 数据来自本机服务的 /api/patch/info（当前正在生效的补丁、待下次启动生效的补丁、最近一次检查的结果）。
export const activePatch = ref(null)   // 这次运行正在生效的补丁号，没有补丁时是 null
let snapshot = {unavailable: '还没有读取'}

export async function refreshPatchInfo({fetchImpl = globalThis.fetch, version = process.env.MONA_VERSION, native = isNative} = {}) {
    if (native) { activePatch.value = null; return snapshot = {unavailable: 'Android 暂不支持内容补丁'} }
    try {
        const response = await fetchImpl('/api/patch/info?version=' + encodeURIComponent(version || ''), {headers: {'x-mona-local': '1'}, cache: 'no-store'})
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'HTTP ' + response.status)
        const {current, pending, lastCheck} = body
        snapshot = {
            active: current.status === 'applied' ? {patch: current.patch, baseVersion: current.baseVersion, files: current.files} : null,
            // 补丁存在但没通过校验或不适用时，阶段和原因记在这里
            rejected: current.status === 'rejected' ? {stage: current.stage, reason: current.reason} : null,
            pending, lastCheck, ...(body.auth && {auth: body.auth}),
        }
        activePatch.value = snapshot.active?.patch ?? body.auth?.patch ?? null
    } catch (error) {
        activePatch.value = null
        snapshot = {unavailable: '读取内容补丁状态失败：' + error.message}
    }
    return snapshot
}

// Debug 导出用，随时同步读取最近一次的状态；是否配置和玩家开关在导出时现读
export const patchDebugInfo = () => ({configured: patchChannelAvailable, automatic: isAutomaticPatchEnabled(), ...snapshot})
