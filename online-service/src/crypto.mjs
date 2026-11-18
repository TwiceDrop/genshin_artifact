import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
// N=2^15、r=8 需要约 32 MiB，超过 Node 默认的 maxmem，所以显式放宽到 64 MiB。参数写进哈希串，以后调高不影响旧密码。
const PASSWORD_COST = { N: 32768, r: 8, p: 1 }
const PASSWORD_KEY_BYTES = 32

async function derivePassword(password, salt, { N, r, p }) {
    return scryptAsync(password, salt, PASSWORD_KEY_BYTES, { N, r, p, maxmem: 64 * 1024 * 1024 })
}
export async function hashPassword(password) {
    const salt = randomBytes(16), { N, r, p } = PASSWORD_COST
    const key = await derivePassword(password, salt, PASSWORD_COST)
    return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$')
}
// stored 为空（账号不存在或没有密码）时仍做一次同等开销的计算，避免用响应时间探测账号是否存在。
export async function verifyPassword(password, stored) {
    if (!stored) {
        await derivePassword(password, randomBytes(16), PASSWORD_COST)
        return false
    }
    const [scheme, N, r, p, salt, key, extra] = stored.split('$')
    if (scheme !== 'scrypt' || !salt || !key || extra !== undefined) throw new Error('Invalid stored password hash format')
    const actual = await derivePassword(password, Buffer.from(salt, 'base64url'), { N: Number(N), r: Number(r), p: Number(p) })
    return timingSafeEqual(actual, Buffer.from(key, 'base64url'))
}

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
