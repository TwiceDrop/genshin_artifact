import panelHighlights from '@/assets/character-panel-highlights.json'
import characters from '@/assets/_gen_character'
import locale from '@/i18n/generated/zh-cn.json'

const artifactTagsByStat = {
    hp: ['lifeStatic', 'lifePercentage'], atk: ['attackStatic', 'attackPercentage'], def: ['defendStatic', 'defendPercentage'],
    elemental_mastery: ['elementalMastery'], critical: ['critical'], critical_damage: ['criticalDamage'], recharge: ['recharge'],
    bonus_pyro: ['fireBonus'], bonus_hydro: ['waterBonus'], bonus_electro: ['thunderBonus'], bonus_cryo: ['iceBonus'],
    bonus_anemo: ['windBonus'], bonus_geo: ['rockBonus'], bonus_dendro: ['dendroBonus'],
    bonus_physical: ['physicalBonus'], healing_bonus: ['cureEffect'],
}

export function characterArtifactHighlights(name) {
    return (panelHighlights[name] || []).flatMap(stat => artifactTagsByStat[stat])
}

const characterLabels = Object.values(characters).map(c => ({ label: locale[c.nameLocale], name: c.name }))
    .filter(c => c.label).sort((a, b) => b.label.length - a.label.length)
export function artifactGroupHighlights(title) {
    let index = Infinity, match
    for (const { label, name } of characterLabels) {
        const start = title.indexOf(label)
        if (start >= 0 && start < index) {
            index = start
            match = name
        }
    }
    return characterArtifactHighlights(match)
}

export function highlightedSubStat(name, tags) {
    return tags ? tags.includes(name) : name === 'critical' || name === 'criticalDamage'
}

export function highlightedMainStat(item, tags) {
    return item.position !== 'flower' && item.position !== 'feather' && !!tags?.includes(item.mainTag.name)
}

export function scoreContextHighlights(context) {
    const role = Object.values(characters).find(c => context.name === '旅行者'
        ? c.name.startsWith('Aether') && c.element.toLowerCase() === context.options.elem
        : locale[c.nameLocale] === context.name)
    return characterArtifactHighlights(role?.name)
}
