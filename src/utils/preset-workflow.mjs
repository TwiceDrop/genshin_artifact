import {artifactFingerprint, POSITIONS} from '../import/miyoushe.mjs'

const copy = value => JSON.parse(JSON.stringify(value))

export function presetSource(item) {
    return item.miyousheKey ? 'game' : 'custom'
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
    if (previous?.character.name === result.character.name) result.character.params = copy(previous.character.params)
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
    for (const field of ['enemy', 'infusion', 'skill', 'singleConfig']) {
        if (result[field] === undefined) result[field] = copy(defaults[field])
    }
    result.singleConfig = {...copy(defaults.singleConfig), ...result.singleConfig}
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
    return entries.filter(({name, item}) => presetSource(item) === source
        && (source !== 'game' || item.miyousheKey.split(':')[0] === uid)
        && (!character || item.character.name === character)
        && (!query || `${name} ${characterLabel(item.character.name)}`.toLocaleLowerCase().includes(query)))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}
