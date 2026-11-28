import { goodArtifactSlots, goodArtifactStats } from '../import/data/good-artifact-keys.mjs'
import { rosterAttributes } from './roster-attributes.mjs'
import { uniqueArtifactSubstatValue } from './roster-panel-rolls.mjs'

const slots = Object.fromEntries(Object.entries(goodArtifactSlots).map(([key, slot]) => [slot, key]))
const stats = Object.fromEntries(Object.entries(goodArtifactStats).map(([key, stat]) => [stat, key]))
const positions = Object.values(goodArtifactSlots)
const totals = {
    hp: '生命值上限', atk: '攻击力', def: '防御力', elemental_mastery: '元素精通',
    critical: '暴击率', critical_damage: '暴击伤害', recharge: '元素充能效率', healing_bonus: '治疗加成',
    bonus_pyro: '火元素伤害加成', bonus_hydro: '水元素伤害加成', bonus_cryo: '冰元素伤害加成',
    bonus_electro: '雷元素伤害加成', bonus_anemo: '风元素伤害加成', bonus_geo: '岩元素伤害加成',
    bonus_dendro: '草元素伤害加成', bonus_physical: '物理伤害加成',
}
const flatTotals = new Set(['hp', 'atk', 'def', 'elemental_mastery'])
const formatValue = (value, percent) => percent ? (Math.round(value * 1000) / 10).toFixed(1) + '%' : String(Math.round(value))

export function canExportArtifactLoadout(items) {
    return items.length === positions.length && positions.every((position, index) => {
        const item = items[index]
        return item?.position === position && Number.isInteger(item.id) && item.id >= 0
    }) && new Set(items.map(item => item.id)).size === positions.length
}

function exportStat(stat) {
    const key = stats[stat.name]
    return { key, value: formatValue(stat.value, key.endsWith('_')) }
}

export function createArtifactLoadout({ character, name, weapon, items, artifacts, setLabel }) {
    if (!canExportArtifactLoadout(items)) throw new Error('请选择五件不同部位的圣遗物。')
    const source = '圣遗物词条'
    const panel = rosterAttributes({
        character, weapon,
        artifacts: artifacts.map(item => ({
            ...item,
            sub_stats: item.sub_stats.map(([key, value]) => [key, uniqueArtifactSubstatValue(item.star, item.level, key, value)]),
        })),
    }, () => source)
    const artifactTotals = {}
    for (const [key, label] of Object.entries(totals)) {
        const amount = panel[key][source]
        if (amount) artifactTotals[label] = formatValue(amount, !flatTotals.has(key))
    }
    return {
        format: 'artifact-loadout',
        version: 1,
        characters: [{
            id: character.name,
            name,
            artifacts: items.map(item => ({
                slot: slots[item.position],
                setName: setLabel(item.setName),
                rarity: item.star,
                level: item.level,
                mainStat: exportStat(item.mainTag),
                subStats: [
                    ...item.normalTags.map(exportStat),
                    ...(item.unactivatedTags ?? []).map(stat => ({ ...exportStat(stat), pending: true })),
                ],
            })),
            artifactTotals,
        }],
    }
}
