import test from 'node:test'
import assert from 'node:assert/strict'
import data, { calcArtifactScore } from '../src/algorithms/artifact-score/vendor/miao.mjs'
import { toScoreArtifact, scoreRanking, scoreBuild, scoreDetails, getMarkClass, panelScoreAttributes, scoreSetNames, rankingContext } from '../src/algorithms/artifact-score/score.mjs'

const piece = (position = 'flower', mainTag = { name: 'lifeStatic', value: 4780 }) => ({
    position, mainTag, star: 5, level: 20, setName: 'test',
    normalTags: [{ name: 'critical', value: .105 }, { name: 'criticalDamage', value: .218 },
        { name: 'attackPercentage', value: .058 }, { name: 'elementalMastery', value: 23 }]
})
const five = [piece(), piece('feather', { name: 'attackStatic', value: 311 }),
    piece('sand', { name: 'recharge', value: .518 }), piece('cup', { name: 'iceBonus', value: .466 }),
    piece('head', { name: 'critical', value: .311 })]
// Circlet and its substats must not repeat its main stat.
five[4].normalTags[0] = { name: 'recharge', value: .117 }

test('Mona percent/fixed units and five positions map to the source scorer', () => {
    const a = toScoreArtifact(piece())
    assert.equal(a.mainValue, 4780)
    assert.equal(a.subs.cpct, 10.5)
    assert.equal(a.subs.mastery, 23)
    assert.deepEqual(five.map(x => toScoreArtifact(x).pos), [0, 1, 2, 3, 4])
    assert.throws(() => toScoreArtifact({ ...piece(), position: 'unknown' }))
})

test('all supported default builds and ranked scores agree with the pinned scorer', () => {
    for (const name of Object.keys(data.usefulAttr)) {
        const context = rankingContext(name)
        const expected = calcArtifactScore(name, five.map(toScoreArtifact), context.options)
        const actual = scoreBuild(five, context)
        assert.equal(actual.total, expected.totalScore, name)
        assert.equal(actual.grade, expected.totalGrade, name)
    }
    const ranking = scoreRanking(five[3])
    assert.ok(ranking.characters.length > 100)
    for (const row of ranking.characters) {
        assert.equal(scoreDetails(five[3], rankingContext(row.name)).score, row.score, row.name)
    }
    assert.ok(ranking.characters.every((row, i, all) => i === 0 || all[i - 1].score >= row.score))
})

test('contextual per-piece breakdown sums to panel score without changing build rules', () => {
    const context = { name: '阿罗夏', options: { elem: 'electro', cons: 6, weaponName: '西风长枪', weaponAffix: 5,
        charAttrs: { cpct: 80, cdmg: 180, mastery: 100, recharge: 230 } } }
    const total = scoreBuild(five, context)
    for (const item of five) {
        const details = scoreDetails(item, context, five)
        assert.equal(details.score, total.artifacts.find(x => x.pos === toScoreArtifact(item).pos).score)
        assert.ok(Math.abs(details.main + details.subs.reduce((s, x) => s + x.score, 0) - details.score) < .3)
    }
    assert.equal(scoreDetails(five[0], context, five).main, 0)
    assert.equal(scoreDetails(five[1], context, five).main, 0)
})

test('graduation boundaries and incomplete/unknown characters are explicit', () => {
    for (const [n, grade] of [[27.99, 'A'], [28, 'S'], [35, 'SS'], [42, 'SSS'], [49, 'ACE'], [56, 'MAX']]) assert.equal(getMarkClass(n), grade)
    assert.equal(scoreBuild([five[0]], { name: '桑多涅' }).grade, '未齐装')
    assert.equal(scoreBuild([], { name: '桑多涅' }).total, 0)
    assert.equal(scoreBuild(five, { name: '未知角色' }).total, null)
    assert.equal(scoreBuild(Array(5).fill(five[0]), { name: '桑多涅' }).grade, '未齐装')
})

test('artifact score lookup works without Object.hasOwn on iPadOS 15.0', () => {
    const hasOwn = Object.hasOwn
    Object.hasOwn = undefined
    try {
        assert.equal(scoreBuild(five, { name: '桑多涅' }).supported, true)
        assert.ok(scoreDetails(five[0], { name: '桑多涅' }, five))
    } finally { Object.hasOwn = hasOwn }
})

test('Noelle missing goblet and non-damage goblet safely use her source rule', () => {
    const context = { name: '诺艾尔', options: { elem: 'geo', charAttrs: { cpct: 80, cdmg: 180, mastery: 100 } } }
    assert.match(scoreBuild([five[0]], context).title, /月结晶/)
    assert.match(scoreBuild([piece('cup', { name: 'defendPercentage', value: .583 })], context).title, /月结晶/)
    assert.doesNotMatch(scoreBuild([piece('cup', { name: 'rockBonus', value: .466 })], context).title, /月结晶/)
})

test('every character can be scored with high constellation and missing equipment', () => {
    for (const name of Object.keys(data.usefulAttr)) {
        const context = { name, options: { cons: 6, elem: data.charElemMap[name],
            charAttrs: { cpct: 100, cdmg: 250, mastery: 800, recharge: 300 } } }
        assert.doesNotThrow(() => scoreBuild([], context), name)
        assert.doesNotThrow(() => scoreDetails(five[0], context, [five[0]]), name)
    }
})

test('panel values and four-piece aliases preserve context', () => {
    assert.deepEqual(panelScoreAttributes({ critical: { base: .05, artifact: .5 }, recharge: { base: 1, weapon: .3 }, elemental_mastery: { artifact: 100 } }),
        { hp: 0, atk: 0, def: 0, mastery: 100, cpct: 55.00000000000001, cdmg: 0, recharge: 130 })
    const sets = { test: { nameLocale: 1 } }, locale = { 1: '绝缘之旗印' }
    assert.deepEqual(scoreSetNames(five.slice(0, 3), sets, locale), [])
    assert.deepEqual(scoreSetNames(five, sets, locale), ['绝缘之旗印', '绝缘'])
    assert.deepEqual(scoreSetNames(Array(4).fill(five[0]), sets, locale), [])
})
