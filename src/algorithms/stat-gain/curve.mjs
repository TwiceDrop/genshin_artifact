// Five-star roll values follow src/constants/artifact.ts (the calculator's convention).
export const STATS = [
    { key: 'CriticalRate', label: '暴击率', panel: 'critical', rolls: [.027, .031, .035, .039], percent: true },
    { key: 'CriticalDamage', label: '暴击伤害', panel: 'critical_damage', rolls: [.054, .062, .070, .078], percent: true },
    { key: 'ATKPercentage', label: '攻击力%', panel: 'atk', rolls: [.041, .047, .053, .058], percent: true },
    { key: 'ElementalMastery', label: '元素精通', panel: 'elemental_mastery', rolls: [16, 19, 21, 23] },
    { key: 'HPPercentage', label: '生命值%', panel: 'hp', rolls: [.041, .047, .053, .058], percent: true },
    { key: 'DEFPercentage', label: '防御力%', panel: 'def', rolls: [.051, .058, .066, .073], percent: true },
    { key: 'Recharge', label: '元素充能效率', panel: 'recharge', rolls: [.045, .052, .058, .065], percent: true },
    { key: 'ATKFixed', label: '固定攻击力', panel: 'atk', rolls: [14, 16, 18, 19] },
    { key: 'HPFixed', label: '固定生命值', panel: 'hp', rolls: [209, 239, 269, 299] },
    { key: 'DEFFixed', label: '固定防御力', panel: 'def', rolls: [16, 19, 21, 23] },
]

export function rollValue(stat, tier) {
    if (tier === 'max') return stat.rolls[3]
    if (tier === 'average') return stat.rolls.reduce((a, b) => a + b, 0) / 4
    throw new Error('未知词条档位')
}

export function combinationCount(maxRolls, statCount) {
    let count = 1
    for (let i = 1; i <= statCount; i++) count = count * (maxRolls + i) / i
    return Math.round(count)
}

export function validateOptions({ stats, maxRolls = 20, tier = 'average' }) {
    if (!Number.isInteger(maxRolls) || maxRolls < 1 || maxRolls > 20) throw new Error('词条预算须为 1～20 的整数')
    if (!Array.isArray(stats) || !stats.length || new Set(stats).size !== stats.length || stats.some(key => !STATS.some(s => s.key === key))) {
        throw new Error('请至少选择一种有效属性，且不能重复')
    }
    if (!['average', 'max'].includes(tier)) throw new Error('未知词条档位')
    if (combinationCount(maxRolls, stats.length) > 1000000) throw new Error('组合超过 100 万，请减少参与分配的属性；计算不会截断搜索')
}

// Each budget is enumerated independently. No greedy pruning, critical caps, or
// monotonicity assumptions: arbitrary reactions and threshold buffs are allowed.
export function computeCurve(evaluate, options, onPoint = () => {}) {
    validateOptions(options)
    const { stats, maxRolls = 20 } = options
    const counts = Array(stats.length).fill(0)
    let evaluations = 0
    const score = () => {
        const value = evaluate(Object.fromEntries(stats.map((key, i) => [key, counts[i]])))
        evaluations++
        if (!Number.isFinite(value) || value < 0) throw new Error('伤害计算返回了无效结果，请检查技能、反应和角色配置')
        return value
    }
    const baseline = score()
    const points = [{ rolls: 0, damage: baseline, gain: baseline > 0 ? 0 : null, marginal: 0, allocation: Object.fromEntries(stats.map(key => [key, 0])) }]
    onPoint(points[0], evaluations)
    for (let budget = 1; budget <= maxRolls; budget++) {
        let bestDamage = -Infinity
        let allocation
        function visit(index, remaining) {
            if (index === counts.length - 1) {
                counts[index] = remaining
                const damage = score()
                if (damage > bestDamage) {
                    bestDamage = damage
                    allocation = Object.fromEntries(stats.map((key, i) => [key, counts[i]]))
                }
                return
            }
            for (let n = 0; n <= remaining; n++) {
                counts[index] = n
                visit(index + 1, remaining - n)
            }
        }
        visit(0, budget)
        const point = { rolls: budget, damage: bestDamage, gain: baseline > 0 ? bestDamage / baseline - 1 : null, marginal: bestDamage - points[budget - 1].damage, allocation }
        points.push(point)
        onPoint(point, evaluations)
    }
    return { points, baseline, evaluations }
}

export function createDamageEvaluator(mona, input, reaction, fumo, stats, tier) {
    const config = JSON.parse(JSON.stringify(input))
    const original = config.artifacts[0]?.sub_stats.map(s => [...s]) || []
    // A temporary Empty artifact carries stats only when no real artifact exists.
    // Otherwise retain all five set identities and main stats. Never write to inventory.
    if (!config.artifacts.length) config.artifacts.push({ set_name: 'Empty', slot: 'Flower', level: 0, star: 5, main_stat: ['HPFixed', 0], sub_stats: [], id: 0 })
    const selected = stats.map(key => STATS.find(s => s.key === key))
    function apply(allocation) {
        config.artifacts[0].sub_stats = original.concat(selected.filter(s => allocation[s.key] > 0).map(s => [s.key, allocation[s.key] * rollValue(s, tier)]))
    }
    return {
        evaluate(allocation) {
            apply(allocation)
            const result = mona.CalculatorInterface.get_damage_analysis(config, fumo === 'None' ? null : fumo)
            const damage = result[reaction]?.expectation
            if (!Number.isFinite(damage)) throw new Error('当前技能不支持所选反应，请重新选择伤害类型')
            return damage
        },
        panel(allocation) {
            apply(allocation)
            const panel = mona.CommonInterface.get_attribute(config)
            return Object.fromEntries(Object.entries(panel).map(([key, values]) => [key, Object.values(values).reduce((sum, n) => sum + n, 0)]))
        },
    }
}
