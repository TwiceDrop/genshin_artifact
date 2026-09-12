import { selectUidInventory } from './uid-inventory.mjs'
import { artifactFingerprint } from './miyoushe.mjs'
const clone = value => JSON.parse(JSON.stringify(value))
const slots = ['flower', 'feather', 'sand', 'cup', 'head']
const stats = new Set(['lifeStatic','lifePercentage','attackStatic','attackPercentage','defendStatic','defendPercentage','critical','criticalDamage','elementalMastery','recharge','cureEffect','fireBonus','waterBonus','thunderBonus','windBonus','iceBonus','rockBonus','dendroBonus','physicalBonus'])
const fail = text => { throw new Error(`UID 数据包：${text}`) }

export function exportUidPackage(uid, data, presets, inventory, includeInventory = true) {
    uid = String(uid)
    const entries = data.entries.filter(e => String(e.uid) === uid)
    if (!entries.length) fail('该 UID 尚无角色')
    const rows = entries.map(entry => ({ entry: clone(entry), preset: presets[entry.presetName]?.item ? clone(presets[entry.presetName].item) : null }))
    // A saved preset can still refer to equipment removed from the warehouse.
    // Keep its frozen in-game/history data, but do not export dangling live IDs.
    const existingIds = new Set([...inventory.values()].map(a => a.id))
    for (const row of rows) for (const owner of [row.entry, row.preset]) {
        if (owner?.artifactIds) owner.artifactIds = owner.artifactIds.map(id => existingIds.has(id) ? id : -1)
    }
    const history = (data.artifactComparison?.history || []).filter(row => row.key.startsWith(uid + ':'))
    const artifacts = selectUidInventory(uid, data, presets, inventory, includeInventory).map(clone)
    return { format: 'mona-uid', version: 1, uid, exportedAt: new Date().toISOString(),
        scope: 'uid-all-artifacts', includesUnassigned: includeInventory,
        snapshot: data.snapshots[uid] ? clone(data.snapshots[uid]) : null, characters: rows, artifacts, history: clone(history) }
}

export function validateUidPackage(pack, catalog) {
    if (pack?.format !== 'mona-uid' || pack.version !== 1 || !/^\d{8,10}$/.test(pack.uid)) fail('格式或版本不支持')
    if (!Array.isArray(pack.characters) || pack.characters.length > 300 || !Array.isArray(pack.artifacts) || pack.artifacts.length > 5000 || !Array.isArray(pack.history) || pack.history.length > 15000) fail('数据数量异常')
    const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max
    const artifact = a => {
        if (!a || !Object.hasOwn(catalog.artifacts, a.setName) || !slots.includes(a.position) || !integer(a.star, 1, 5) || !integer(a.level, 0, Math.min(20, a.star * 4)) || !Array.isArray(a.normalTags) || a.normalTags.length > 4) fail('圣遗物信息无效或未适配')
        for (const tag of [a.mainTag, ...a.normalTags]) if (!tag || !stats.has(tag.name) || !Number.isFinite(tag.value) || tag.value < 0) fail('圣遗物词条无效')
    }
    const artifactIds = new Set()
    for (const a of pack.artifacts) { artifact(a); if (!Number.isSafeInteger(a.id) || artifactIds.has(a.id)) fail('装备编号重复或无效'); artifactIds.add(a.id) }
    const keys = new Set()
    for (const { entry, preset } of pack.characters) {
        if (!entry || String(entry.uid) !== pack.uid || !entry.key?.startsWith(pack.uid + ':') || keys.has(entry.key)) fail('角色 UID 不匹配或重复')
        keys.add(entry.key)
        for (const a of entry.equippedArtifacts || []) artifact(a)
        if (!preset) continue
        const c = preset.character, w = preset.weapon, t = preset.targetFunction
        if (!c || !Object.hasOwn(catalog.characters, c.name) || !w || !Object.hasOwn(catalog.weapons, w.name) || catalog.characters[c.name].weapon !== catalog.weapons[w.name].type) fail('角色或武器未适配')
        if (!integer(c.level,1,100) || !integer(c.constellation,0,6) || ![c.skill1,c.skill2,c.skill3].every(n=>integer(n,0,14)) || !integer(w.level,1,90) || !integer(w.refine,1,5)) fail('角色养成数值无效')
        if (!t || !Object.hasOwn(catalog.targets,t.name)) fail('目标函数未适配')
        for (const ids of [entry.artifactIds, preset.artifactIds]) if (ids && (!Array.isArray(ids) || ids.length !== 5 || ids.some(id => id !== -1 && !artifactIds.has(id)))) fail('角色引用了缺失的装备')
    }
    for (const row of pack.history) {
        if (!keys.has(row.key) || !Array.isArray(row.items) || row.items.length !== 5) fail('对比历史归属无效')
        for (const a of row.items) if (a) artifact(a)
    }
    if (pack.snapshot && (String(pack.snapshot.role?.uid) !== pack.uid || pack.snapshot.source !== 'miyoushe' || pack.snapshot.version !== 1 || !Array.isArray(pack.snapshot.characters))) fail('原始快照 UID 不匹配')
    // Reject dangerous object keys even inside nested calculation parameters.
    const inspect = (value, depth = 0) => {
        if (depth > 40) fail('嵌套层数过多')
        if (value && typeof value === 'object') for (const key of Object.keys(value)) {
            if (['__proto__','prototype','constructor','cookie','stoken','ltoken','cookie_token'].includes(key)) fail('包含不应传输的字段')
            inspect(value[key], depth + 1)
        }
    }
    inspect(pack)
    return pack
}

