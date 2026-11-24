import {presetSource} from '../utils/preset-workflow.mjs'

// Imported entry IDs describe game equipment. Calculation presets can be edited
// independently, so they must not be used as ownership records.
export function otherCharacterArtifactIds(entries, uid, currentKey, inventory) {
    const reserved = new Set()
    if (!uid) return reserved
    for (const entry of entries) {
        if (String(entry.uid) !== String(uid) || (currentKey && entry.key === currentKey)) continue
        for (const id of entry.artifactIds || []) {
            if (Number.isSafeInteger(id) && id >= 0 && inventory.has(id)) reserved.add(id)
        }
    }
    return reserved
}

export function protectedPresetArtifactIds({entries, uid, currentKey, inventory, presets, character,
    enabled, gameAllowed, customAllowed, excludedPresets = []}) {
    const reserved = enabled && gameAllowed ? new Set()
        : otherCharacterArtifactIds(entries, uid, currentKey, inventory)
    if (!enabled || !customAllowed) {
        for (const {item} of presets) {
            if (presetSource(item) !== 'custom' || item.character.name === character) continue
            for (const id of item.artifactIds || []) {
                if (inventory.has(id)) reserved.add(id)
            }
        }
    }
    for (const id of excludedPresetArtifactIds(excludedPresets, inventory)) reserved.add(id)
    return reserved
}

export function excludedPresetArtifactIds(excludedPresets, inventory) {
    const reserved = new Set()
    for (const preset of excludedPresets) {
        for (const id of preset.ids) {
            if (inventory.has(id)) reserved.add(id)
        }
    }
    return reserved
}

export function updatePresetExclusion(data, roleKey, oldKey, newKey) {
    const selected = data.excludedArtifactPresets?.[roleKey]
    if (!selected?.includes(oldKey)) return
    const next = selected.filter(key => key !== oldKey)
    if (newKey) next.push(newKey)
    if (next.length) data.excludedArtifactPresets[roleKey] = next
    else delete data.excludedArtifactPresets[roleKey]
}

// A saved group's source is distinct from imported game equipment ownership.
// Older groups can identify a source only through a complete, exact preset match.
export function artifactGroupCharacterNames(group, presets, inventory) {
    if (group.sourceCharacter) return [group.sourceCharacter]
    const ids = group.artifactIds
    if (!ids || ids.length !== 5 || !ids.every(id => id !== null && id >= 0 && inventory.has(id))) return []
    return [...new Set(presets.filter(entry => entry.item.artifactIds?.length === 5
        && ids.every((id, index) => id === entry.item.artifactIds[index]))
        .map(entry => entry.item.character.name))]
}
