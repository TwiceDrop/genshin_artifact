import { transaction } from './db.mjs'
import { ApiError, invalid, missing } from './errors.mjs'

// 客户端加密后的米游社 / HoYoLAB Cookie（docs/specs/online-accounts 已定结论 1、任务 04）。
// 服务器不解析密文，只校验格式和大小；平台和游戏账号 UID 明文保存，用于按用户去重。
// 客户端约定：PBKDF2-SHA256 由用户自设的解密密码派生密钥，AES-GCM 加密，IV 拼在密文里。
export const COOKIE_VAULT_BODY_LIMIT = 16384, COOKIE_VAULT_BATCH_LIMIT = 524288
const PLATFORMS = ['miyoushe', 'hoyolab']
const MIN_ITERATIONS = 600000, MAX_CIPHERTEXT = 8192
const BASE64URL = /^[A-Za-z0-9_-]+$/
const LIST_FIELDS = `platform,account_uid AS "accountUid",updated_at AS "updatedAt"`

function keyFrom(platform, accountUid) {
    if (!PLATFORMS.includes(platform)) throw invalid('请选择米游社或 HoYoLAB')
    if (typeof accountUid !== 'string' || !/^\d{1,20}$/.test(accountUid)) throw invalid('游戏账号 UID 格式不正确')
    return { platform, accountUid }
}
function sealedFrom(input) {
    const { ciphertext, salt, kdf, version } = input || {}
    if (typeof ciphertext !== 'string' || !ciphertext || ciphertext.length > MAX_CIPHERTEXT || !BASE64URL.test(ciphertext)) throw invalid('Cookie 密文格式不正确')
    if (typeof salt !== 'string' || !BASE64URL.test(salt) || Buffer.from(salt, 'base64url').length < 16 || salt.length > 128) throw invalid('密钥派生的盐格式不正确')
    if (!kdf || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256' || !Number.isSafeInteger(kdf.iterations) || kdf.iterations < MIN_ITERATIONS)
        throw invalid(`密钥派生参数须为 PBKDF2-SHA256，迭代次数不少于 ${MIN_ITERATIONS}`)
    if (!Number.isSafeInteger(version) || version < 1) throw invalid('密文格式版本不正确')
    return { ciphertext, salt, kdf: { name: kdf.name, hash: kdf.hash, iterations: kdf.iterations }, version }
}
async function upsert(db, userId, key, sealed, now) {
    const { rows: [row] } = await db.query(`INSERT INTO cookie_vaults(user_id,platform,account_uid,ciphertext,salt,kdf,format_version,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT(user_id,platform,account_uid) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,
        salt=EXCLUDED.salt,kdf=EXCLUDED.kdf,format_version=EXCLUDED.format_version,updated_at=EXCLUDED.updated_at RETURNING ${LIST_FIELDS}`,
    [userId, key.platform, key.accountUid, sealed.ciphertext, sealed.salt, JSON.stringify(sealed.kdf), sealed.version, now])
    return row
}
export function createCookieVaults({ pool, clock = () => new Date() }) {
    async function list(userId) {
        return { vaults: (await pool.query(`SELECT ${LIST_FIELDS} FROM cookie_vaults WHERE user_id=$1 ORDER BY platform,account_uid`, [userId])).rows }
    }
    async function get(userId, platform, accountUid) {
        const key = keyFrom(platform, accountUid)
        const { rows: [row] } = await pool.query(`SELECT ${LIST_FIELDS},ciphertext,salt,kdf,format_version AS version FROM cookie_vaults
            WHERE user_id=$1 AND platform=$2 AND account_uid=$3`, [userId, key.platform, key.accountUid])
        if (!row) throw missing()
        return { vault: row }
    }
    async function save(userId, platform, accountUid, input) {
        const key = keyFrom(platform, accountUid), sealed = sealedFrom(input)
        return { vault: await upsert(pool, userId, key, sealed, clock()) }
    }
    async function remove(userId, platform, accountUid) {
        const key = keyFrom(platform, accountUid)
        const { rowCount } = await pool.query('DELETE FROM cookie_vaults WHERE user_id=$1 AND platform=$2 AND account_uid=$3', [userId, key.platform, key.accountUid])
        if (!rowCount) throw missing()
        return { ok: true }
    }
    // 修改解密密码：用新密钥重新加密后整体替换。提交的账号集合必须与云端现有的完全一致，否则拒绝，
    // 避免另一台设备刚上传的 Cookie 被旧列表覆盖或删掉；全部成功或全部不变。
    async function replaceAll(userId, input) {
        if (!Array.isArray(input?.vaults)) throw invalid('vaults 必须是数组')
        const entries = input.vaults.map(entry => ({ key: keyFrom(entry?.platform, entry?.accountUid), sealed: sealedFrom(entry) }))
        const submitted = entries.map(({ key }) => `${key.platform}/${key.accountUid}`)
        if (new Set(submitted).size !== submitted.length) throw invalid('同一个游戏账号只能提交一次')
        const now = clock()
        return transaction(pool, async db => {
            const { rows } = await db.query('SELECT platform,account_uid FROM cookie_vaults WHERE user_id=$1 FOR UPDATE', [userId])
            const stored = new Set(rows.map(row => `${row.platform}/${row.account_uid}`))
            if (stored.size !== submitted.length || submitted.some(item => !stored.has(item)))
                throw new ApiError(409, 'VAULT_SET_CHANGED', '云端的 Cookie 列表已变化，请刷新后重试')
            const vaults = []
            for (const { key, sealed } of entries) vaults.push(await upsert(db, userId, key, sealed, now))
            return { vaults }
        })
    }
    return { list, get, save, remove, replaceAll }
}
