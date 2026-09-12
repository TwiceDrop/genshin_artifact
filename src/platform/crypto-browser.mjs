import { md5 } from 'js-md5'
export const randomUUID = () => globalThis.crypto.randomUUID()
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
