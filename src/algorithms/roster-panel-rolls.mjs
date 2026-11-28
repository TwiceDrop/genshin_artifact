import { isFlat } from './artifact-score/rules.mjs'
import { tiersByStar } from './artifact-roll-tiers.mjs'
import { rosterArtifactStat, rosterAttributes } from './roster-attributes.mjs'

// Index every attainable sum by its printed value AND number of rolls.
// Keep integer units of 0.01 flat points or 0.0001 of a percentage ratio.
const rollTables = new Map()
function lineOptions(tiers, key, shown, maxRolls) {
    const units = isFlat(key) ? 100 : 10000
    const precision = isFlat(key) ? 1 : 1000
    if (!rollTables.has(tiers)) {
        const increments = tiers.map(value => Math.round(value * units))
        const table = new Map()
        let sums = new Set([0])
        for (let count = 1; count <= 6; count++) {
            const next = new Set()
            for (const sum of sums) for (const add of increments) next.add(sum + add)
            for (const sum of next) {
                const displayed = Math.round(sum * precision / units)
                if (!table.has(displayed)) table.set(displayed, new Map())
                const counts = table.get(displayed)
                if (!counts.has(count)) counts.set(count, [])
                counts.get(count).push(sum / units)
            }
            sums = next
        }
        rollTables.set(tiers, table)
    }
    const printed = Math.round(shown * precision)
    const options = [...(rollTables.get(tiers).get(printed) || [])].filter(([count]) => count <= maxRolls)
    // Manually entered extra decimals must themselves be attainable.
    const same = value => Math.abs(shown - value) <= 8 * Number.EPSILON * Math.abs(value)
    if (same(printed / precision)) return options
    return options.map(([count, values]) => [count, values.filter(same)]).filter(([, values]) => values.length)
}

export function uniqueArtifactSubstatValue(star, level, stat, shown) {
    const tiers = tiersByStar[star]?.[stat]
    if (!tiers) return shown
    const options = lineOptions(tiers, stat, shown, Math.floor(level / 4) + 1)
    const values = new Set(options.flatMap(([, values]) => values))
    return values.size === 1 ? [...values][0] : shown
}

function pieceHistories({star, level, sub_stats}, panel) {
    const steps = Math.floor(level / 4)
    const budgets = [star - 2, star - 1].filter(initial => initial >= 0)
        .map(initial => initial + steps).filter(total => Math.min(total, 4) === sub_stats.length)
    const lines = sub_stats.map(([stat, shown]) => ({
        ...rosterArtifactStat(stat, panel),
        counts: lineOptions(tiersByStar[star][stat], stat, shown, steps + 1),
    }))
    const histories = []
    function visit(index, count, selected) {
        if (index === lines.length) {
            if (budgets.includes(count)) histories.push(selected)
            return
        }
        const {key, factor, counts} = lines[index]
        for (const [rolls, values] of counts) {
            if (count + rolls + lines.length - index - 1 > Math.max(...budgets)) continue
            visit(index + 1, count + rolls, [...selected, {key, factor, values}])
        }
    }
    visit(0, 0, [])
    return histories
}

const percentKeys = new Set(['critical', 'critical_damage', 'recharge'])
function displayed(key, total) {
    const scale = percentKeys.has(key) ? 1000 : 1
    const scaled = total * scale
    return Math.round(scaled + Number.EPSILON * 8 * Math.abs(scaled))
}

// For a fixed roll-count assignment, each line's tier values are independent.
// Try only discrete totals. Two matching rows must share a legal roll budget.
export function comparePanelRolls(equipment, targets) {
    const panel = rosterAttributes({...equipment, artifacts: equipment.artifacts.map(item => ({...item, sub_stats: []}))})
    const pieces = equipment.artifacts.map(item => pieceHistories(item, panel))
    const invalid = pieces.findIndex(options => !options.length)
    if (invalid >= 0) throw new Error('请核对圣遗物副词条（第 ' + (invalid + 1) + ' 件）')
    const keys = Object.keys(targets)
    const base = Object.fromEntries(keys.map(key => [key, Object.values(panel[key]).reduce((a, b) => a + b, 0)]))
    let best
    function evaluate(lines) {
        let misses = 0, distance = 0
        const values = {}
        for (const key of keys) {
            let sums = new Set([base[key]])
            for (const line of lines) {
                if (line.key !== key) continue
                const next = new Set()
                for (const sum of sums) for (const v of line.values) next.add(sum + line.factor * v)
                sums = next
            }
            const target = targets[key]
            const measured = target != null && target !== ''
            const wanted = Number(target) * (percentKeys.has(key) ? 10 : 1)
            let nearest, difference = Infinity
            for (const sum of sums) {
                const value = displayed(key, sum)
                const delta = measured ? Math.abs(value - Math.round(wanted)) : 0
                if (delta < difference) { nearest = value; difference = delta }
                if (!difference) break
            }
            if (difference) misses++
            distance += difference
            values[key] = percentKeys.has(key) ? (nearest / 10).toFixed(1) : String(nearest)
        }
        if (!best || misses < best.misses || (misses === best.misses && distance < best.distance)) {
            best = {misses, distance, values}
        }
    }
    function combine(index, lines) {
        if (index === pieces.length) return evaluate(lines)
        for (const history of pieces[index]) {
            combine(index + 1, lines.concat(history))
            if (best?.misses === 0) break
        }
    }
    combine(0, [])
    return best.values
}
