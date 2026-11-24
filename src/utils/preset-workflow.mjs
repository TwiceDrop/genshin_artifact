import {artifactFingerprint, BREAKS, POSITIONS} from '../import/miyoushe.mjs'

const copy = value => JSON.parse(JSON.stringify(value))

export function presetSource(item) {
    return item.miyousheKey ? 'game' : 'custom'
}

export const gameRosterPresetLabel = uid => `游戏内-${uid}`

export function presetDisplayName(name, item) {
    const uid = item?.miyousheKey?.split(':')[0]
    return uid ? gameRosterPresetLabel(uid) : name
}

export function presetEquipmentChanges(saved, next) {
    const c = saved.character, w = saved.weapon
    const changedLevel = (a, b) => a.level !== b.level || (BREAKS.includes(b.level) && !!a.ascend !== !!b.ascend)
    const changes = []
    if (changedLevel(c, next.character)) changes.push('角色等级')
    if ((c.constellation ?? 0) !== (next.character.constellation ?? 0)) changes.push('命之座')
    if (['skill1', 'skill2', 'skill3'].some(key => c[key] !== next.character[key])) changes.push('天赋等级')
    if (POSITIONS.some((_, i) => (saved.artifactIds?.[i] ?? -1) !== (next.artifactIds?.[i] ?? -1))) changes.push('圣遗物')
    if (w.name !== next.weapon.name) changes.push('武器')
    if (changedLevel(w, next.weapon)) changes.push('武器等级')
    if (w.refine !== next.weapon.refine) changes.push('精炼等阶')
    return changes
}

export function customPresetNameError(presets, name) {
    if (!name.trim()) return '请输入预设名称。'
    if (Object.hasOwn(presets, name)) return '已有同名预设，请使用其他名称。'
    return ''
}

export function createCustomPreset(presets, name, item) {
    const error = customPresetNameError(presets, name)
    if (error) throw new Error(error)
    const result = copy(item)
    result.name = name
    delete result.miyousheKey
    return result
}

// Game refresh updates imported fields; local calculation assumptions belong to the preset.
export function refreshGamePreset(previous, incoming, artifactIds, key, name) {
    const result = copy({...incoming, ...previous, name, character: incoming.character,
        weapon: incoming.weapon, artifactIds, miyousheKey: key})
    if (previous?.character.name === result.character.name) {
        result.character.params = copy(previous.character.params)
        if (previous.character.resonated_elements) result.character.resonated_elements = copy(previous.character.resonated_elements)
    }
    if (previous?.weapon.name === result.weapon.name) result.weapon.params = copy(previous.weapon.params)
    return result
}

export function snapshotPreset(state) {
    const result = copy(state)
    if (result.buffs) result.buffs = result.buffs.map(({id, ...buff}) => buff)
    return result
}

export function readPresetConfiguration(item, defaults) {
    const result = snapshotPreset(item)
    for (const field of ['enemy', 'infusion', 'skill']) {
        if (result[field] === undefined) result[field] = copy(defaults[field])
    }
    // Older presets saved the preview and optimization controls separately.
    // The explicit optimizer settings were in use for custom and panel runs.
    const configs = result.artifactEffectMode === 'custom' || result.optimizationMode === 'panel'
        ? [result.singleConfig, result.artifactConfig]
        : [result.artifactConfig, result.singleConfig]
    result.singleConfig = copy(defaults.singleConfig)
    for (const config of configs) {
        for (const [set, fields] of Object.entries(config ?? {})) {
            result.singleConfig[set] = {...result.singleConfig[set], ...fields}
        }
    }
    return result
}

export function assertPresetArtifacts(ids, displayed, inventory) {
    if (ids.length !== 5 || ids.some(id => id < 0) || displayed.some(item => !item)) {
        throw new Error('当前配装不足五件，无法应用到预设。')
    }
    for (let i = 0; i < 5; i++) {
        const current = inventory.get(ids[i]), shown = displayed[i]
        if (!current || current.position !== POSITIONS[i] || shown.id !== ids[i]
            || artifactFingerprint(current) !== artifactFingerprint(shown)
            || JSON.stringify(current.unactivatedTags || []) !== JSON.stringify(shown.unactivatedTags || [])) {
            throw new Error('圣遗物已从仓库移除或发生变化，请重新选择后再应用。')
        }
    }
}

export function applyPresetArtifacts(item, ids, displayed, inventory) {
    assertPresetArtifacts(ids, displayed, inventory)
    return {...copy(item), artifactIds: [...ids]}
}

export function filterPresets(entries, {source, uid, character, search}, characterLabel) {
    const query = search.trim().toLocaleLowerCase()
    return entries.filter(({name, item, loadout}) => (loadout ? 'custom' : presetSource(item)) === source
        && (source !== 'game' || item.miyousheKey.split(':')[0] === uid)
        && (!character || item.character.name === character)
        && (!query || `${loadout ? name : presetDisplayName(name, item)} ${name} ${characterLabel(item.character.name)}`.toLocaleLowerCase().includes(query)))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}
