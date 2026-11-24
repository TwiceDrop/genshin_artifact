import { computed, markRaw, ref, toRaw } from 'vue'
import { useArtifactStore } from './artifact'
import { usePresetStore } from './preset'
import { selectUidInventory } from '@/import/uid-inventory.mjs'
import { captureImportState, appendImportRecord } from '@/import/import-history.mjs'
import { mergeEquipped } from '@/import/miyoushe.mjs'
import { canonicalGameElement } from '@/import/character-summary.mjs'
import { accountGameUid } from '@/import/uid-import-review.mjs'
import { refreshGamePreset } from '@/utils/preset-workflow.mjs'

const data = ref<any>({ snapshots: {}, entries: [] })
const comparisonSettings = ref({ enabled: true, mode: 'session' })
const archivedCopies = new WeakMap<object, any>()
function init(value: any, settings: any) {
    // Backend reads already return detached, plain archive records.
    if (value?.importRecords) archivedCopies.set(value.importRecords, value.importRecords)
    for (const snapshot of Object.values<any>(value?.snapshots || {})) {
        if (snapshot.characters) archivedCopies.set(snapshot.characters, snapshot.characters)
    }
    data.value = { snapshots: {}, entries: [], ...value }
    data.value.entries = data.value.entries.map((entry: any) => ({ ...entry, uid: String(entry.uid) }))
    const bound = accountGameUid(data.value)
    if (bound) data.value.boundUid = bound
    comparisonSettings.value = settings || { enabled: data.value.artifactComparison?.enabled !== false, mode: data.value.artifactComparison?.mode || 'session' }
}
const uidGroups = computed(() => {
    const groups = new Map<string, any>()
    for (const [uid, snapshot] of Object.entries<any>(data.value.snapshots)) {
        groups.set(uid, { uid, nickname: snapshot.role?.nickname || '原神账号', regionName: snapshot.role?.regionName || '', count: 0 })
    }
    for (const entry of data.value.entries) {
        const uid = String(entry.uid)
        if (!groups.has(uid)) groups.set(uid, { uid, nickname: '原神账号', regionName: '', count: 0 })
        groups.get(uid).count++
    }
    return [...groups.values()]
})
const selectedUid = computed({
    get: () => uidGroups.value.some(g => g.uid === data.value.selectedUid) ? data.value.selectedUid : uidGroups.value[0]?.uid || data.value.boundUid || '',
    set: (uid: string) => { if (uidGroups.value.some(g => g.uid === String(uid))) data.value.selectedUid = String(uid) },
})
function importSnapshot(snapshot: any, converter: any, source = '米游社同步', preserveEquipped = false, draft?: any) {
    const roster = draft?.roster || useMiyousheStore(), data = roster.data
    const store: ReturnType<typeof useArtifactStore> = draft?.inventory || useArtifactStore()
    const presets: ReturnType<typeof usePresetStore> = draft?.presets || usePresetStore()
    if (snapshot?.version !== 1 || !['miyoushe', 'hoyolab', 'enka', 'good', 'screenshot'].includes(snapshot?.source) || !/^\d{8,10}$/.test(snapshot.role?.uid) || !Array.isArray(snapshot.characters) || snapshot.characters.length > 300) throw new Error('不是支持的米游社角色快照')
    const uid = String(snapshot.role.uid), converted: any[] = [], rejected: any[] = [], keys = new Set()
    const partial = ['enka', 'good', 'screenshot'].includes(snapshot.source)
    const archived: any[] = []
    {
        const byCharacter = new Map(data.value.entries.filter((row: any) => row.uid === uid)
            .map((row: any) => [(row.id ?? row.key.split(':')[1]) + ':' + canonicalGameElement(row.element || row.key.split(':')[2]), row.key.split(':')[2]]))
        snapshot = { ...snapshot, characters: snapshot.characters.map((raw: any) => {
            const element = byCharacter.get(raw.base?.id + ':' + canonicalGameElement(raw.base?.element))
            return element === undefined ? raw : { ...raw, base: { ...raw.base, element } }
        }) }
    }
    for (const raw of snapshot.characters) {
        const key = `${uid}:${raw.base?.id}:${raw.base?.element || ''}`
        if (keys.has(key)) throw new Error('快照含重复角色')
        keys.add(key)
        if (snapshot.source === 'good' && !raw.weapon && !data.value.entries.some((e: any) => e.key === key && e.presetName && presets.getPreset(e.presetName))) {
            const previous = preserveEquipped && data.value.entries.find((entry: any) => entry.key === key)
            archived.push({ key, uid, id: raw.base.id, label: raw.base.name, element: canonicalGameElement(raw.base.element),
                ...(previous?.artifactIds && { artifactIds: previous.artifactIds, equippedArtifacts: previous.equippedArtifacts }),
                level: raw.base.level, constellation: raw.base.actived_constellation_num, error: '角色养成已保存，补充装备武器后可用于计算' })
            continue
        }
        try { converted.push(converter.character(raw, uid, snapshot.source)) }
        catch (e: any) {
            if (snapshot.source === 'screenshot') throw e
            const previous = data.value.entries.find((entry: any) => entry.key === key)
            rejected.push(previous?.presetName && presets.getPreset(previous.presetName)
                ? { ...previous, error: undefined, warning: `本次同步失败，使用已保存数据：${e.message}` }
                : { key, uid, label: raw.base?.name || String(raw.base?.id), error: e.message })
        }
    }
    const before = !draft && captureImportState(data.value, presets.presets.value, store.artifacts.value)
    const previous = Object.fromEntries(data.value.entries.map((e: any) => [e.key, e.artifactIds]))
    let inventory = selectUidInventory(uid, data.value, presets.presets.value, store.artifacts.value, true)
    const updatesGear = converted.filter(e => !(preserveEquipped && previous[e.key]))
    if (partial) {
        // An identical piece can still be equipped on a character outside the public showcase.
        const refreshed = new Set(updatesGear.map(row => row.key))
        const reserved = new Set(data.value.entries.filter((row: any) => row.uid === uid && !refreshed.has(row.key))
            .flatMap((row: any) => row.artifactIds || []))
        inventory = inventory.filter((piece: any) => !reserved.has(piece.id))
    }
    const result: any = mergeEquipped(updatesGear, inventory, (a: any) => store.addArtifact(a), previous)
    const entries = converted.map(e => {
        const existing = Object.values(presets.presets.value).find((p: any) => p.item.miyousheKey === e.key)
        let name = existing?.name || e.preset.name
        if (!existing) {
            let n = 2
            while (presets.presets.value[name]) name = `${e.preset.name} (${n++})`
        }
        const artifactIds = result.equipment[e.key] || existing?.item.artifactIds || previous[e.key]
        const item = refreshGamePreset(existing?.item, e.preset, artifactIds, e.key, name)
        const manual = data.value.entries.find((row: any) => row.key === e.key && row.manual)
        if (manual) roster.linkCharacterPreset(e.key, manual.presetName)
        presets.addOrOverwrite(name, item)
        return { key: e.key, uid, id: e.id, gender: e.gender, element: e.element, label: e.label, presetName: name, artifactIds, equippedArtifacts: JSON.parse(JSON.stringify(e.gear)), level: e.preset.character.level, constellation: e.preset.character.constellation, updatedAt: snapshot.importedAt }
    })
    const missing = data.value.entries.filter((e: any) => e.uid === uid && !keys.has(e.key)).map((e: any) => partial || e.manual ? e : { ...e, warning: '本次同步未返回该角色，使用已保存数据' })
    let savedSnapshot = snapshot
    if (partial && data.value.snapshots[uid]) {
        const previous = data.value.snapshots[uid]
        const retained = previous.characters.filter((c: any) => !keys.has(`${uid}:${c.base?.id}:${c.base?.element || ''}`))
        const characters = [...snapshot.characters, ...retained]
        savedSnapshot = { ...snapshot, role: { ...previous.role, ...snapshot.role }, characters, total: characters.length }
    }
    data.value = { ...data.value, selectedUid: uid, snapshots: { ...data.value.snapshots, [uid]: savedSnapshot }, entries: [...data.value.entries.filter((e: any) => e.uid !== uid), ...entries, ...archived, ...rejected, ...missing] }
    data.value.uidArtifactIds = { ...data.value.uidArtifactIds, [uid]: [...new Set([...(data.value.uidArtifactIds?.[uid] || []), ...entries.flatMap(e => e.artifactIds)])] }
    if (before) data.value = appendImportRecord(data.value, before, presets.presets.value, store.artifacts.value, { source, uids: [uid] })
    return { ...result, imported: entries.length + archived.length, rejected: rejected.length, warnings: [...(snapshot.failures || []), ...archived.map(e => e.label + '：' + e.error), ...rejected.map(e => `${e.label}：${e.error || e.warning}`)] }
}
function linkCharacterPreset(key: string, name: string) {
    const byRole = data.value.rosterCharacterPresets ??= {}
    const group = byRole[key] ??= { names: [], active: null }
    if (!group.names.includes(name)) group.names.push(name)
    return group
}
export const useMiyousheStore = () => ({ data, comparisonSettings, init, importSnapshot, uidGroups, selectedUid, linkCharacterPreset })
export const watchContent = () => {
    const value = data.value
    // Imports and undo replace the history array. Its archived snapshots never change in place.
    if (value.importRecords) markRaw(toRaw(value.importRecords))
    for (const snapshot of Object.values<any>(value.snapshots)) {
        if (snapshot.characters) markRaw(toRaw(snapshot.characters))
    }
    return value
}
// Archive payloads are replaced on import/undo. Reuse their plain copies across local edits.
function archiveCopy(records: any[]) {
    const raw = toRaw(records)
    if (!archivedCopies.has(raw)) archivedCopies.set(raw, JSON.parse(JSON.stringify(raw)))
    return archivedCopies.get(raw)
}
export function captureRosterForStorage(value: any) {
    const { importRecords, snapshots, ...live } = toRaw(value)
    const copy = JSON.parse(JSON.stringify(live))
    copy.snapshots = Object.fromEntries(Object.entries<any>(snapshots).map(([uid, snapshot]) => {
        const { characters, ...header } = toRaw(snapshot)
        const saved = JSON.parse(JSON.stringify(header))
        if (characters) saved.characters = archiveCopy(characters)
        return [uid, saved]
    }))
    if (importRecords) copy.importRecords = archiveCopy(importRecords)
    return copy
}
export const watchComparisonSettings = () => comparisonSettings.value
