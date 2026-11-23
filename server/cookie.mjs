const fieldFamilies = [
    ['ltuid', 'account_id', 'ltuid_v2', 'account_id_v2'], ['mid', 'ltmid_v2', 'account_mid_v2'],
    ['ltoken', 'ltoken_v2'], ['cookie_token', 'cookie_token_v2'], ['mi18nLang'],
]
const allowed = new Set(fieldFamilies.flat())
const accountId = values => values.account_id_v2 || values.ltuid_v2 || values.account_id || values.ltuid

// The program sees field names only. The host resolves the selected aliases locally.
function projectCloudFields(values, program) {
    const names = Object.fromEntries(Object.keys(values).map(name => [name, name]))
    const selection = program.fields(names)
    if (!selection || typeof selection !== 'object') throw new Error('云端 Cookie 补丁返回的字段格式无效')
    const result = {}
    for (const [dest, source] of Object.entries(selection)) {
        if (source === null) continue
        if (typeof source !== 'string' || !Object.hasOwn(values, source) || !fieldFamilies.some(group => group.includes(dest) && group.includes(source)))
            throw new Error('云端 Cookie 补丁字段映射无效')
        result[dest] = values[source]
    }
    if (accountId(result) !== accountId(values)) throw new Error('云端 Cookie 补丁改变了账号 ID')
    return result
}

export function normalizeCookie(raw, { recordOnly = false, cloudProgram } = {}) {
    if (typeof raw !== 'string' || raw.length > 16000 || /[\r\n\x00]/.test(raw)) throw new Error('Cookie 格式无效，请粘贴完整的一行 Cookie')
    let values = {}
    for (const part of raw.trim().replace(/^Cookie:\s*/i, '').split(';')) {
        const index = part.indexOf('='), key = part.slice(0, index).trim(), value = part.slice(index + 1).trim()
        if (index > 0 && allowed.has(key) && value && value !== 'undefined') values[key] = value
    }
    if (cloudProgram) values = projectCloudFields(values, cloudProgram)
    const id = accountId(values)
    if (!/^\d+$/.test(id || '') || !(values.ltoken || values.ltoken_v2)) throw new Error('Cookie 不完整：需要账号 ID 和 ltoken（支持 v2）')
    if (!recordOnly && !(values.cookie_token || values.cookie_token_v2)) throw new Error('Cookie 不完整：需要账号 ID、cookie_token 和 ltoken（支持 v2）')
    if (values.cookie_token_v2 && !(values.account_mid_v2 || values.ltmid_v2)) throw new Error('v2 Cookie 缺少 account_mid_v2 或 ltmid_v2')
    return { id, cookie: Object.entries(values).map(([k, v]) => `${k}=${v}`).join(';') + ';' }
}

export function publicAccount(a) {
    return { id: a.id, platform: a.platform || 'miyoushe', accountUid: a.accountUid || a.id, roles: a.roles || [], createdAt: a.createdAt, updatedAt: a.updatedAt, lastUsedAt: a.lastUsedAt,
        status: a.status || 'saved', lastError: a.lastError || '', cookieVersion: /(?:^|;\s*)(?:cookie_token_v2|ltoken_v2)=/.test(a.cookie || '') ? 'v2' : 'v1' }
}

export function communityAccount(cookie, platform = 'miyoushe', cloudProgram) {
    const normalized = normalizeCookie(cookie, { recordOnly: platform === 'miyoushe', cloudProgram })
    return { ...normalized, accountUid: normalized.id, platform, id: platform === 'hoyolab' ? `hoyolab:${normalized.id}` : normalized.id }
}
