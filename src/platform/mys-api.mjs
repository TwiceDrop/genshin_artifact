import { isNative } from './native.mjs'

// 本地米游社 / HoYoLAB 接口：桌面走本机服务 /api/mys，Android 走 mys-mobile.mjs。
// 米游社导入和在线账号页（解密云端 Cookie 后存入本机）共用。
export async function mysApi(path, method = 'GET', body) {
    if (isNative) return (await import('./mys-mobile.mjs')).mobileMysApi(path, method, body)
    let response
    try { response = await fetch(`/api/mys/${path}`, { method, headers: { 'X-Mona-Local': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'same-origin' }) }
    catch { throw new Error('本机服务连接失败，请在项目目录运行 npm start，并打开 http://127.0.0.1:4174') }
    if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('扫码登录需要本机服务。请运行 npm start，打开 http://127.0.0.1:4174')
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.error || '同步失败'), { retcode: data.retcode })
    return data
}
