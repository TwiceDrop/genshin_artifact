import { PANEL_STATS, newPanelSearchOptions } from '../../../beta-data/panel-search.mjs'
import weapons from '@/assets/_gen_weapon'
import sets from '@/assets/_gen_artifact'
import targets from '@/assets/_gen_tf'
import buffs from '@/assets/_gen_buff'
import locale from '@/i18n/generated/zh-cn.json'
import { displayedTag } from '@/utils/artifacts'
import { newEnemyConfig } from '@/composables/enemy'

const label = (catalog,key) => locale[catalog[key]?.nameLocale] || key
const fields = (source,keys) => Object.fromEntries(keys.filter(key=>source?.[key]!==undefined).map(key=>[key,source[key]]))
function publicWeapon(weapon) {
    const data = weapons[weapon.name]
    const result = { name:label(weapons,weapon.name), level:weapon.level, refine:weapon.refine }
    const params = []
    for (const config of data?.configs || []) {
        const value = weapon.params?.[weapon.name]?.[config.name]
        if (typeof value !== 'boolean' && !Number.isFinite(value)) continue
        const display = config.type === 'option' ? config.options[value] :
            typeof value === 'boolean' ? (value ? '是' : '否') : String(value)
        if (display !== undefined) params.push({label:locale[config.title], value:display})
    }
    if (params.length) result.params = params
    return result
}

export function presetPreview(preset,title,items,statName) {
    const {character,weapon,targetFunction,filter,constraint} = preset
    const panel = preset.panelSearch ?? newPanelSearchOptions()
    const target = preset.optimizationMode === 'panel' ? '面板 · '+(PANEL_STATS.find(s=>s.key===panel.metric)?.label || panel.metric)+'（'+(panel.direction==='asc'?'最低':'最高')+'）' :
        preset.targetMode === 'dsl' || preset.targetMode === 'generator' || preset.useDSL || targetFunction.use_dsl
            ? 'MONA-DSL' : label(targets,targetFunction.name)
    const defaults = newEnemyConfig()
    const content = {
        title, character:character.name, level:character.level, constellation:character.constellation ?? 0,
        talents:[character.skill1,character.skill2,character.skill3].map(level=>level+1),
        weapon:publicWeapon(weapon), target,
        enemy:fields(preset.enemy ?? defaults,Object.keys(defaults)),
        limits:fields(constraint,['minRecharge','minElementalMastery','minCritical','minCriticalDamage']),
        sets:(constraint?.setNames || []).map(name=>label(sets,name)),
        filters:{sand:(filter?.sandMainStats || []).map(statName),cup:(filter?.gobletMainStats || []).map(statName),head:(filter?.headMainStats || []).map(statName)},
        buffs:(preset.buffs || []).filter(buff=>!buff.lock).map(buff=>label(buffs,buff.name)),
    }
    const equipment = items.filter(Boolean).map(piece=>({
        position:piece.position, set:label(sets,piece.setName), level:piece.level,
        main:displayedTag(piece.mainTag.name,piece.mainTag.value),
        subs:piece.normalTags.map(tag=>displayedTag(tag.name,tag.value)),
    }))
    return {content,equipment}
}
