import { computed, ref } from 'vue'
import { useArtifactStore } from './artifact'
import { usePresetStore } from './preset'
import { selectUidInventory } from '@/import/uid-inventory.mjs'
import { captureImportState, appendImportRecord } from '@/import/import-history.mjs'
import { mergeEquipped } from '@/import/miyoushe.mjs'

const data = ref<any>({ snapshots: {}, entries: [] })
function init(value: any) {
    data.value = { snapshots: {}, entries: [], ...value }
    data.value.entries = data.value.entries.map((entry: any) => ({ ...entry, uid: String(entry.uid) }))
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
    get: () => uidGroups.value.some(g => g.uid === data.value.selectedUid) ? data.value.selectedUid : uidGroups.value[0]?.uid || '',
    set: (uid: string) => { if (uidGroups.value.some(g => g.uid === String(uid))) data.value.selectedUid = String(uid) },
})
function importSnapshot(snapshot: any, converter: any, source = '米游社同步') {
    if (snapshot?.version !== 1 || snapshot?.source !== 'miyoushe' || !/^\d{8,10}$/.test(snapshot.role?.uid) || !Array.isArray(snapshot.characters) || snapshot.characters.length > 300) throw new Error('不是支持的米游社角色快照')
    const uid = String(snapshot.role.uid), converted: any[] = [], rejected: any[] = [], keys = new Set()
    for (const raw of snapshot.characters) {
        const key = `${uid}:${raw.base?.id}:${raw.base?.element || ''}`
        if (keys.has(key)) throw new Error('快照含重复角色')
        keys.add(key)
        try { converted.push(converter.character(raw, uid)) }
        catch (e: any) {
            const previous = data.value.entries.find((entry: any) => entry.key === key)
            rejected.push(previous?.presetName && usePresetStore().getPreset(previous.presetName)
                ? { ...previous, error: undefined, warning: `本次同步失败，使用已保存数据：${e.message}` }
                : { key, uid, label: raw.base?.name || String(raw.base?.id), error: e.message })
        }
    }
    const store = useArtifactStore(), presets = usePresetStore()
    const before = captureImportState(data.value, presets.presets.value, store.artifacts.value)
    const previous = Object.fromEntries(data.value.entries.map((e: any) => [e.key, e.artifactIds]))
    const result: any = mergeEquipped(converted, selectUidInventory(uid, data.value, presets.presets.value, store.artifacts.value, true), (a: any) => store.addArtifact(a), previous)
    const entries = converted.map(e => {
        const existing = Object.values(presets.presets.value).find((p: any) => p.item.miyousheKey === e.key)
        let name = existing?.name || e.preset.name
        if (!existing) {
            let n = 2
            while (presets.presets.value[name]) name = `${e.preset.name} (${n++})`
        }
        const artifactIds = result.equipment[e.key]
        const item = { ...e.preset, name, artifactIds, miyousheKey: e.key }
        // Preserve saved calculation assumptions when refreshing the same imported character.
        if (existing) {
            Object.assign(item, existing.item, { name, character: e.preset.character, weapon: e.preset.weapon, artifactIds, miyousheKey: e.key })
            if (existing.item.character.name === item.character.name) item.character.params = existing.item.character.params
            if (existing.item.weapon.name === item.weapon.name) item.weapon.params = existing.item.weapon.params
        }
        presets.addOrOverwrite(name, item)
        return { key: e.key, uid, label: e.label, presetName: name, artifactIds, equippedArtifacts: JSON.parse(JSON.stringify(e.gear)), level: e.preset.character.level, constellation: e.preset.character.constellation, updatedAt: snapshot.importedAt }
    })
    const missing = data.value.entries.filter((e: any) => e.uid === uid && !keys.has(e.key)).map((e: any) => ({ ...e, warning: '本次同步未返回该角色，使用已保存数据' }))
    data.value = { ...data.value, selectedUid: uid, snapshots: { ...data.value.snapshots, [uid]: snapshot }, entries: [...data.value.entries.filter((e: any) => e.uid !== uid), ...entries, ...rejected, ...missing] }
    data.value.uidArtifactIds = { ...data.value.uidArtifactIds, [uid]: [...new Set([...(data.value.uidArtifactIds?.[uid] || []), ...entries.flatMap(e => e.artifactIds)])] }
    data.value = appendImportRecord(data.value, before, presets.presets.value, store.artifacts.value, { source, uids: [uid] })
    return { ...result, imported: entries.length, rejected: rejected.length, warnings: [...(snapshot.failures || []), ...rejected.map(e => `${e.label}：${e.error || e.warning}`)] }
}
export const useMiyousheStore = () => ({ data, init, importSnapshot, uidGroups, selectedUid })
export const watchContent = () => data.value
