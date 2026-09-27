const clone = value => value === undefined ? null : JSON.parse(JSON.stringify(value))
const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const keyed = (items, key) => Object.fromEntries((items || []).map(item => [key(item), item]))
const historyKey = row => `${row.key}/${row.id}`

// Capture before the synchronous mutation. Only changed records are persisted.
export function captureImportState(data, presets, inventory) {
    return clone({ entries: keyed(data.entries, e => e.key), snapshots: data.snapshots || {},
        ownership: data.uidArtifactIds || {}, history: keyed(data.artifactComparison?.history, historyKey),
        presets, artifacts: Object.fromEntries(inventory), selectedUid: data.selectedUid || '' })
}
export function appendImportRecord(data, before, presets, inventory, { source, uids }) {
    const after = captureImportState(data, presets, inventory), changes = {}
    for (const domain of ['entries', 'snapshots', 'ownership', 'history', 'presets', 'artifacts']) {
        changes[domain] = []
        for (const key of new Set([...Object.keys(before[domain]), ...Object.keys(after[domain])])) {
            if (!equal(before[domain][key], after[domain][key])) changes[domain].push({ key, before: clone(before[domain][key]), after: clone(after[domain][key]) })
        }
    }
    const record = { id: crypto.randomUUID(), time: new Date().toISOString(), source, uids: [...new Set(uids.map(String))],
        status: 'active', characters: changes.entries.length, added: changes.artifacts.filter(c => !c.before).length,
        changes, selectedBefore: before.selectedUid, selectedAfter: after.selectedUid }
    return { ...data, importRecords: [record, ...(data.importRecords || [])] }
}

// Compare-and-restore: later user edits are never overwritten by an import undo.
export function undoImportRecord(id, { data, presets, inventory, addPreset, deletePreset, removeArtifact, extraArtifactIds = [] }) {
    const records = data.importRecords || [], index = records.findIndex(r => r.id === id), record = records[index]
    if (!record || record.status !== 'active') throw new Error('该导入记录已撤销或不存在')
    if (records.slice(0, index).some(r => r.status === 'active' && r.uids.some(uid => record.uids.includes(uid)))) {
        throw new Error('此 UID 之后还有导入记录，请先撤销该 UID 较新的导入，再撤销这一条')
    }
    const state = captureImportState(data, presets, inventory)
    let retained = 0
    for (const domain of ['entries', 'snapshots', 'ownership', 'history', 'presets']) {
        for (const change of record.changes[domain]) {
            if (!equal(state[domain][change.key], change.after)) { retained++; continue }
            if (change.before === null) delete state[domain][change.key]
            else state[domain][change.key] = clone(change.before)
        }
    }
    const referenced = new Set(extraArtifactIds)
    for (const row of Object.values(state.entries)) for (const id of row.artifactIds || []) referenced.add(id)
    for (const row of Object.values(state.presets)) for (const id of row.item?.artifactIds || []) referenced.add(id)
    for (const ids of Object.values(state.ownership)) for (const id of ids) referenced.add(id)
    for (const row of Object.values(state.history)) for (const a of row.items || []) if (a) referenced.add(a.id)
    const deletions = []
    for (const change of record.changes.artifacts) {
        // Imports only append artifacts; duplicates always reuse an existing item.
        if (change.before !== null) { retained++; continue }
        const key = Number(change.key)
        if (!inventory.has(key)) continue
        if (referenced.has(key) || !equal(inventory.get(key), change.after)) { retained++; continue }
        deletions.push(key)
    }
    for (const change of record.changes.presets) {
        if (equal(presets[change.key], state.presets[change.key])) continue
        const value = state.presets[change.key]
        if (value) addPreset(change.key, clone(value.item)); else deletePreset(change.key)
    }
    for (const id of deletions) removeArtifact(id)
    return { removed: deletions.length, retained, data: { ...data,
        entries: Object.values(state.entries), snapshots: state.snapshots, uidArtifactIds: state.ownership,
        artifactComparison: { ...data.artifactComparison, history: Object.values(state.history) },
        selectedUid: data.selectedUid === record.selectedAfter ? record.selectedBefore : data.selectedUid,
        importRecords: records.map(r => r.id === id ? { ...r, status: 'undone', undoneAt: new Date().toISOString(), retained } : r) } }
}
