// MIT. Normalization follows miao-plugin's ArtisMark/ArtisMarkCfg and extra.js.
// Upstream revision and local compatibility conventions: see README.md here.
import { usefulAttr as upstreamWeights } from './weights.mjs'
import rules from './rules.mjs'
import facts from './character-facts.mjs'

const { baseAttrMap, charElemMap } = facts
const usefulAttr = Object.fromEntries(Object.entries(upstreamWeights).filter(([name]) => name in baseAttrMap))
const elements = { pyro: '火', hydro: '水', anemo: '风', electro: '雷', dendro: '草', cryo: '冰', geo: '岩' }
const elementKey = key => Object.keys(elements).find(e => e === key || elements[e] === key)
const ratios = { atk: 1.5, atkPlus: 5, def: 1.875, defPlus: 6, hp: 1.5, hpPlus: 76.875,
    cpct: 1, cdmg: 2, mastery: 6, recharge: 1 / .6, dmg: 1.5, phy: 1.875, heal: 1.5 / 1.3 }
const titles = ['大攻击', '小攻击', '大防御', '小防御', '大生命', '小生命', '暴击率', '暴击伤害', '元素精通', '充能效率', '元素伤害', '物伤加成', '治疗加成']
const attrMap = Object.fromEntries(Object.entries(ratios).map(([key, ratio], i) => [key, {
    value: 3.885 * ratio, title: titles[i], base: { hpPlus: 'hp', atkPlus: 'atk', defPlus: 'def' }[key]
}]))
const mainOptions = [[], [], ['atk', 'def', 'hp', 'mastery', 'recharge'], ['atk', 'def', 'hp', 'mastery', 'dmg', 'phy'], ['atk', 'def', 'hp', 'mastery', 'heal', 'cpct', 'cdmg']]
const subOptions = ['atk', 'atkPlus', 'def', 'defPlus', 'hp', 'hpPlus', 'mastery', 'recharge', 'cpct', 'cdmg']
const weaponCfg = {
    磐岩结绿: { attr: 'hp', abbr: '绿剑', max: 30, min: 15 }, 猎人之径: { attr: 'mastery' },
    薙草之稻光: { attr: 'recharge', abbr: '薙刀' }, 护摩之杖: { attr: 'hp', abbr: '护摩', max: 18, min: 10 }
}
const rounded = x => Math.round(x * 10) / 10
export function getMarkClass(score) {
    return ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'ACE', 'MAX'][Math.max(0, Math.min(8, Math.floor(score / 7)))]
}

function resolveWeights(name, artifacts, options) {
    const weapon = { ...options.weapon, name: options.weaponName || options.weapon?.name || '', affix: options.weaponAffix ?? options.weapon?.affix ?? 1 }
    const sets = options.artisSets || []
    const slots = Object.fromEntries(artifacts.map((a, i) => [String((a.pos ?? i) + 1), { ...a, main: { key: a.mainKey, value: a.mainValue } }]))
    const artis = { ...options.artis, names: options.artis?.names || sets, artis: options.artis?.artis || slots,
        is(query, position) {
            return query.split(',').some(key => {
                if (position) {
                    const main = this.artis[String(position)]?.main?.key
                    return key === 'dmg' ? main === 'dmg' || !!elementKey(main) : main === key
                }
                return sets.includes(key) || sets.includes(key.replace(/4$/, ''))
            })
        }
    }
    const def = (weights = usefulAttr[name], labels = []) => {
        const result = { ...weights }
        let title = labels.length ? `${name}-${labels.join('')}` : `${name}-通用`
        // Keep the existing app's named-build convention: named special builds
        // specify their final weights; unnamed builds receive weapon/set tuning.
        if (!labels.length) {
            const tune = weaponCfg[weapon.name]
            if (result.atk > 0 && tune && (result[tune.attr] || 0) < 100) {
                result[tune.attr] = Math.min(100, Math.round((result[tune.attr] || 0) + (tune.min || 10) + ((tune.max || 20) - (tune.min || 10)) * (weapon.affix - 1) / 4))
                title = `${tune.abbr || weapon.name}加成`
            }
            if (artis.is('绝缘4') && result.recharge > 0) {
                const highest = Math.max(...['atk', 'hp', 'def', 'mastery'].map(k => result[k] || 0))
                if (result.recharge < highest) { result.recharge = Math.min(highest, 75); title = title.endsWith('-通用') ? '绝缘4' : title + '+绝缘4' }
            }
            if (/^西风(长枪|大剑|剑|猎弓|秘典)$/.test(weapon.name) && (result.cpct || 0) < 100) {
                result.cpct = 100; title = title.endsWith('-通用') ? '西风' : title + '+西风'
            }
        }
        return { title, attrWeight: result }
    }
    const attr = { cpct: 0, cdmg: 0, mastery: 0, ...options.charAttrs }
    // Preserve this app's default Mavuika reaction build (an explicit local rule).
    if (name === '玛薇卡') {
        const weights = { ...usefulAttr[name], mastery: 100 }
        const pure = attr.mastery > 0 && attr.mastery < 40
        if (pure) Object.assign(weights, { atk: 85, mastery: 0 })
        return { title: pure ? '玛薇卡-纯火/超载' : '玛薇卡-精通', attrWeight: weights }
    }
    return rules[name]?.({ attr, artis, weapon, cons: options.cons || 0, elem: options.elem || '', def,
        rule: (title, attrWeight) => ({ title, attrWeight }) }) || def()
}

