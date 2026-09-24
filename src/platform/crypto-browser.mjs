import { md5 } from 'js-md5'
export function randomUUID() {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export function randomBytes(length) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length))
    return { toString: encoding => { if (encoding !== 'hex') throw new Error('仅支持 hex'); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') } }
}
export function randomInt(min, max) {
    const range = max - min, limit = Math.floor(0x100000000 / range) * range
    let value
    do { value = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] } while (value >= limit)
    return min + value % range
}
export function createHash(name) {
    if (name !== 'md5') throw new Error('不受支持的摘要')
    let text = ''
    return { update(value) { text += value; return this }, digest(encoding) { if (encoding !== 'hex') throw new Error('不受支持的编码'); return md5(text) } }
}
export default { randomUUID, randomBytes, randomInt, createHash }
