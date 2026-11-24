import catalog from '../../beta-data/roster-attributes.mjs'

const baseKeys = {FIGHT_PROP_BASE_HP: 'hp', FIGHT_PROP_BASE_ATTACK: 'atk', FIGHT_PROP_BASE_DEFENSE: 'def'}
const baseLabels = {hp: '角色基础生命', atk: '角色基础攻击', def: '角色基础防御'}
const percentages = {FIGHT_PROP_HP_PERCENT: 'hp', FIGHT_PROP_ATTACK_PERCENT: 'atk', FIGHT_PROP_DEFENSE_PERCENT: 'def'}
const panelKeys = {
    FIGHT_PROP_HP: 'hp', FIGHT_PROP_ATTACK: 'atk', FIGHT_PROP_DEFENSE: 'def', FIGHT_PROP_ELEMENT_MASTERY: 'elemental_mastery',
    FIGHT_PROP_CRITICAL: 'critical', FIGHT_PROP_CRITICAL_HURT: 'critical_damage', FIGHT_PROP_CHARGE_EFFICIENCY: 'recharge',
    FIGHT_PROP_HEAL_ADD: 'healing_bonus', FIGHT_PROP_HEALED_ADD: 'incoming_healing_bonus',
    FIGHT_PROP_SKILL_CD_MINUS_RATIO: 'cooldown_reduction', FIGHT_PROP_SHIELD_COST_MINUS_RATIO: 'shield_strength',
}
const artifactProps = {
    HPFixed: 'FIGHT_PROP_HP', HPPercentage: 'FIGHT_PROP_HP_PERCENT', ATKFixed: 'FIGHT_PROP_ATTACK', ATKPercentage: 'FIGHT_PROP_ATTACK_PERCENT',
    DEFFixed: 'FIGHT_PROP_DEFENSE', DEFPercentage: 'FIGHT_PROP_DEFENSE_PERCENT', CriticalRate: 'FIGHT_PROP_CRITICAL',
    CriticalDamage: 'FIGHT_PROP_CRITICAL_HURT', Recharge: 'FIGHT_PROP_CHARGE_EFFICIENCY', ElementalMastery: 'FIGHT_PROP_ELEMENT_MASTERY',
    HealingBonus: 'FIGHT_PROP_HEAL_ADD',
}
const elements = {Pyro: 'FIRE', Hydro: 'WATER', Anemo: 'WIND', Electro: 'ELEC', Dendro: 'GRASS', Cryo: 'ICE', Geo: 'ROCK', Physical: 'PHYSICAL'}
for (const [element, gameKey] of Object.entries(elements)) {
    const bonus = 'FIGHT_PROP_' + gameKey + '_ADD_HURT'
    panelKeys[bonus] = 'bonus_' + element.toLowerCase()
    panelKeys['FIGHT_PROP_' + gameKey + '_SUB_HURT'] = 'res_' + element.toLowerCase()
    artifactProps[element + 'Bonus'] = bonus
}

const ascensionLevels = [20, 40, 50, 60, 70, 80]
function equipmentStats(record, level, ascend) {
    const stage = ascensionLevels.filter(boundary => level > boundary || (level === boundary && ascend)).length
    const values = {}
    for (const [prop, [initial, curve]] of Object.entries(record.growth)) {
        values[prop] = initial * catalog.curves[curve][level - 1]
    }
    for (const [prop, stages] of Object.entries(record.promotion)) {
        // One- and two-star weapons end at their fourth ascension.
        values[prop] = (values[prop] || 0) + stages[Math.min(stage, stages.length - 1)]
    }
    return {values, stage}
}

export function weaponBaseStats({name, level, ascend}) {
    const arm = catalog.weapons[name]
    return equipmentStats(arm, Math.min(level, arm.maxLevel), ascend).values
}

// This is the character roster's Details view. Only direct stat properties from
// the game tables apply here. Combat abilities, conversions and party effects
// are evaluated by the damage kernel, never by this display calculation.
export function rosterAttributes({character, weapon, artifacts}, artifactSource = () => '圣遗物词条') {
    const unit = catalog.characters[character.name]
    const arm = catalog.weapons[weapon.name]
    const characterStats = equipmentStats(unit, character.level, character.ascend)
    const weaponStats = weaponBaseStats(weapon)
    const result = Object.fromEntries(Object.values(panelKeys).map(key => [key, {}]))
    const base = {}
    for (const [prop, key] of Object.entries(baseKeys)) {
        base[key] = characterStats.values[prop]
        result[key][baseLabels[key]] = base[key]
    }
    const weaponAttack = weaponStats.FIGHT_PROP_BASE_ATTACK
    base.atk += weaponAttack
    result.atk['武器基础攻击'] = weaponAttack
    result.critical['初始值'] = 0.05
    result.critical_damage['初始值'] = 0.5
    result.recharge['初始值'] = 1
    if (unit.baseElementalMastery) result.elemental_mastery['初始值'] = unit.baseElementalMastery

    function add(prop, value, label) {
        const percentKey = percentages[prop]
        const key = percentKey || panelKeys[prop]
        if (!key || !value) return // Base stats were applied above; general damage has no details row.
        const amount = percentKey ? base[key] * value : value
        result[key][label] = (result[key][label] || 0) + amount
    }
    function addGroup(properties, label) {
        for (const [prop, value] of Object.entries(properties)) add(prop, value, label)
    }
    addGroup(characterStats.values, '角色副属性')
    addGroup(weaponStats, '武器副词条')
    for (const effect of unit.fixed) {
        if (effect.constellation !== undefined && character.constellation >= effect.constellation)
            addGroup(effect.stats, '命之座')
        if (effect.ascension !== undefined && characterStats.stage >= effect.ascension)
            addGroup(effect.stats, '固有天赋')
    }
    if (arm.passive.length) addGroup(arm.passive[weapon.refine - 1], '武器被动')
    const counts = new Map()
    for (const [index, item] of artifacts.entries()) {
        for (const [line, [stat, value]] of [item.main_stat, ...item.sub_stats].entries()) {
            add(artifactProps[stat], value, artifactSource(index, line))
        }
        counts.set(item.set_name, (counts.get(item.set_name) || 0) + 1)
    }
    for (const [set, count] of counts) {
        for (const bonus of catalog.sets[set]) {
            if (count >= bonus.pieces) addGroup(bonus.stats, bonus.label)
        }
    }
    return result
}

export function rosterBaseValue(key, composition) {
    if (!Object.hasOwn(baseLabels, key)) return null
    const characterBase = composition[baseLabels[key]]
    return key === 'atk' ? characterBase + composition['武器基础攻击'] : characterBase
}

export function rosterArtifactStat(stat, panel) {
    const prop = artifactProps[stat]
    const relativeTo = percentages[prop]
    const key = relativeTo || panelKeys[prop]
    return {key, factor: relativeTo ? rosterBaseValue(key, panel[key]) : 1}
}