export function createScoreEvaluator(name, artifacts = [], options = {}) {
    const { title, attrWeight } = resolveWeights(name, artifacts, options)
    const base = baseAttrMap[name] || { hp: 14000, atk: 230, def: 700 }
    const effective = {}
    for (const [key, meta] of Object.entries(attrMap)) {
        const weight = attrWeight[meta.base || key] || 0
        if (!weight) continue
        const coefficient = meta.base ? weight / attrMap[meta.base].value * 100 / ((base[meta.base] || 1) + (meta.base === 'atk' ? 520 : 0)) : weight / meta.value
        effective[key] = { weight, coefficient, normalized: coefficient * meta.value }
    }
    const best = (keys, exclude) => keys.filter(k => k !== exclude && effective[k]).sort((a, b) => effective[b].normalized - effective[a].normalized)
    const limits = mainOptions.map((keys, pos) => {
        const main = pos < 2 ? ['hpPlus', 'atkPlus'][pos] : best(keys)[0]
        const mainWeight = pos < 2 ? 0 : effective[main]?.normalized || 0
        const subs = best(subOptions, main).slice(0, 4)
        return { mainWeight, limit: 2 * mainWeight + subs.reduce((sum, key, i) => sum + effective[key].normalized * (i === 0 ? 6 : 1), 0) }
    })
    return { title, weights: attrWeight, score(a) {
        if (!a?.mainKey || !limits[a.pos]?.limit) return 0
        const { mainWeight, limit } = limits[a.pos]
        let value = 0, factor = 1, key = a.mainKey
        if (a.pos >= 2) {
            if (key !== 'recharge') {
                if (a.pos === 3 && (elementKey(options.elem) && elementKey(options.elem) === elementKey(key) || options.charId === 10000128)) key = 'dmg'
                const weight = effective[key]?.weight || 0
                if (mainWeight > 0) factor = Math.max(0, Math.min(1, weight / mainWeight))
                if (['atk', 'hp', 'def'].includes(key) && weight >= 75) factor = 1
            }
            value += (effective[key]?.coefficient || 0) * (a.mainValue || 0) / 4
        }
        for (const [sub, amount] of Object.entries(a.subs || {})) value += (effective[sub]?.coefficient || 0) * amount
        return 66 * value / limit * (1 + factor) / 2
    } }
}
export function calcArtifactScore(name, artifacts = [], options = {}) {
    const evaluator = createScoreEvaluator(name, artifacts, options)
    const scored = artifacts.map((a, i) => {
        const pos = a.pos ?? i, raw = evaluator.score({ ...a, pos })
        return { ...a, pos, score: rounded(raw), grade: getMarkClass(raw) }
    })
    const sum = scored.reduce((s, a) => s + a.score, 0), average = scored.length ? sum / scored.length : 0
    return { charName: name, title: evaluator.title, artifacts: scored, totalScore: rounded(sum), avgScore: rounded(average), totalGrade: getMarkClass(average) }
}
export const quickScore = (name, artifacts, options) => calcArtifactScore(name, artifacts, options).totalScore
export function analyzeArtifact(item, options = {}) {
    const a = { pos: item.pos ?? 0, mainKey: item.main, mainValue: item.value, subs: item.subs }
    const characters = Object.keys(usefulAttr).map(name => {
        const variants = name === '旅行者' ? options.travelerElem && elements[options.travelerElem] ? [options.travelerElem] : Object.keys(elements) : [charElemMap[name]]
        return variants.map(elem => ({ name: name === '旅行者' ? `旅行者（${elements[elem]}）` : name,
            score: rounded(createScoreEvaluator(name, [a], { elem }).score(a)) })).sort((x, y) => y.score - x.score)[0]
    }).sort((a, b) => b.score - a.score)
    const top = characters.slice(0, Math.ceil(characters.length / 2))
    return { score: top.length ? rounded(top.reduce((sum, row) => sum + row.score, 0) / top.length) : 0,
        characters: characters.slice(0, options.topN ?? 10) }
}
export default { usefulAttr, charElemMap, attrMap, weaponCfg, calcArtifactScore, quickScore, analyzeArtifact, getMarkClass }
