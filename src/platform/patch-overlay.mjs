// 页面和各个 Worker 在启动计算内核之前读内容补丁：向本机服务要这次运行的补丁数据，交给 composeKernelApi 的 overlay 参数。
// 返回 {status, overlay, reason, ...}：
//   applied     有补丁，overlay 是替换数据
//   none        没有补丁
//   rejected    补丁存在但没通过校验或不适用（stage、reason 说明原因），按安装包原数据运行
//   unavailable 本机服务取不到（Android、开发服务器、服务没启动），按安装包原数据运行
// 有补丁但被拒绝时在控制台留下原因；Debug 导出的接入见任务 06。
export async function loadPatchOverlay({fetchImpl = globalThis.fetch, version = process.env.MONA_VERSION, log = console.warn} = {}) {
    let response
    try {
        response = await fetchImpl('/api/patch/overlay?version=' + encodeURIComponent(version || ''), {headers: {'x-mona-local': '1'}, cache: 'no-store'})
    } catch (error) {
        return {status: 'unavailable', reason: '本机服务无法访问：' + error.message}
    }
    let body
    try { body = await response.json() } catch { return {status: 'unavailable', reason: '本机服务没有返回补丁数据（HTTP ' + response.status + '）'} }
    if (!response.ok) return {status: 'unavailable', reason: body?.error || 'HTTP ' + response.status}
    if (body.status === 'rejected') log('内容补丁未生效，使用安装包原数据：', body.reason)
    return body
}
