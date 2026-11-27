import {PANEL_SLOTS, PANEL_STATS, readPanel} from './panel-search.mjs'

const RESULT_LIMIT = 100
const resultSlots = PANEL_SLOTS.map(slot => slot.toLowerCase())

export function hasPanelMaximums(input) {
    return PANEL_STATS.some(({key}) => input?.constraint?.panel_max?.[key] != null)
}

export function withDamagePanelRangeOptimization(api) {
    return {...api, OptimizeSingleWasm: new Proxy(api.OptimizeSingleWasm, {
        get(target, method) {
            const fn = Reflect.get(target, method)
            if (method !== 'optimize') return fn
            return (input, artifacts, onProgress) => hasPanelMaximums(input)
                ? optimizeWithPanelMaximums(api, input, artifacts, onProgress)
                : fn(input, artifacts)
        },
    })}
}

function createHealthPruner(api, input, pools, maximum) {
    if (maximum == null || input.buffs?.length !== 0 || input.target_function?.use_dsl ||
        pools.some(pool => !pool.length)) return null

    // With no configured buffs, equipping gear keeps the no-artifact HP and
    // adds flat HP and nonnegative HP percentage/set bonuses. A flower's flat
    // main stat alone can raise the floor without modelling any conversions.
    const hasNegativeHealth = pools.some(pool => pool.some(artifact =>
        [artifact.main_stat, ...artifact.sub_stats].some(([stat, value]) =>
            (stat === 'HPFixed' || stat === 'HPPercentage') && value < 0)))
    if (hasNegativeHealth) return null

    const {hp: unequippedHp} = readPanel(api, input, [])
    const flowerMinimums = new WeakMap()
    return ([flowers]) => {
        if (!flowerMinimums.has(flowers)) {
            flowerMinimums.set(flowers, flowers.reduce((minimum, {main_stat: [stat, value]}) =>
                Math.min(minimum, stat === 'HPFixed' ? value : 0), Infinity))
        }
        const floor = unequippedHp + flowerMinimums.get(flowers)
        // A different native addition order can round panel totals at a tie.
        return floor - Math.abs(floor) * 16 * Number.EPSILON > maximum
    }
}

function optimizeWithPanelMaximums(api, input, artifacts, onProgress) {
    const maximums = PANEL_STATS.filter(({key}) => input.constraint.panel_max[key] != null)
    const {panel_max, ...constraint} = input.constraint
    const nativeInput = {...input, constraint}
    const excludedByMainStat = []
    const pools = PANEL_SLOTS.map(slot => {
        const allowed = slot === 'Flower' || slot === 'Feather'
            ? undefined : input.filter?.[slot.toLowerCase() + '_main_stat']
        return artifacts.filter(artifact => {
            if (artifact.slot !== slot) return false
            if (!allowed?.length || allowed.includes(artifact.main_stat[0])) return true
            excludedByMainStat.push(artifact)
            return false
        })
    })
    const artifactsById = new Map(artifacts.map(a => [a.id, a]))
    const combinations = domains => domains.reduce((count, pool) => count * Math.max(1, pool.length), 1)
    const candidateSpace = combinations(pools)
    const exceedsHealthCap = createHealthPruner(api, nativeInput, pools, panel_max.hp)
    const fitsByBuild = new Map()
    let best = [], covered = 0, evaluated = 0, lastReport = -Infinity
    function report(force = false) {
        if (!onProgress) return
        const now = performance.now()
        if (!force && now - lastReport < 250) return
        lastReport = now
        onProgress({candidateSpace, evaluated, remainingGroups: candidateSpace - covered,
            percent: 100 * covered / candidateSpace, etaMs: null, etaScope: 'total', searchStage: 'enumeration'})
    }

    function visit(domains) {
        const remaining = combinations(domains)
        if (exceedsHealthCap?.(domains)) {
            covered += remaining
            report()
            return
        }
        // Adapters inspect the inventory before the native main-stat filter runs.
        const candidates = [...domains.flat(), ...excludedByMainStat]
        const results = api.OptimizeSingleWasm.optimize(nativeInput, candidates)
        const found = new Map(best.map(row => [resultSlots.map(slot => row[slot]).join(':'), row]))
        const newlyChecked = []
        for (const row of results) {
            if (best.length === RESULT_LIMIT && row.value <= best.at(-1).value) break
            const ids = resultSlots.map(slot => row[slot])
            const key = ids.join(':')
            if (found.has(key)) continue
            if (!fitsByBuild.has(key)) {
                const panel = readPanel(api, nativeInput, ids.filter(id => id != null).map(id => artifactsById.get(id)))
                evaluated++
                fitsByBuild.set(key, maximums.every(({key}) => panel[key] <= panel_max[key]))
                newlyChecked.push(key)
            }
            if (fitsByBuild.get(key)) found.set(key, row)
        }
        best = [...found.values()].sort((a, b) => b.value - a.value).slice(0, RESULT_LIMIT)

        // A full batch can hide lower-ranked builds. A shorter batch can
        // omit ties, so it only bounds the unexplored builds by its best score.
        const unseenScore = results.length === RESULT_LIMIT ? results.at(-1).value : results[0]?.value
        if (!results.length || remaining <= results.length ||
            (best.length === RESULT_LIMIT && unseenScore <= best.at(-1).value)) {
            covered += remaining
            report()
        } else {
            const split = domains.reduce((largest, pool, i) => pool.length > domains[largest].length ? i : largest, 0)
            const pool = domains[split], mid = Math.floor(pool.length / 2)
            for (const half of [pool.slice(0, mid), pool.slice(mid)]) {
                const part = [...domains]
                part[split] = half
                visit(part)
            }
        }
        // Descendants can rediscover these builds. Sibling domains are disjoint.
        for (const key of newlyChecked) fitsByBuild.delete(key)
    }
    report(true)
    visit(pools)
    report(true)
    return best.map(row => ({...row, ratio: row.value / best[0].value}))
}
