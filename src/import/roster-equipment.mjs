import { mergeEquipped, POSITIONS } from './miyoushe.mjs'
import { selectUidInventory } from './uid-inventory.mjs'
import { changeConstellation, withBaseTalentLevels } from './constellation-talents.mjs'

export function withRosterCalculationSettings(preset, settings) {
    return { ...preset, ...settings.conditions, character: { ...preset.character, ...settings.character },
        weapon: preset.weapon.name === settings.weapon.name ? { ...preset.weapon, params: settings.weapon.params } : preset.weapon }
}

export function presetForRosterLoadout(preset, loadout) {
    const leveled = loadout.characterLevel ? { ...preset.character, ...loadout.characterLevel } : preset.character
    const character = loadout.constellation == null ? leveled : changeConstellation(leveled, loadout.constellation)
    const result = { ...preset, artifactIds: [...loadout.ids], weapon: loadout.weapon ?? preset.weapon,
        character: loadout.baseTalentLevels ? withBaseTalentLevels(character, loadout.baseTalentLevels) : character }
    return loadout.calculationSettings ? withRosterCalculationSettings(result, loadout.calculationSettings) : result
}

export function wornArtifactIds(row, presets) {
    return presets[row.presetName]?.item.artifactIds ?? row.artifactIds ?? []
}

export function rosterArtifactOwners(rows, presets, uid, position) {
    const index = POSITIONS.indexOf(position), owners = new Map()
    for (const row of rows) {
        if (row.uid !== uid) continue
        const id = wornArtifactIds(row, presets)[index]
        if (!(id >= 0)) continue
        if (!owners.has(id)) owners.set(id, [])
        owners.get(id).push(row)
    }
    return owners
}

// Update one slot in both the warehouse links and their portable equipment copies.
function replaceRosterSlot(previous, position, item, equipped) {
    const artifactIds = POSITIONS.map((slot, i) => slot === position ? item?.id ?? -1 : previous[i] ?? -1)
    const pieces = equipped.filter(piece => piece && piece.position !== position)
    if (item) pieces.push(item)
    const equippedArtifacts = pieces.map(({ position, setName, star, level, mainTag, normalTags }) =>
        ({ position, setName, star, level, mainTag: { ...mainTag }, normalTags: normalTags.map(tag => ({ ...tag })) }))
    return { artifactIds, equippedArtifacts }
}

export function equipRosterArtifact(data, presets, target, position, item, equipped, startingIds = wornArtifactIds(target, presets.presets.value)) {
    const uid = target.uid, index = POSITIONS.indexOf(position)
    const previous = startingIds[index]
    const ownedIds = new Set(data.uidArtifactIds?.[uid])
    if (previous >= 0) ownedIds.add(previous)
    const changes = []
    if (item) {
        ownedIds.add(item.id)
        const owners = rosterArtifactOwners(data.entries, presets.presets.value, uid, position)
        for (const row of owners.get(item.id) || []) {
            if (row.key !== target.key) changes.push([row, replaceRosterSlot(wornArtifactIds(row, presets.presets.value), position, null, row.equippedArtifacts || [])])
        }
    }
    changes.push([target, replaceRosterSlot(startingIds, position, item, equipped)])
    for (const [row, change] of changes) {
        const preset = presets.getPreset(row.presetName)?.item
        if (preset) presets.addOrOverwrite(row.presetName, { ...preset, artifactIds: change.artifactIds })
        Object.assign(row, change)
    }
    data.uidArtifactIds = { ...data.uidArtifactIds, [uid]: [...ownedIds] }
}

// Older snapshots can carry the piece itself even when its warehouse ID is missing.
export function retainRosterGear(data, presets, inventory, row, pieces) {
    const ids = wornArtifactIds(row, presets)
    const slots = POSITIONS.map((position, i) => inventory.artifacts.value.get(ids[i])?.position === position ? ids[i] : -1)
    const missing = pieces.filter(piece => piece && slots[POSITIONS.indexOf(piece.position)] === -1)
    if (missing.length) {
        const worn = new Set(data.entries.flatMap(entry => wornArtifactIds(entry, presets)))
        const pool = selectUidInventory(row.uid, data, presets, inventory.artifacts.value).filter(piece => !worn.has(piece.id))
        const merged = mergeEquipped([{ key: row.key, gear: missing }], pool, piece => inventory.addArtifact(piece))
        for (const piece of missing) {
            const index = POSITIONS.indexOf(piece.position)
            slots[index] = merged.equipment[row.key][index]
        }
    }
    data.uidArtifactIds = { ...data.uidArtifactIds, [row.uid]: [...new Set([...(data.uidArtifactIds?.[row.uid] || []), ...slots.filter(id => id >= 0)])] }
    return slots
}

export function editRosterArtifact(data, presets, inventory, row, position, item, equipped) {
    const before = retainRosterGear(data, presets.presets.value, inventory, row, equipped)
    equipRosterArtifact(data, presets, row, position, item, equipped, before)
    const ids = [...wornArtifactIds(row, presets.presets.value)]
    if (before.every((id, i) => id === ids[i])) return
    data.rosterLoadouts ??= {}
    const state = data.rosterLoadouts[row.key] ??= { configs: [] }
    // Remember the starting equipment across a sequence of slot changes.
    const previousDraft = state.draft?.every((id, i) => id === before[i])
    const previousConfig = state.configs.find(c => c.name === state.active && c.ids.every((id, i) => id === before[i]))
    if (!previousDraft && !previousConfig) state.original = before
    const saved = state.configs.find(c => c.ids.every((id, i) => id === ids[i]))
    const isOriginal = state.original.every((id, i) => id === ids[i])
    state.draft = saved || isOriginal ? null : ids
    state.active = !isOriginal && saved ? saved.name : null
}

export function removeRosterCharacters(data, presets, inventory, uid, keys) {
    const removed = data.entries.filter(row => row.uid === uid && keys.includes(row.key))
    const removedKeys = new Set(removed.map(row => row.key))
    const groups = data.rosterCharacterPresets || {}
    const retainedNames = new Set(Object.entries(groups)
        .filter(([key]) => !removedKeys.has(key)).flatMap(([, group]) => group.names))
    for (const row of data.entries) if (!removedKeys.has(row.key)) retainedNames.add(row.presetName)
    for (const row of removed) {
        retainRosterGear(data, presets.presets.value, inventory, row, row.equippedArtifacts || [])
        if (!retainedNames.has(row.presetName) && (row.manual || presets.getPreset(row.presetName)?.item.miyousheKey === row.key)) presets.deletePreset(row.presetName)
        if (data.rosterLoadouts) delete data.rosterLoadouts[row.key]
        if (data.excludedArtifactPresets) delete data.excludedArtifactPresets[row.key]
        for (const name of groups[row.key]?.names || []) {
            if (!retainedNames.has(name) && !presets.getPreset(name)?.item.miyousheKey) presets.deletePreset(name)
        }
        delete groups[row.key]
    }
    data.entries = data.entries.filter(row => !removedKeys.has(row.key))
    const snapshot = data.snapshots[uid]
    if (snapshot) {
        snapshot.characters = snapshot.characters.filter(raw => !removedKeys.has(uid + ':' + raw.base.id + ':' + (raw.base.element || '')))
        snapshot.total = snapshot.characters.length
    }
    if (data.artifactComparison?.history) {
        data.artifactComparison.history = data.artifactComparison.history.filter(item => !removedKeys.has(item.key))
    }
}
