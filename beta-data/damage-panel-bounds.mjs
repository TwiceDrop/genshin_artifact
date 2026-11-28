import {PANEL_STATS, sumPanel} from './panel-search.mjs'
import {intervalMath} from './team-dps-numeric-program.mjs'

const artifactStats = {
    hp: ['HPFixed', 'HPPercentage'],
    atk: ['ATKFixed', 'ATKPercentage'],
    def: ['DEFFixed', 'DEFPercentage'],
    elemental_mastery: ['ElementalMastery'],
    recharge: ['Recharge'],
    critical: ['CriticalRate'],
    critical_damage: ['CriticalDamage'],
}
const fixedPanelBuffs = new Set([
    'ATKFixed', 'ATKPercentage', 'HPFixed', 'HPPercentage', 'DEFFixed', 'DEFPercentage',
    'ElementalMastery', 'Recharge', 'CriticalRate', 'CriticalDamage', 'BennettQ',
])
// For these character/weapon combinations the seven panel stats have no
// conversion from other artifact stats. Only include sets whose bonuses to
// those stats are fixed and nonnegative.
const independentCharacters = new Set(['Aloy', 'Barbara', 'Chongyun', 'Eula', 'Jean', 'Kaeya', 'Klee', 'Lisa', 'Xiao'])
const passiveFreeWeapons = new Set([
    'ApprenticesNotes', 'BeginnersProtector', 'DullBlade', 'HuntersBow', 'WasterGreatsword',
    'IronPoint', 'OldMercsPal', 'PocketGrimoire', 'SeasonedHuntersBow', 'SilverSword',
])
const fixedSets = new Set([
    'Adventurer', 'BraveHeart', 'DefendersWill', 'EchoesOfAnOffering', 'EmblemOfSeveredFate',
    'Empty', 'GladiatorsFinale', 'LuckyDog', 'ResolutionOfSojourner', 'Scholar',
    'ShimenawasReminiscence', 'TheExile', 'WanderersTroupe',
])
const baseSources = {
    hp: ['角色基础生命'],
    atk: ['角色基础攻击', '武器基础攻击'],
    def: ['角色基础防御'],
}

export function hasContradictoryDamageBounds(constraint) {
    return PANEL_STATS.some(({key, minimum}) => {
        // Native mastery excludes reaction-only mastery. Native crit
        // minimums clamp to [0, 1], while panel caps read raw crit.
        const min = constraint?.[minimum], max = constraint?.panel_max?.[key]
        return min != null && max != null && key !== 'elemental_mastery' &&
            (key !== 'critical' || min > 0) && min > max
    })
}

export function createDamagePanelPruner(api, input, pools, constraint) {
    if (!pools.every(pool => pool.length) || !input.buffs?.every(buff =>
        buff.lock === true || buff.config?.[buff.name]?.active === false || fixedPanelBuffs.has(buff.name))) return null

    const independent = independentCharacters.has(input.character.name) && passiveFreeWeapons.has(input.weapon.name) &&
        pools.every(pool => pool.every(piece => fixedSets.has(piece.set_name)))
    let fields = PANEL_STATS.filter(({key}) => constraint?.panel_max?.[key] != null && (independent || key === 'hp'))
    if (!fields.length) return null

    // Without a complete additive model, retain the weaker HP bound: base
    // panel + flat health, with nonnegative HP contributions from gear.
    if (!independent && pools.some(pool => pool.some(piece => [piece.main_stat, ...piece.sub_stats]
        .some(([stat, value]) => artifactStats.hp.includes(stat) && value < 0)))) return null
    const fixedSetLayout = independent && pools.every(pool => pool.every(piece => piece.set_name === pool[0].set_name))
    const seed = fixedSetLayout ? pools.map(([piece], id) => ({
        ...piece, id, main_stat: [piece.main_stat[0], 0], sub_stats: [],
    })) : []
    const raw = api.CommonInterface.get_attribute({...input, artifacts: seed})
    const panel = sumPanel(raw)
    const factors = new Map()
    for (const {key} of fields) {
        const sources = baseSources[key]
        const base = independent && sources ? sources.reduce((sum, name) => sum + raw[key][name], 0) : 0
        if (Number.isFinite(base)) factors.set(key, base)
    }
    fields = fields.filter(({key}) => factors.has(key))
    if (!fields.length) return null

    const rows = new WeakMap(), ranges = new WeakMap()
    for (const piece of pools.flat()) {
        const stats = [piece.main_stat, ...piece.sub_stats]
        rows.set(piece, fields.map(({key}) => {
            const [flat, percent] = artifactStats[key], base = factors.get(key)
            const terms = stats.filter(([stat]) => stat === flat || stat === percent)
                .map(([stat, value]) => (stat === flat ? 1 : base) * value)
            const value = terms.reduce((sum, term) => sum + term, 0)
            return {value, magnitude: terms.reduce((sum, term) => sum + Math.abs(term), 0), terms: terms.length}
        }))
    }
    return domains => {
        const perSlot = domains.map(pool => {
            if (!ranges.has(pool)) ranges.set(pool, fields.map((_, i) => {
                const values = pool.map(piece => rows.get(piece)[i])
                return {min: Math.min(...values.map(row => row.value)), max: Math.max(...values.map(row => row.value)),
                    magnitude: Math.max(...values.map(row => row.magnitude)), terms: Math.max(...values.map(row => row.terms))}
            }))
            return ranges.get(pool)
        })
        return fields.some(({key, minimum}, i) => {
            let range = [panel[key], panel[key]]
            const parts = Object.values(raw[key])
            let magnitude = parts.reduce((sum, value) => sum + Math.abs(value), 0), terms = parts.length
            for (const slot of perSlot) {
                const part = slot[i]
                range = intervalMath.add(range, [part.min, part.max])
                magnitude += part.magnitude
                terms += part.terms
            }
            // Allow for the native grouping of artifact stats and the panel
            // composition's addition order. Exact comparisons use readPanel.
            const tolerance = 8 * (terms + pools.length + 1) * Number.EPSILON * magnitude
            return range[0] - tolerance > constraint.panel_max[key] ||
                (fixedSetLayout && key !== 'elemental_mastery' && key !== 'critical' &&
                    constraint[minimum] != null && range[1] + tolerance < constraint[minimum])
        })
    }
}
