// 同步类别开关：服务端要求档案整份提交、字段齐全，所以关闭的类别在客户端合并，不改服务端。
// 档案字段见 online-service/src/profiles.mjs 的 DATA_KEYS；name 不属于任何类别，始终同步。
export const SYNC_CATEGORIES = Object.freeze([
    { key: 'cookie', fields: [] },
    { key: 'uid', fields: ['miyoushe'] },
    { key: 'history', fields: [] },
    { key: 'artifacts', fields: ['artifacts'] },
    { key: 'characters', fields: ['presets', 'kumi', 'comparisonSettings'] },
    { key: 'teams', fields: ['teamDpsConfigurations', 'teamDpsTasks'] },
])

const KEYS = SYNC_CATEGORIES.map(category => category.key)

export function defaultSyncSettings() {
    return Object.fromEntries(KEYS.map(key => [key, true]))
}

// 本机存储里读出的值：缺项按默认全开补齐，只有明确的 false 才算关闭。
export function normalizeSyncSettings(raw) {
    const settings = defaultSyncSettings()
    if (raw && typeof raw === 'object') for (const key of KEYS) if (raw[key] === false) settings[key] = false
    return settings
}

export function disabledFields(settings) {
    const normalized = normalizeSyncSettings(settings)
    return SYNC_CATEGORIES.filter(category => !normalized[category.key]).flatMap(category => category.fields)
}

export function hasDisabledProfileFields(settings) {
    return disabledFields(settings).length > 0
}

function clone(value) { return value === undefined ? null : JSON.parse(JSON.stringify(value)) }

// 上传：关闭的类别取云端最新版本的原值（云端还没有版本时为 null），其余取本机。
export function mergeForUpload(localData, remoteData, settings) {
    const merged = { ...localData }
    for (const field of disabledFields(settings)) merged[field] = remoteData ? clone(remoteData[field]) : null
    return merged
}

// 拉取：关闭的类别保留本机原值，其余取云端。
export function mergeForDownload(localData, remoteData, settings) {
    const merged = { ...remoteData }
    for (const field of disabledFields(settings)) merged[field] = clone(localData[field])
    return merged
}
