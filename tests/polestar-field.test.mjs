import test from 'node:test'
import assert from 'node:assert/strict'
import { POLESTAR_FIELD, polestarFieldState, updatePolestarField } from '../src/algorithms/polestar-field.mjs'
import characters from '../src/assets/_gen_character.js'
import {api, named} from '../beta-tools/runtime.mjs'
import {fixture} from '../beta-tools/interface-audit-7108.mjs'

test('桑多涅星超导只读取极星辉域，旧预设和旧 DSL 不重复叠加', () => {
    assert.deepEqual(characters.Sandrone.configSkill.map(field => field.name),
        ['c2_ray_stacks', 'prism_overcharge', 'burst_tactics_stacks'])
    const input = fixture('Sandrone')
    input.skill.index = 5
    const config = input.skill.config.Sandrone
    const dsl = 'dmg hit = Sandrone.ChargedRayStellar({c2_ray_stacks:0, prism_overcharge:false, burst_tactics_stacks:0, stellarconduct_hits:8})\nresult = hit.direct_stellarconduct.e\nprint(result)'
    for (const [enabled, stacks, coefficient] of [[false, 8, 1], [true, 8, 1.79], [true, 12, 2]]) {
        input.buffs = [{...named(POLESTAR_FIELD, {stacks}), lock: !enabled}]
        delete config.stellarconduct_hits
        const fresh = api.CalculatorInterface.get_damage_analysis(input, null)
        assert.equal(fresh.direct_stellarconduct_base_multiplier, coefficient)
        config.stellarconduct_hits = 8
        const legacy = api.CalculatorInterface.get_damage_analysis(input, null)
        assert.deepEqual(legacy.direct_stellarconduct, fresh.direct_stellarconduct)
        assert.equal(config.stellarconduct_hits, 8)
        const result = api.DSLInterface.run(dsl, input, input.artifacts)
        assert.equal(result.is_error, false, result.error_msg)
        const expected = fresh.direct_stellarconduct.expectation
        assert.ok(Math.abs(Number(result.output.trim().replace('MONA: ', '')) - expected) < 1e-6)
        const target_function = {name: 'SandroneDefault', params: 'NoConfig', use_dsl: true, dsl_source: dsl}
        const [best] = api.OptimizeSingleWasm.optimize({...input, target_function, algorithm: 'Naive', constraint: null, filter: null}, input.artifacts)
        assert.ok(Math.abs(best.value - expected) < 1e-6)
    }
})

test('polestar control uses native preset config and preserves other buffs and stacks when disabled', () => {
    const other = { id: 1, name: 'other', config: 'NoConfig', lock: false }
    const original = [other]
    let buffs = updatePolestarField(original, { enabled: true, stacks: 6 }, () => 2)
    assert.deepEqual(original, [other])
    assert.deepEqual(polestarFieldState(buffs), { enabled: true, stacks: 6 })
    assert.deepEqual(buffs[1].config, { ResonancePolestarField: { stacks: 6 } })
    buffs = updatePolestarField(buffs, { enabled: false }, () => 3)
    assert.deepEqual(polestarFieldState(buffs), { enabled: false, stacks: 6 })
    assert.deepEqual(buffs.filter(b => !b.lock), [other])
    buffs = updatePolestarField(JSON.parse(JSON.stringify(buffs)), { enabled: true }, () => 3)
    assert.deepEqual(polestarFieldState(buffs), { enabled: true, stacks: 6 })
    assert.equal(buffs[1].id, 2)
    assert.throws(() => updatePolestarField(buffs, { stacks: 13 }, () => 3), /0～12/)
    assert.throws(() => updatePolestarField(buffs, { stacks: NaN }, () => 3), /0～12/)
})

test('editing an existing picker/preset resonance collapses duplicates instead of adding damage twice', () => {
    const buffs = [
        { id: 1, name: POLESTAR_FIELD, lock: true, config: { [POLESTAR_FIELD]: { stacks: 2 } } },
        { id: 2, name: POLESTAR_FIELD, lock: false, config: { [POLESTAR_FIELD]: { stacks: 9 } } },
    ]
    assert.deepEqual(polestarFieldState(buffs), { enabled: true, stacks: 9 })
    const result = updatePolestarField(buffs, { stacks: 12 }, () => 3)
    assert.equal(result.length, 1); assert.equal(result[0].id, 2)
    assert.deepEqual(polestarFieldState(result), { enabled: true, stacks: 12 })
})
