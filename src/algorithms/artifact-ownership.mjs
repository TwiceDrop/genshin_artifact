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