export function importUidPackage(pack, { data, presets, inventory, addArtifact, addPreset, catalog }) {
    validateUidPackage(pack, catalog)
    const pool = new Map(), used = new Set(), mapping = new Map()
    for (const a of selectUidInventory(pack.uid, data, presets, inventory, true)) { const fp = artifactFingerprint(a); if (!pool.has(fp)) pool.set(fp, []); pool.get(fp).push(a.id) }
    let added = 0
    for (const a of pack.artifacts) {
        const id = pool.get(artifactFingerprint(a))?.find(id => !used.has(id))
        const mapped = id === undefined ? addArtifact(clone(a)) : id
        if (id === undefined) added++
        mapping.set(a.id, mapped); used.add(mapped)
    }
    const mapIds = ids => (ids || [-1,-1,-1,-1,-1]).map(id => id === -1 ? -1 : mapping.get(id) ?? -1)
    const imported = pack.characters.map(({ entry, preset }) => {
        const row = { ...clone(entry), uid: pack.uid, artifactIds: mapIds(entry.artifactIds) }
        if (preset) {
            const existing = Object.values(presets).find(p => p.item.miyousheKey === entry.key)
            let name = existing?.name || `米游社 ${pack.uid} · ${entry.label}`
            for (let n = 2; !existing && presets[name]; n++) name = `米游社 ${pack.uid} · ${entry.label} (${n})`
            addPreset(name, { ...clone(preset), name, miyousheKey: entry.key, artifactIds: mapIds(preset.artifactIds || entry.artifactIds) })
            row.presetName = name
        }
        return row
    })
    const importedKeys = new Set(imported.map(e => e.key))
    const oldHistory = data.artifactComparison?.history || []
    const history = [...oldHistory]
    for (const raw of pack.history) {
        if (history.some(h => h.id === raw.id && h.key === raw.key)) continue
        history.push({ ...clone(raw), items: raw.items.map(a => a ? { ...clone(a), id: mapping.get(a.id) ?? -1 } : null) })
    }
    return { added, imported: imported.length, data: { ...data, selectedUid: pack.uid,
        uidArtifactIds: { ...data.uidArtifactIds, [pack.uid]: [...new Set([...(data.uidArtifactIds?.[pack.uid] || []), ...mapping.values()])] },
        snapshots: { ...data.snapshots, ...(pack.snapshot ? { [pack.uid]: clone(pack.snapshot) } : {}) },
        entries: [...data.entries.filter(e => !importedKeys.has(e.key)), ...imported],
        artifactComparison: { ...data.artifactComparison, history } } }
}
