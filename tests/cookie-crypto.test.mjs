import test from 'node:test'
import assert from 'node:assert/strict'
import { pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto'
import { deriveCookieKey, encryptCookie, decryptCookie, KDF_ITERATIONS } from '../src/cloud/cookie-crypto.mjs'

// 合成数据。独立预期值用 node:crypto 直接按约定格式计算（PBKDF2-SHA256 → AES-256-GCM，12 字节 IV + 密文 + 16 字节标签，base64url），
// 不经过被测模块，以免两边共用同一处错误。
const passphrase = '合成解密密码-synthetic'
const salt = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex').toString('base64url')
const cookie = 'ltuid_v2=10001;ltoken_v2=synthetic-ltoken;cookie_token_v2=synthetic-token;account_id_v2=10001;account_mid_v2=synthetic-mid;'
const expectedKey = pbkdf2Sync(passphrase, Buffer.from(salt, 'base64url'), KDF_ITERATIONS, 32, 'sha256')

test('cookie key derivation follows PBKDF2-SHA256 with 600000 iterations and records its parameters', async () => {
    const derived = await deriveCookieKey(passphrase, { salt })
    assert.equal(derived.key, expectedKey.toString('base64url'))
    assert.deepEqual(derived.kdf, { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 })
    assert.equal(derived.salt, salt)
    const fresh = await deriveCookieKey(passphrase)
    assert.equal(Buffer.from(fresh.salt, 'base64url').length, 16)
    assert.notEqual(fresh.salt, salt)
})

test('ciphertext from an independent AES-GCM implementation decrypts, and our ciphertext decrypts there', async () => {
    const derived = await deriveCookieKey(passphrase, { salt })
    const iv = Buffer.from('a0a1a2a3a4a5a6a7a8a9aaab', 'hex')
    const cipher = createCipheriv('aes-256-gcm', expectedKey, iv)
    const independent = Buffer.concat([iv, cipher.update(cookie, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64url')
    const vault = { ciphertext: independent, salt, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }, version: 1 }
    assert.equal(await decryptCookie(derived, vault), cookie)

    const sealed = await encryptCookie(derived, cookie)
    assert.deepEqual({ ...sealed, ciphertext: undefined }, { ciphertext: undefined, salt, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600000 }, version: 1 })
    assert.match(sealed.ciphertext, /^[A-Za-z0-9_-]+$/)
    const bytes = Buffer.from(sealed.ciphertext, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', expectedKey, bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(-16))
    assert.equal(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8'), cookie)
    assert.notEqual((await encryptCookie(derived, cookie)).ciphertext, sealed.ciphertext)
})

test('a wrong passphrase or tampered ciphertext fails with a clear error, and a changed salt is reported as stale', async () => {
    const derived = await deriveCookieKey(passphrase, { salt })
    const sealed = await encryptCookie(derived, cookie)
    const wrong = await deriveCookieKey('错误的密码', { salt })
    await assert.rejects(decryptCookie(wrong, sealed), { code: 'COOKIE_DECRYPT_FAILED', message: '解密密码不正确，或云端 Cookie 已损坏' })
    const bytes = Buffer.from(sealed.ciphertext, 'base64url'); bytes[20] ^= 1
    await assert.rejects(decryptCookie(derived, { ...sealed, ciphertext: bytes.toString('base64url') }), { code: 'COOKIE_DECRYPT_FAILED' })
    const other = await deriveCookieKey(passphrase)
    await assert.rejects(decryptCookie(other, sealed), { code: 'COOKIE_KEY_STALE' })
})
