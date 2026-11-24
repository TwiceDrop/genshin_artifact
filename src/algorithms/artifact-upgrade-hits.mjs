import { isFlat } from './artifact-score/rules.mjs'
import { tiersByStar } from './artifact-roll-tiers.mjs'

const tables = new Map()
function rollEstimates(star, key, value) {
    const tiers = tiersByStar[star][key]
    const flat = isFlat(key)
    if (!tables.has(tiers)) {
        const displayedByCount = []
        const increments = tiers.map(tier => flat ? Math.fround(tier) : Math.fround(Math.fround(tier) * 100))
        let sums = new Set([0])
        for (let rolls = 1; rolls <= 2 * (star - 2); rolls++) {
            const next = new Set()
            for (const sum of sums) for (const increment of increments) next.add(Math.fround(sum + increment))
            displayedByCount.push([...new Set([...next].map(sum => Math.round(flat ? sum : Math.fround(sum * 10))))])
            sums = next
        }
        tables.set(tiers, displayedByCount)
    }
    const scale = flat ? 1 : 1000
    const shown = Math.round(value * scale)
    const mean = tiers.reduce((sum, tier) => sum + tier) / tiers.length * scale
    return tables.get(tiers).map((values, hits) => ({
        hits,
        // Compare mixed flat and percentage lines in units of one average roll.
        error: Math.min(...values.map(candidate => Math.abs(candidate - shown))) / mean,
        typicalError: (hits + 1 - shown / mean) ** 2,
    }))
}

export function artifactUpgradeHits(star, level, subStats) {
    // Until four lines are unlocked, every upgrade adds a line instead of improving one.
    if (subStats.length !== 4 || star < 3 || !tiersByStar[star] || level < 4) return []
    const choices = subStats.map(([key, value]) => rollEstimates(star, key, value))
    // Out of the +4 steps, some can unlock the third or fourth line.
    // A five-star +20 starts with 3 or 4 lines, leaving 4 or 5 actual hits.
    const maxHits = Math.min(Math.floor(level / 4), star) - (5 - star)
    let bestHits = [], bestError = Infinity, bestTypicalError = Infinity
    function collect(counts, sum, error, typicalError) {
        if (counts.length === choices.length) {
            if (sum < maxHits - 1) return
            if (error < bestError || (error === bestError && typicalError < bestTypicalError)) {
                bestHits = counts
                bestError = error
                bestTypicalError = typicalError
            }
            return
        }
        for (const next of choices[counts.length]) {
            if (sum + next.hits <= maxHits) {
                collect([...counts, next.hits], sum + next.hits, error + next.error, typicalError + next.typicalError)
            }
        }
    }
    collect([], 0, 0, 0)
    return bestHits
}
