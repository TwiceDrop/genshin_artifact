import {createTeamNumericRules, scalarMath} from '../../beta-data/team-dps-numeric-rules.mjs'
import {rankedReactionDamage} from '../../beta-data/team-engine/ranked-reaction-damage.mjs'

const rules = createTeamNumericRules()
const families = {
    direct_moonelectro: {name: '月感电', coefficient: 3, stat: 'atk', element: 'electro'},
    direct_moonbloom: {name: '月绽放', coefficient: 1, stat: 'em', element: 'dendro'},
    direct_mooncrystallize: {name: '月结晶', coefficient: 1.6, stat: 'def', element: 'geo'},
}
const statNames = {atk: '攻击力', hp: '生命值', def: '防御力', em: '元素精通'}

export function lunarDetailState(a, key, characterName, enemy) {
    const harmony = key === 'normal' && a.damage_kind === 'lunarCrystallize'
    const direct = harmony ? 'direct_mooncrystallize' : key
    const family = families[direct]
    if (!family || !a[key]) return null
    const event = a.lunar_event
    const suffix = direct.slice('direct_'.length)
    const bloom = suffix === 'moonbloom'
    const stat = event?.stat ?? (characterName === 'Columbina' ? 'hp' : family.stat)
    const groups = {}
    function add(id, title, sources) {
        groups[id] = {title, rows: Object.entries(sources ?? {}).map(([name, value]) => ({name, value, original: value, checked: true}))}
    }
    if (!harmony) {
        add('scaling', statNames[stat], a[stat])
        add('ratio', '技能倍率', a[direct + '_ratio'])
    } else if (event) add('level', '等级基础值', {'等级基础值': event.level})
    add('coefficient', '反应基础系数', {'基础系数': family.coefficient})
    add('baseFlat', family.name + '基础伤害加值', a[suffix + '_base_damage'])
    if (bloom) add('veil', '伪秘之帷倍率提升', a.moonbloom_veil_compose)
    add('baseBonus', family.name + '基础伤害提升', a[suffix + '_base_compose'])
    const {精通: masteryBonus, ...bonusSources} = a[direct + '_compose'] ?? {}
    if (masteryBonus !== undefined && (stat !== 'em' || harmony)) add('em', '元素精通', a.em)
    add('bonus', family.name + '增伤', bonusSources)
    add('commonBonus', '月曜反应增伤', a.enhance_moon_reaction_compose)
    add('independent', '月曜反应独立倍率增量', a.moon_reaction_damage_multiplier)
    add('flat', family.name + '额外固定伤害', harmony ? undefined : a[direct + '_extra_fixed'])
    add('commonFlat', family.name + '反应固定伤害', a[suffix + '_extra_fixed'])
    for (const extra of ['em','def']) {
        const ratio = a[direct + '_extra_' + extra + '_ratio']
        if (!harmony && ratio && Object.keys(ratio).length) {
            add(extra + 'Ratio', '额外' + statNames[extra] + '倍率', ratio)
            if (stat !== extra) add(extra, statNames[extra], a[extra])
        }
    }
    add('critical', '暴击率', a.critical)
    add('criticalDamage', '暴击伤害', a.critical_damage)
    add('familyCritical', family.name + '暴击率', a['critical_' + suffix])
    add('familyCriticalDamage', family.name + '暴击伤害', bloom ? a.critical_damage_moonbloom : a[direct + '_critical_damage'])
    add('moonCritical', '月曜反应暴击率', a.critical_moon_reaction)
    add('moonCriticalDamage', '月曜反应暴击伤害', a.critical_damage_moon_reaction)
    add('resistance', '敌人基础抗性', {'基础抗性': enemy[family.element + '_res']})
    add('resMinus', '减抗', a.res_minus)
    add('elevation', family.name + '擢升', a['elevate_' + suffix + '_compose'])
    add('commonElevation', '月曜反应伤害擢升', a.elevate_moon_reaction_compose)
    const state = {groups, harmony, masteryBonus, stat, name: family.name, result: a.team_hit ? a.normal : a[key], event, targets: event?.targets ?? a.target_count ?? 1,
        archivedHarmony: harmony && !event}
    if (harmony && event) {
        const {roll} = lunarTerms(state)
        state.originalRolls = event.cases.map(scenario => roll(scenario.flat[event.member]))
    }
    return state
}

