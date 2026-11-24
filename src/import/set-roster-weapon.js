import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import targets from '@/assets/_gen_tf'
import locale from '@/i18n/generated/zh-cn.json'
import catalog from '../../beta-data/roster-attributes.mjs'
import { getWeaponDefaultConfigWasmInterface } from '@/utils/weapon'
import { refreshGamePreset } from '@/utils/preset-workflow.mjs'
import { BREAKS, createMysConverter, mergeEquipped, snapshotRelic, snapshotWeapon } from './miyoushe.mjs'
import { selectUidInventory } from './uid-inventory.mjs'
import { usePresetStore } from '@/store/pinia/preset'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { useArtifactStore } from '@/store/pinia/artifact'

export function rosterWeaponLimits(meta) {
    return { maxLevel: catalog.weapons[meta.name].maxLevel, maxRefine: meta.star < 3 ? 1 : meta.maxRefine ?? 5 }
}
export function rosterWeapon(meta, previous) {
    const { maxLevel, maxRefine } = rosterWeaponLimits(meta)
    const level = Math.min(previous?.level ?? 1, maxLevel)
    return { name: meta.name, level, ascend: BREAKS.includes(level) && level < maxLevel && !!previous?.ascend,
        refine: Math.min(previous?.refine ?? 1, maxRefine),
        params: meta.name === previous?.name ? previous.params : getWeaponDefaultConfigWasmInterface(meta.name) }
}
export function setRosterWeapon(entry, weapon, customName) {
    const presets = usePresetStore()
    if (entry.preset) {
        presets.addOrOverwrite(entry.presetName, { ...entry.preset, weapon })
        return
    }

    // A characters-only GOOD import can hold a snapshot before it has a usable preset.
    // Build its first local preset without modifying the original imported equipment.
    const data = useMiyousheStore().data.value
    const row = data.entries.find(e => e.key === entry.key)
    const raw = { ...entry.raw, weapon: snapshotWeapon(weapon, locale[weapons[weapon.name].nameLocale]) }
    if (entry.savedGear) raw.relics = entry.equipped.map(a => snapshotRelic(a, locale[artifacts[a.setName].nameLocale]))
    const converter = createMysConverter({ characters, weapons, artifacts, targets, locale })
    const converted = converter.character(raw, entry.uid, data.snapshots[entry.uid].source)
    const inventory = useArtifactStore()
    const reserved = new Set(data.entries.filter(e => e.key !== entry.key)
        .flatMap(e => presets.getPreset(e.presetName)?.item.artifactIds || e.artifactIds || []))
    const pool = selectUidInventory(entry.uid, data, presets.presets.value, inventory.artifacts.value)
    const { equipment } = mergeEquipped([converted], pool.filter(a => !reserved.has(a.id)),
        a => inventory.addArtifact(a), { [entry.key]: row.artifactIds })
    const ids = equipment[entry.key]
    if (customName) {
        presets.createCustom(customName, { ...converted.preset, artifactIds: ids })
        return
    }
    let name = converted.preset.name
    for (let i = 2; presets.getPreset(name); i++) name = converted.preset.name + ' (' + i + ')'
    presets.addOrOverwrite(name, refreshGamePreset(null, converted.preset, ids, entry.key, name))
    Object.assign(row, { presetName: name, artifactIds: ids, equippedArtifacts: converted.gear, error: undefined })
}
