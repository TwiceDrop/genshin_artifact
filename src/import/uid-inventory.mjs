// Ownership includes unequipped artifacts retained from earlier UID imports.
export function uidInventoryIds(data, presets = {}) {
    const groups = new Map()
    const add = (uid, ids) => {
        if (!uid) return
        uid = String(uid)
        if (!groups.has(uid)) groups.set(uid, new Set())
        for (const id of ids || []) if (Number.isSafeInteger(id) && id >= 0) groups.get(uid).add(id)
    }
    for (const [uid, ids] of Object.entries(data.uidArtifactIds || {})) add(uid, ids)
    for (const row of data.entries || []) {
        add(row.uid, row.artifactIds)
        add(row.uid, presets[row.presetName]?.item?.artifactIds)
    }
    for (const row of data.artifactComparison?.history || []) if (/^\d{8,10}:/.test(row.key)) add(row.key.split(':')[0], row.items.map(a => a?.id))
    return groups
}
export function selectUidInventory(uid, data, presets, inventory, includeUnassigned = true) {
    const groups = uidInventoryIds(data, presets), own = groups.get(String(uid)) || new Set()
    const known = new Set([...groups.values()].flatMap(ids => [...ids]))
    return [...inventory.values()].filter(a => own.has(a.id) || (includeUnassigned && !known.has(a.id)))
}