function lunarTerms(state) {
    const sum = id => state.groups[id]?.rows.reduce((total, row) => total + (row.checked ? row.value : 0), 0) ?? 0
    const body = state.harmony ? sum('level') : sum('scaling') * sum('ratio')
    const base = (body * sum('coefficient') + sum('baseFlat')) * (1 + sum('veil')) * (1 + sum('baseBonus'))
    const em = sum(state.stat === 'em' && !state.harmony ? 'scaling' : 'em')
    const mastery = state.masteryBonus === undefined ? 0 : 6 * em / (em + 2000)
    const amplified = base * (1 + mastery + sum('bonus') + sum('commonBonus')) * (1 + sum('independent'))
    const flat = sum('flat') + sum('commonFlat') + sum('emRatio') * sum(state.groups.em ? 'em' : 'scaling')
        + sum('defRatio') * sum(state.groups.def ? 'def' : 'scaling')
    const res = rules.resistance(sum('resistance') - sum('resMinus'))
    const elevation = 1 + sum('elevation') + sum('commonElevation')
    const cr = Math.min(1, Math.max(0, sum('critical') + sum('familyCritical') + sum('moonCritical')))
    const cd = sum('criticalDamage') + sum('familyCriticalDamage') + sum('moonCriticalDamage')
    const roll = extra => rules.damage((amplified + flat + extra) * elevation, 0, 1, res, state.targets, cr, cd)
    return {base, mastery, amplified, flat, res, elevation, roll, cr}
}

export function lunarCalculation(state) {
    // Archived ranked events contain the final contribution but not the other members' rolls.
    if (state.archivedHarmony) return {result: state.result}
    const {base, mastery, amplified, flat, res, elevation, roll, cr} = lunarTerms(state)
    if (!state.harmony) {
        const recomposed = roll(0)
        const observed = state.event?.observedCritical
        if (observed !== undefined) recomposed.expectation = (1 - observed) * recomposed.non_critical + observed * recomposed.critical
        const edited = Object.values(state.groups).some(group => group.rows.some(row => !row.checked || row.value !== row.original))
        return {base, mastery, amplified, flat, res, elevation, observed, recomposed, result: edited ? recomposed : state.result}
    }
    const result = {non_critical: 0, critical: 0, expectation: 0}
    const {member, cases} = state.event
    const contributions = cases.map((scenario, i) => {
        const original = state.originalRolls[i]
        const captured = scenario.rolls[member]
        const edited = roll(scenario.flat[member])
        // Even one ULP can flip the rank of equal contributions. Preserve the engine's exact
        // captured rolls for unaffected lanes when editing an individual source or crit rate.
        const own = {
            non_critical: edited.non_critical === original.non_critical ? captured.non_critical : edited.non_critical,
            critical: edited.critical === original.critical ? captured.critical : edited.critical,
            expectation: edited.expectation,
        }
        const rolls = scenario.rolls.map((other, i) => i === member ? {...own, cr} : other)
        const all = rankedReactionDamage(rolls, scalarMath)
        const ranked = all[member]
        for (const field of Object.keys(result)) result[field] += ranked[field] * scenario.weight
        return {weight: scenario.weight, flat: scenario.flat[member], own, ranked,
            members: rolls.map((row, i) => ({...row, role: scenario.rolls[i].role, ranked: all[i]}))}
    })
    return {base, mastery, amplified, flat, res, elevation, contributions, result}
}
