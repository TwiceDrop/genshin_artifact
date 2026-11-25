import test from 'node:test'
import assert from 'node:assert/strict'
import { api, sum } from '../beta-tools/runtime.mjs'
import { buffs, fixture, optimizer } from '../beta-tools/interface-audit-7108.mjs'
import { normalizeEnemy } from '../beta-data/enemy-interface.mjs'
import { availableCharacterBuffs, bindBuffConfig, groupCharacterBuffs } from '../src/algorithms/buff-groups/index.mjs'
import rules from '../src/algorithms/buff-groups/ownership.json' with { type: 'json' }

const hit = input => api.CalculatorInterface.get_damage_analysis(input, null)
const ring = { name: 'MavuikaC2', config: 'NoConfig' }
const retiredScorchingRing = { name: 'MavuikaC6', config: 'NoConfig' }
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`)

test('the character BUFF picker unlocks Mavuika’s ring at C2 and grants 20% DEF reduction', () => {
    const group = groupCharacterBuffs(Object.values(buffs), rules).find(g => g.character === 'Mavuika')
    const available = constellation => availableCharacterBuffs(group.buffs, rules, { constellation })
    assert.ok(!available(1).some(buff => buff.name === ring.name))
    const buff = available(2).find(buff => buff.name === ring.name)
    assert.ok(buff, 'Mavuika’s ring should be selectable at C2')
    assert.ok(available(6).includes(buff))
    assert.equal(buffs[retiredScorchingRing.name], undefined)
    const entry = { name: buff.name, config: bindBuffConfig(buff, { constellation: 2 }) }

    const input = fixture('Kaeya')
    input.enemy = normalizeEnemy({ level: 90 })
    const base = hit(input)
    const reduced = hit({ ...input, buffs: [entry, entry] })
    near(sum(reduced.def_minus), .2)
    near(reduced.normal.expectation / base.normal.expectation, 2 / 1.8)
    near(hit({ ...input, buffs: [{ ...entry, lock: true }] }).normal.expectation, base.normal.expectation)
})

test('Mavuika’s C2 settings and manual ring BUFF count the same DEF reduction once', () => {
    const input = fixture('Mavuika')
    input.character.constellation = 2
    for (const rate of [0, .5, 1]) {
        input.character.params.Mavuika.c2_def_minus_rate = rate
        near(sum(hit(input).def_minus), .2 * rate)
        near(sum(hit({ ...input, buffs: [ring] }).def_minus), .2)
    }
    const explicit = hit({ ...input, buffs: [ring], single_hit_context: { panel: { ATK: 1000 }, resistanceBeforeBuffs: 0 } })
    near(explicit.single_hit.non_critical, 1000 / 1.8)
})

test('C6 Scorching Ring uses Mavuika’s character setting and old manual entries have no effect', () => {
    const teammate = fixture('Kaeya')
    const legacy = { ...teammate, buffs: [retiredScorchingRing] }
    assert.deepEqual(hit(legacy), hit(teammate))
    near(sum(hit({ ...legacy, buffs: [retiredScorchingRing, ring] }).def_minus), .2)

    const self = fixture('Mavuika')
    self.character.constellation = 6
    self.buffs = [retiredScorchingRing]
    for (const rate of [0, .5, 1]) {
        self.character.params.Mavuika.c6_def_minus_rate = rate
        near(sum(hit(self).def_minus), .2 * rate)
    }
    near(sum(hit({ ...self, buffs: [ring] }).def_minus), .2)
})

test('the ring reaches the shared DSL, optimizer and stat gain paths', () => {
    const input = fixture('Kaeya')
    input.enemy = normalizeEnemy({ level: 90 })
    const expected = hit(input).normal.expectation * 2 / 1.8
    input.buffs = [ring]
    const source = 'dmg hit = Kaeya.Normal1\nresult = hit.normal.e'
    input.target_function = { ...input.target_function, use_dsl: true, dsl_source: source }
    const dsl = api.DSLInterface.run(source + '\nprint(result)', input, input.artifacts)
    assert.equal(dsl.is_error, false, dsl.error_msg)
    near(Number(dsl.output.trim().replace(/^MONA: /, '')), expected)
    near(api.OptimizeSingleWasm.optimize(optimizer(input), input.artifacts)[0].value, expected)

    const manual = { ...input, buffs: [{ name: 'DEFMinus', config: { DEFMinus: { p: 20 } } }] }
    assert.deepEqual(api.CommonInterface.get_attribute(input), api.CommonInterface.get_attribute(manual))
    const gain = row => api.BonusPerStat.bonus_per_stat({ ...row, tf: row.target_function, artifacts_config: row.artifact_config })
    assert.deepEqual(gain(input), gain(manual))
})
