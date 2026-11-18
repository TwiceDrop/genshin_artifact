// 米游社 / HoYoLAB Cookie 端到端加密（docs/specs/online-accounts 已定结论 1，任务 08）。
// 用户自设的解密密码经 PBKDF2-SHA256 派生 AES-GCM 256 密钥；随机 12 字节 IV 拼在密文前面，整体 base64url 编码。
// 派生参数随密文一起上传（盐、kdf、格式版本），以后调高迭代次数时旧密文仍按自己的参数解开。
// 桌面和 Android 都在页面里用 WebCrypto，共用这一份代码。
export const COOKIE_VAULT_VERSION = 1
export const KDF_ITERATIONS = 600000
const SALT_BYTES = 16, IV_BYTES = 12

const subtle = () => globalThis.crypto.subtle
const encode = bytes => {
    let text = ''
    for (const byte of bytes) text += String.fromCharCode(byte)
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const decode = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
const decryptFailed = () => Object.assign(new Error('解密密码不正确，或云端 Cookie 已损坏'), { code: 'COOKIE_DECRYPT_FAILED' })

// 派生密钥。salt 省略时随机生成（设置新的解密密码）；返回值可原样存进本机（key 为原始密钥的 base64url）。
export async function deriveCookieKey(passphrase, { salt, iterations = KDF_ITERATIONS } = {}) {
    const saltBytes = salt ? decode(salt) : globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const material = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits'])
    const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, material, 256)
    return { key: encode(new Uint8Array(bits)), salt: encode(saltBytes), kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations } }
}

const aesKey = derived => subtle().importKey('raw', decode(derived.key), 'AES-GCM', false, ['encrypt', 'decrypt'])

// 返回 PUT /v1/cookie-vaults 的请求体 {ciphertext, salt, kdf, version}。
export async function encryptCookie(derived, cookie) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const sealed = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, await aesKey(derived), new TextEncoder().encode(cookie)))
    const joined = new Uint8Array(IV_BYTES + sealed.length)
    joined.set(iv); joined.set(sealed, IV_BYTES)
    return { ciphertext: encode(joined), salt: derived.salt, kdf: { ...derived.kdf }, version: COOKIE_VAULT_VERSION }
}

// vault 为 GET /v1/cookie-vaults/:platform/:accountUid 返回的 vault。盐或派生参数与本机密钥不同时，
// 说明解密密码已在别处修改，需要重新输入，code 为 COOKIE_KEY_STALE。
export async function decryptCookie(derived, vault) {
    if (vault.version !== COOKIE_VAULT_VERSION) throw Object.assign(new Error(`不支持的 Cookie 密文格式版本 ${vault.version}`), { code: 'COOKIE_VAULT_VERSION' })
    if (vault.salt !== derived.salt || vault.kdf?.iterations !== derived.kdf.iterations)
        throw Object.assign(new Error('解密密码已在其他设备修改，请重新输入解密密码'), { code: 'COOKIE_KEY_STALE' })
    let joined
    try { joined = decode(vault.ciphertext) } catch { throw decryptFailed() }
    try {
        const plain = await subtle().decrypt({ name: 'AES-GCM', iv: joined.slice(0, IV_BYTES) }, await aesKey(derived), joined.slice(IV_BYTES))
        return new TextDecoder().decode(plain)
    } catch { throw decryptFailed() }
}
