import characters from '@/assets/_gen_character'
import { weaponByType } from '@/assets/weapon'
import { targetFunctionByCharacterName } from '@targetFunction'
import locale from '@/i18n/generated/zh-cn.json'
import { getCharacterDefaultConfigWasmInterface } from '@/utils/character'
import { getWeaponDefaultConfigWasmInterface } from '@/utils/weapon'
import { upgradeTargetFunctionConfig } from '@/utils/targetFunction'
import { gameCharacters } from './good-roster.mjs'

export function addManualRosterCharacter(role, roster, presets) {
    const uid = roster.selectedUid.value
    const { id, element } = gameCharacters.get(role)
    const meta = characters[role], label = locale[meta.nameLocale]
    const data = roster.data.value
    const existing = data.entries.find(row => row.uid === uid && (row.key === `${uid}:${id}:${element}` ||
        presets.getPreset(row.presetName)?.item.character.name === role))
    if (existing) return existing.key
    const key = `${uid}:${id}:${element}`
    const weapon = weaponByType[meta.weapon][0].name
    const target = (targetFunctionByCharacterName[role]?.[0] || targetFunctionByCharacterName.common[0]).name
    let name = label
    for (let n = 2; presets.getPreset(name); n++) name = `${label} (${n})`
    const artifactIds = [-1, -1, -1, -1, -1]
    presets.createCustom(name, { name, character: { name: role, level: 90, ascend: false, constellation: 0,
        skill1: 7, skill2: 7, skill3: 7, params: getCharacterDefaultConfigWasmInterface(role) },
        weapon: { name: weapon, level: 90, ascend: false, refine: 1, params: getWeaponDefaultConfigWasmInterface(weapon) },
        targetFunction: { name: target, params: upgradeTargetFunctionConfig(target, {}) }, artifactIds, buffs: [],
        artifactEffectMode: 'auto' })
    data.entries.push({ key, uid, id, label, element: meta.element, presetName: name, manual: true, artifactIds })
    return key
}
