import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
export const isNative = Capacitor.isNativePlatform()
export const MonaLocal = registerPlugin('MonaLocal')
const hosts = new Set(['passport-api.mihoyo.com','api-takumi.mihoyo.com','api-takumi-record.mihoyo.com','public-data-api.mihoyo.com'])
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
