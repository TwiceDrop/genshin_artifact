import {newEnemyConfig} from '@/composables/enemy'
import {defaultCharacterSkill} from '@/composables/character'
import {newDefaultArtifactConfigForWasm} from '@/utils/artifacts'
import {readPresetConfiguration} from './preset-workflow.mjs'
import type {IPreset} from '@/types/preset'

export function restorePresetConfiguration(item: IPreset): IPreset {
    return readPresetConfiguration(item, {
        enemy: newEnemyConfig(), infusion: 'None',
        skill: defaultCharacterSkill(item.character.name),
        singleConfig: newDefaultArtifactConfigForWasm(),
    })
}

// Both editors use the same conversion between saved levels/talents and form controls.
export function applyPresetIdentity(item: IPreset, character: any, weapon: any) {
    const c = item.character, w = item.weapon
    character.characterName.value = c.name
    character.characterLevel.value = c.level.toString() + (c.ascend ? '+' : '-')
    character.characterConstellation.value = c.constellation ?? 0
    character.characterSkill1.value = c.skill1 + 1
    character.characterSkill2.value = c.skill2 + 1
    character.characterSkill3.value = c.skill3 + 1
    character.characterConfig.value = c.params
    weapon.weaponName.value = w.name
    weapon.weaponLevel.value = w.level.toString() + (w.ascend ? '+' : '-')
    weapon.weaponRefine.value = w.refine
    weapon.weaponConfig.value = w.params
}
