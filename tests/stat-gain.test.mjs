import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { computeCurve, createDamageEvaluator, combinationCount, rollValue, STATS } from '../src/algorithms/stat-gain/curve.mjs'
import { updatePolestarField } from '../src/algorithms/polestar-field.mjs'

test('0–20 independently exact budgets, including a non-greedy optimum', () => {
    const score = ({ CriticalRate: a, CriticalDamage: b }) => 100 + a * 10 + (b >= 2 ? 100 : b)
    const result = computeCurve(score, { stats: ['CriticalRate', 'CriticalDamage'], maxRolls: 20 })
    assert.equal(result.points.length, 21)
    assert.deepEqual(result.points[1].allocation, { CriticalRate: 1, CriticalDamage: 0 })
    assert.deepEqual(result.points[2].allocation, { CriticalRate: 0, CriticalDamage: 2 })
    for (const p of result.points) {
        const expected = Math.max(...Array.from({ length: p.rolls + 1 }, (_, a) => score({ CriticalRate: a, CriticalDamage: p.rolls - a })))
        assert.equal(p.damage, expected)
        assert.equal(Object.values(p.allocation).reduce((a, b) => a + b, 0), p.rolls)
        assert.equal(p.gain, p.rolls === 0 ? 0 : p.damage / result.baseline - 1)
        if (p.rolls) assert.equal(p.marginal, p.damage - result.points[p.rolls - 1].damage)
    }
    assert.equal(result.evaluations, combinationCount(20, 2))
})

test('four-stat count and zero baseline do not fabricate percentages', () => {
    const result = computeCurve(a => Object.values(a).reduce((x, y) => x + y, 0), { stats: STATS.slice(0, 4).map(s => s.key) })
    assert.equal(result.evaluations, 10626)
    assert.equal(result.points[20].damage, 20)
    assert.ok(result.points.every(p => p.gain === null))
})

test('reject invalid options and non-finite damage instead of showing partial success', () => {
    assert.throws(() => computeCurve(() => 1, { stats: [] }), /属性/)
    assert.throws(() => computeCurve(() => 1, { stats: ['CriticalRate', 'CriticalRate'] }), /重复/)
    assert.throws(() => computeCurve(() => 1, { stats: STATS.map(s => s.key) }), /100 万/)
    assert.throws(() => computeCurve(() => Infinity, { stats: ['CriticalRate'] }), /无效/)
    assert.throws(() => computeCurve(() => 1, { stats: ['CriticalRate'], maxRolls: 21 }), /1～20/)
    assert.equal(rollValue(STATS[0], 'average'), .033)
    assert.equal(rollValue(STATS[0], 'max'), .039)
})

test('every evaluation keeps inventory, four-piece sets, buffs, skill and enemy intact', () => {
    const input = { artifacts: Array.from({ length: 5 }, (_, i) => ({ id: i, set_name: i < 4 ? 'ScarletProof' : 'HeartOfTheFurnace', main_stat: ['HPFixed', 4780], sub_stats: [['CriticalRate', .1]] })), buffs: [{ name: 'test' }], skill: { index: 5 }, enemy: { level: 100 } }
    const before = JSON.stringify(input)
    let seen
    const mona = { CalculatorInterface: { get_damage_analysis: config => { seen = structuredClone(config); return { normal: { expectation: config.artifacts[0].sub_stats.reduce((s, [, v]) => s + v, 0) } } } } }
    const evaluate = createDamageEvaluator(mona, input, 'normal', 'None', ['CriticalRate'], 'max').evaluate
    assert.equal(evaluate({ CriticalRate: 2 }), .178)
    assert.equal(seen.artifacts.length, 5)
    assert.equal(seen.artifacts.filter(a => a.set_name === 'ScarletProof').length, 4)
    assert.deepEqual(seen.buffs, input.buffs)
    assert.deepEqual(seen.skill, input.skill)
    assert.deepEqual(seen.enemy, input.enemy)
    assert.equal(evaluate({ CriticalRate: 0 }), .1)
    assert.equal(JSON.stringify(input), before)
})

