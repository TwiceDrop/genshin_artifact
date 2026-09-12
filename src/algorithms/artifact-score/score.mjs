import data, { analyzeArtifact, createScoreEvaluator, getMarkClass } from './vendor/miao.mjs'

export const STAT_KEYS = {
    lifeStatic: 'hpPlus', lifePercentage: 'hp', attackStatic: 'atkPlus', attackPercentage: 'atk',
    defendStatic: 'defPlus', defendPercentage: 'def', elementalMastery: 'mastery', recharge: 'recharge',
    critical: 'cpct', criticalDamage: 'cdmg', cureEffect: 'heal', physicalBonus: 'phy',
    fireBonus: 'pyro', waterBonus: 'hydro', iceBonus: 'cryo', thunderBonus: 'electro',
    windBonus: 'anemo', rockBonus: 'geo', dendroBonus: 'dendro'
}
export const POSITIONS = ['flower', 'feather', 'sand', 'cup', 'head']
const FLAT = new Set(['lifeStatic', 'attackStatic', 'defendStatic', 'elementalMastery'])
const round = n => Math.round(n * 10) / 10
export { getMarkClass }

export function toScoreArtifact(item) {
    if (!item) return null
    const pos = POSITIONS.indexOf(item.position)
    const convert = tag => {
        if (!STAT_KEYS[tag?.name] || !Number.isFinite(tag.value) || tag.value < 0) throw new Error('圣遗物词条数据无效')
        return [STAT_KEYS[tag.name], tag.value * (FLAT.has(tag.name) ? 1 : 100)]
    }
    if (pos < 0) throw new Error('圣遗物部位无效')
    const [mainKey, mainValue] = convert(item.mainTag)
    return { pos, mainKey, mainValue, subs: Object.fromEntries(item.normalTags.map(convert)), setName: item.setName }
}

export function scoreRanking(item) {
    const a = toScoreArtifact(item)
    if (!a) return { score: 0, characters: [] }
    return analyzeArtifact({ pos: a.pos, main: a.mainKey, value: a.mainValue, subs: a.subs }, { topN: 1000 })
}

export function scoreBuild(items, context) {
    const artifacts = items.filter(Boolean).map(toScoreArtifact)
    if (!context?.name || !Object.hasOwn(data.usefulAttr, context.name)) {
        return { supported: false, title: '暂无该角色的评分规则', artifacts: [], total: null, grade: '待适配', count: artifacts.length }
    }
    const evaluator = createScoreEvaluator(context.name, artifacts, context.options || {})
    const scores = artifacts.map(a => {
        const raw = evaluator.score(a)
        return { pos: a.pos, score: round(raw), grade: getMarkClass(raw) }
    })
    const total = round(scores.reduce((s, a) => s + a.score, 0))
    const complete = artifacts.length === 5 && new Set(artifacts.map(a => a.pos)).size === 5
    return { supported: true, title: evaluator.title, artifacts: scores, total, average: round(total / 5),
        grade: complete ? getMarkClass(total / 5) : '未齐装', count: artifacts.length, complete }
}

export function scoreDetails(item, context, equipped = []) {
    const a = toScoreArtifact(item)
    if (!a || !context?.name || !Object.hasOwn(data.usefulAttr, context.name)) return null
    // Candidate replaces the same slot while all other build conditions stay fixed.
    const fullSet = equipped.filter(x => x && x.position !== item.position).map(toScoreArtifact).concat(a)
    const evaluator = createScoreEvaluator(context.name, fullSet, context.options || {})
    const main = evaluator.score({ ...a, subs: {} })
    const raw = evaluator.score(a)
    return { title: evaluator.title, score: round(raw), grade: getMarkClass(raw), main: round(main),
        subs: item.normalTags.map(tag => ({ name: tag.name, value: tag.value,
            score: round(evaluator.score({ ...a, subs: { [STAT_KEYS[tag.name]]: a.subs[STAT_KEYS[tag.name]] } }) - main) })) }
}

export function rankingContext(name) {
    const traveler = name.match(/^旅行者（(.+)）$/)
    const elements = { 风: 'anemo', 岩: 'geo', 雷: 'electro', 草: 'dendro', 水: 'hydro', 火: 'pyro', 冰: 'cryo' }
    return { name: traveler ? '旅行者' : name, label: name,
        options: { elem: traveler ? elements[traveler[1]] : data.charElemMap[name] || '' } }
}

// Preserve percent units expected by miao (31.1, not 0.311).
export function panelScoreAttributes(panel = {}) {
    const sum = key => Object.values(panel[key] || {}).reduce((a, b) => a + Number(b || 0), 0)
    return { hp: sum('hp'), atk: sum('atk'), def: sum('def'), mastery: sum('elemental_mastery'),
        cpct: sum('critical') * 100, cdmg: sum('critical_damage') * 100, recharge: sum('recharge') * 100 }
}

export function scoreSetNames(items, sets, locale) {
    const counts = new Map()
    for (const item of items.filter(Boolean)) {
        if (!counts.has(item.setName)) counts.set(item.setName, new Set())
        counts.get(item.setName).add(item.position)
    }
    const names = []
    for (const [key, positions] of counts) {
        if (positions.size < 4) continue
        const name = locale[sets[key]?.nameLocale] || key
        names.push(name)
        if (name === '绝缘之旗印') names.push('绝缘')
    }
    return names
}
