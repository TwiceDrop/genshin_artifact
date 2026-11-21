import { profileDomains } from './profile-domains.mjs'
import { historyKey } from '../algorithms/calculation-history.mjs'

const format = 'mona-account-backup'
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const id = value => Number.isSafeInteger(value) && value > 0
const slots = ['flower', 'feather', 'sand', 'cup', 'head']
const accountKey = (type, n) => `mona_account_${type}_${n}`
const stored = raw => typeof raw === 'string' ? JSON.parse(raw) : raw
const secretFields = /^(?:__proto__|prototype|constructor|cookie|cookies|stoken|ltoken|cookie_token|authorization|sessionToken|accessToken|refreshToken|password|secretKey|serviceUrl|cloudUrl)$/i

function checkPlayerFields(node) {
    if (!node || typeof node !== 'object') return
    for (const key of Object.keys(node)) {
        if (secretFields.test(key)) throw new Error('数据中含有凭据或不支持的字段：' + key)
        checkPlayerFields(node[key])
    }
}

export function validateBackup(pack) {
    if (pack?.format !== format || pack.version !== 1 || !/^[a-f0-9]{32}$/.test(pack.backupId || ''))
        throw new Error('备份格式或版本不受支持')
    if (!Array.isArray(pack.accounts) || !pack.accounts.length) throw new Error('备份缺少账号')
    const ids = new Set()
    for (const account of pack.accounts) {
        if (!id(account?.id) || ids.has(account.id) || typeof account.name !== 'string') throw new Error('备份账号标识或名称无效')
        ids.add(account.id)
        const { data, history } = account
        const invalid = field => { throw new Error(`账号「${account.name}」的 ${field} 数据无效`) }
        if (!object(data)) invalid('档案')
        for (const [field] of profileDomains) {
            const value = data[field]
            if (value !== null && !object(value) && !(field === 'kumi' && Array.isArray(value))) invalid(field)
        }
        if (data.artifacts && slots.some(slot => data.artifacts[slot] !== undefined && !Array.isArray(data.artifacts[slot]))) invalid('圣遗物')
        if (data.presets && Object.values(data.presets).some(p => !object(p) || !object(p.item))) invalid('角色预设')
        if (data.miyoushe?.entries !== undefined && !Array.isArray(data.miyoushe.entries)) invalid('UID 角色')
        if (data.teamDpsConfigurations && !Array.isArray(data.teamDpsConfigurations.entries)) invalid('轴库')
        if (!id(history?.nextId) || !Array.isArray(history.records)) invalid('历史索引')
        const rows = new Set()
        for (const record of history.records) {
            const row = record?.row
            if (!id(row?.id) || row.id >= history.nextId || rows.has(row.id) || !object(record.detail)) invalid('历史详情 ' + (row?.id ?? ''))
            rows.add(row.id)
        }
        checkPlayerFields(data)
        checkPlayerFields(history)
    }
    if (!ids.has(pack.currentAccountId)) throw new Error('备份缺少当前账号')
    return pack
}

// All reads issued by a caller belong to the same IndexedDB transaction.
export async function captureBackup(get, appVersion, preferences) {
    const registry = stored(await get('mona_accounts'))
    if (!registry) throw new Error('本地账号列表尚未就绪')
    const accounts = await Promise.all(registry.allAccounts.map(async ({ id, name }) => {
        const fields = await Promise.all(profileDomains.map(async ([field, type]) =>
            [field, stored(await get(accountKey(type, id))) ?? null]))
        const key = historyKey(id)
        const index = stored(await get(key)) ?? { nextId: 1, entries: [] }
        const records = await Promise.all(index.entries.map(async row => {
            const detail = stored(await get(key + '_' + row.id))
            if (detail == null) throw new Error(`账号「${name}」的历史记录 ${row.id} 缺少详情`)
            // A persisted running row after a previous crash has the same semantics as history.load().
            return { row: row.status === 'running' ? { ...row, status: 'interrupted' } : row, detail }
        }))
        return { id, name, data: Object.fromEntries(fields), history: { nextId: index.nextId, records } }
    }))
    const backupId = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')
    return validateBackup({ format, version: 1, backupId, appVersion, exportedAt: new Date().toISOString(),
        currentAccountId: registry.currentAccountId, accounts, preferences })
}

export function backupCounts({ data, history }) {
    const uids = new Set(Object.keys(data.miyoushe?.snapshots || {}))
    for (const entry of data.miyoushe?.entries || []) uids.add(String(entry.uid))
    return { uids: uids.size, artifacts: slots.reduce((sum, slot) => sum + (data.artifacts?.[slot]?.length || 0), 0),
        axes: data.teamDpsConfigurations?.entries.length || 0, history: history.records.length }
}

export function appendBackup(pack, registry, keys) {
    const receipt = 'mona_imported_backup_' + pack.backupId
    if (keys.includes(receipt)) throw new Error('这份备份已导入')
    let lastId = 0
    for (const account of registry.allAccounts) lastId = Math.max(lastId, account.id)
    // Deleted accounts can leave axes or history behind. Never reuse those namespaces.
    for (const key of keys) {
        const match = /^mona_account_[a-z_]+_(\d+)(?:_\d+)?$/.exec(key)
        if (match) lastId = Math.max(lastId, Number(match[1]))
    }
    const allAccounts = [...registry.allAccounts], entries = [], imported = []
    for (const account of pack.accounts) {
        const target = ++lastId
        if (!id(target)) throw new Error('无法分配新的本地账号编号')
        allAccounts.push({ id: target, name: account.name })
        imported.push(target)
        for (const [field, type] of profileDomains) entries.push([accountKey(type, target), account.data[field]])
        const key = historyKey(target), rows = []
        for (const { row, detail } of account.history.records) {
            rows.push({ ...row, accountId: target })
            entries.push([key + '_' + row.id, detail])
        }
        entries.push([key, { nextId: account.history.nextId, entries: rows }])
    }
    entries.push(['mona_accounts', { ...registry, allAccounts }], [receipt, imported])
    return entries
}