const wasmPath = new URL('../mona_wasm/pkg/mona_wasm_bg.wasm', import.meta.url)
test('published Mona core: Sandrone stellar ray, four-piece set and mixed-roll optimum', { skip: !fs.existsSync(wasmPath) }, async () => {
    const { bindings } = await import('../mona_wasm/pkg/bindings.js')
    const bridge = await import('../mona_wasm/pkg/mona_wasm_bg.js')
    const instance = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasmPath)), { './mona_wasm_bg.js': bridge })
    bindings.lI(instance.exports)
    const mona = { CalculatorInterface: bindings.K2, CommonInterface: bindings.Ps }
    const input = {
        character: { name: 'Sandrone', level: 90, ascend: true, constellation: 0, skill1: 9, skill2: 9, skill3: 9, params: { Sandrone: { stellar_base_active: true, em_conversion_active: true, c1_team_stellar: true, c6_elevate_active: true } } },
        weapon: { name: 'WasterGreatsword', level: 1, ascend: false, refine: 1, params: 'NoConfig' },
        skill: { index: 5, config: { Sandrone: { c2_ray_stacks: 0, prism_overcharge: false, burst_tactics_stacks: 0, stellarconduct_hits: 0 } } },
        buffs: [], artifacts: ['Flower', 'Feather', 'Sand', 'Goblet'].map((slot, i) => ({ set_name: 'ScarletProof', slot, level: 20, star: 5, main_stat: ['HPFixed', 0], sub_stats: [], id: i })), artifact_config: null, enemy: null,
    }
    const original = JSON.stringify(input)
    const stats = ['CriticalRate', 'CriticalDamage', 'ATKPercentage', 'ElementalMastery']
    const evaluator = createDamageEvaluator(mona, input, 'direct_stellarconduct', null, stats, 'average')
    const baseline = mona.CalculatorInterface.get_damage_analysis(input, null).direct_stellarconduct.expectation
    assert.ok(baseline > 0)
    const start = performance.now()
    const result = computeCurve(evaluator.evaluate, { stats, maxRolls: 20, tier: 'average' })
    assert.equal(result.baseline, baseline)
    assert.equal(result.evaluations, 10626)
    assert.ok(result.points[20].damage > baseline)
    for (const p of result.points) assert.ok(Math.abs(p.damage - evaluator.evaluate(p.allocation)) <= Math.max(1, p.damage) * 1e-12)
    const oneStatCandidates = stats.map(key => evaluator.evaluate(Object.fromEntries(stats.map(k => [k, key === k ? 20 : 0]))))
    assert.ok(result.points[20].damage >= Math.max(...oneStatCandidates))
    assert.equal(JSON.stringify(input), original)
    const fieldDamages = [0, 6, 12].map(stacks => {
        const fieldBuffs = updatePolestarField([], { enabled: true, stacks }, () => 1)
        const configured = { ...input, buffs: fieldBuffs.filter(b => !b.lock).map(({ name, config }) => ({ name, config })) }
        const nativeDamage = mona.CalculatorInterface.get_damage_analysis(configured, null).direct_stellarconduct.expectation
        const fieldCurve = computeCurve(createDamageEvaluator(mona, configured, 'direct_stellarconduct', null, ['CriticalRate'], 'average').evaluate, { stats: ['CriticalRate'], maxRolls: 1 })
        assert.equal(fieldCurve.baseline, nativeDamage)
        return nativeDamage
    })
    assert.ok(fieldDamages[1] > fieldDamages[0]); assert.ok(fieldDamages[2] > fieldDamages[1])
    assert.equal(JSON.stringify(input), original)
    console.log(`Polestar field 0/6/12 stacks: ${fieldDamages.map(n => n.toFixed(2)).join(' / ')}`)
    console.log(`Sandrone exact curve: ${baseline.toFixed(2)} -> ${result.points[20].damage.toFixed(2)}, ${result.evaluations} combinations in ${(performance.now() - start).toFixed(0)} ms`)
})
