import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
export const isNative = Capacitor.isNativePlatform()
export const MonaLocal = registerPlugin('MonaLocal')
let browserCalculationSession
export async function calculationSession() {
    if (isNative) return (await MonaLocal.calculationSession()).id
    if (['127.0.0.1','localhost'].includes(location.hostname)) {
        const response = await fetch('/api/calculation/session', {headers:{'x-mona-local':'1'},cache:'no-store'})
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        return data.id
    }
    if (!browserCalculationSession) {
        const key = 'mona_browser_calculation_session'
        browserCalculationSession = performance.getEntriesByType('navigation')[0]?.type === 'reload' ? sessionStorage.getItem(key) : null
        browserCalculationSession ||= crypto.randomUUID()
        sessionStorage.setItem(key,browserCalculationSession)
    }
    return browserCalculationSession
}
const hosts = new Set(['passport-api.mihoyo.com','api-takumi.mihoyo.com','api-takumi-record.mihoyo.com','public-data-api.mihoyo.com','api-os-takumi.mihoyo.com','sg-public-api.hoyolab.com'])
export async function nativeFetch(url, options = {}) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !hosts.has(parsed.hostname)) throw new Error('不受支持的米游社接口')
    if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    const response = await CapacitorHttp.request({ url: String(url), method: options.method || 'GET', headers: options.headers || {},
        ...(options.body ? { data: JSON.parse(options.body) } : {}), responseType: 'json', connectTimeout: 15000, readTimeout: 20000, disableRedirects: true })
    if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    return { ok: response.status >= 200 && response.status < 300, status: response.status, json: async () => typeof response.data === 'string' ? JSON.parse(response.data) : response.data }
}
export async function saveText(text, type, filename) {
    if (isNative) return MonaLocal.saveFile({ text, mimeType: type, filename })
    const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
