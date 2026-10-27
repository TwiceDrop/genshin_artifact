export function normalizeCookie(raw) {
    if (typeof raw !== 'string' || raw.length > 16000 || /[\r\n\x00]/.test(raw)) throw new Error('Cookie 格式无效，请粘贴完整的一行 Cookie')
    const allowed = new Set(['ltoken', 'ltuid', 'cookie_token', 'account_id', 'ltoken_v2', 'ltuid_v2', 'cookie_token_v2', 'account_id_v2', 'ltmid_v2', 'account_mid_v2', 'mid', 'mi18nLang'])
    const values = {}
    for (const part of raw.trim().replace(/^Cookie:\s*/i, '').split(';')) {
        const index = part.indexOf('='), key = part.slice(0, index).trim(), value = part.slice(index + 1).trim()
        if (index > 0 && allowed.has(key) && value && value !== 'undefined') values[key] = value
    }
    const id = values.account_id_v2 || values.ltuid_v2 || values.account_id || values.ltuid
    if (!/^\d+$/.test(id || '') || !(values.cookie_token || values.cookie_token_v2) || !(values.ltoken || values.ltoken_v2)) throw new Error('Cookie 不完整：需要账号 ID、cookie_token 和 ltoken（支持 v2）')
    if (values.cookie_token_v2 && !(values.account_mid_v2 || values.ltmid_v2)) throw new Error('v2 Cookie 缺少 account_mid_v2 或 ltmid_v2')
    return { id, cookie: Object.entries(values).map(([k, v]) => `${k}=${v}`).join(';') + ';' }
}

export function publicAccount(a) {
    return { id: a.id, roles: a.roles || [], createdAt: a.createdAt, updatedAt: a.updatedAt, lastUsedAt: a.lastUsedAt,
        status: a.status || 'saved', lastError: a.lastError || '', cookieVersion: a.cookie?.includes('cookie_token_v2=') ? 'v2' : 'v1' }
}
