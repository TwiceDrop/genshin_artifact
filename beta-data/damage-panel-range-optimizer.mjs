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

function optimizeWithPanelMaximums(api, input, artifacts, onProgress) {
    const maximums = PANEL_STATS.filter(({key}) => input.constraint.panel_max[key] != null)
    const {panel_max, ...constraint} = input.constraint
    const nativeInput = {...input, constraint}
    const pools = PANEL_SLOTS.map((slot, index) => {
        const allowed = input.filter?.[resultSlots[index] + '_main_stat']
        return artifacts.filter(a => a.slot === slot && (!allowed?.length || allowed.includes(a.main_stat[0])))
    })
    const artifactsById = new Map(artifacts.map(a => [a.id, a]))
    const combinations = domains => domains.reduce((count, pool) => count * Math.max(1, pool.length), 1)
    const candidateSpace = combinations(pools)
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
        const results = api.OptimizeSingleWasm.optimize(nativeInput, domains.flat())
        const found = new Map(best.map(row => [resultSlots.map(slot => row[slot]).join(':'), row]))
        for (const row of results) {
            if (best.length === RESULT_LIMIT && row.value <= best.at(-1).value) break
            const ids = resultSlots.map(slot => row[slot])
            const key = ids.join(':')
            if (found.has(key)) continue
            const panel = readPanel(api, nativeInput, ids.filter(id => id != null).map(id => artifactsById.get(id)))
            evaluated++
            if (maximums.every(({key}) => panel[key] <= panel_max[key])) found.set(key, row)
        }
        best = [...found.values()].sort((a, b) => b.value - a.value).slice(0, RESULT_LIMIT)

        // A full batch can hide lower-ranked builds. A shorter batch can
        // omit ties, so it only bounds the unexplored builds by its best score.
        const unseenScore = results.length === RESULT_LIMIT ? results.at(-1).value : results[0]?.value
        if (!results.length || remaining <= results.length ||
            (best.length === RESULT_LIMIT && unseenScore <= best.at(-1).value)) {
            covered += remaining
            report()
            return
        }
        const split = domains.reduce((largest, pool, i) => pool.length > domains[largest].length ? i : largest, 0)
        const pool = domains[split], mid = Math.floor(pool.length / 2)
        for (const half of [pool.slice(0, mid), pool.slice(mid)]) {
            const part = [...domains]
            part[split] = half
            visit(part)
        }
    }
    report(true)
    visit(pools)
    report(true)
    return best.map(row => ({...row, ratio: row.value / best[0].value}))
}
