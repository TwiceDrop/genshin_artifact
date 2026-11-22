import { CapacitorHttp } from '@capacitor/core'
import { isNative } from './native.mjs'
import { createEnkaReader, validateEnkaUid } from '../../server/enka.mjs'

const readNative = createEnkaReader(async (url, options) => {
    const response = await CapacitorHttp.get({ url, headers: options.headers, responseType: 'json',
        connectTimeout: 15000, readTimeout: 15000, disableRedirects: true })
    return { ok: response.status === 200, status: response.status,
        json: () => typeof response.data === 'string' ? JSON.parse(response.data) : response.data }
})

export async function fetchEnkaShowcase(uid) {
    validateEnkaUid(uid)
    if (isNative) return readNative(uid)
    const response = await fetch('/api/enka/' + uid, { headers: { 'X-Mona-Local': '1' }, credentials: 'omit' })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('无法连接本机 Enka 导入服务')
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Enka 展柜读取失败')
    return data
}
