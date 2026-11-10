import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

export function createVault(key) {
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('VAULT_KEY_FILE must contain a base64-encoded 32-byte key')
    return {
        seal(value, context) {
            const iv = randomBytes(12)
            const cipher = createCipheriv('aes-256-gcm', key, iv)
            cipher.setAAD(Buffer.from(context))
            const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
            return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
        },
        open(value, context) {
            const [version, iv, tag, ciphertext, extra] = value.split('.')
            if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error('Invalid encrypted credential format')
            const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
            decipher.setAAD(Buffer.from(context))
            decipher.setAuthTag(Buffer.from(tag, 'base64url'))
            return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8'))
        },
    }
}

export function sameSecret(left, right) {
    const a = Buffer.from(left), b = Buffer.from(right)
    return a.length === b.length && timingSafeEqual(a, b)
}
