import test from 'node:test'
import assert from 'node:assert/strict'
import {reactive, ref} from 'vue'
import {api, named} from '../beta-tools/runtime.mjs'
import {fixture} from '../beta-tools/interface-audit-7108.mjs'
import {singleCalculatorInputs} from './helpers/single-calculator-inputs.mjs'

test('Sandrone charged ray uses the same Shadow crit coverage for search and final damage', () => {
    const character = fixture('Sandrone')
    character.skill.index = 5
    character.buffs = reactive([named('YaeMikoC1', {effect_active: true, stellar_conduct: true})])
    character.target_function = {name: 'SandroneDefault', params: 'NoConfig', use_dsl: true,
        dsl_source: 'dmg hit = Sandrone.ChargedRayStellar\nresult = hit.direct_stellarconduct.e\nprint(result)'}
    const gear = character.artifacts.map(piece => ({...piece, set_name: 'DisenchantmentInDeepShadow'}))
    const mode = ref('auto')
    const manual = ref({config_disenchantment_in_deep_shadow: {rate: 0.5}})
    const inputs = singleCalculatorInputs(character, gear, manual, mode)
    function check(crit) {
        const hit = api.CalculatorInterface.get_damage_analysis(inputs.preview.value, null)
        assert.equal(hit.critical['影中沉凝的幻灭4'], crit)
        assert.equal(hit.direct_stellarconduct_compose['影中沉凝的幻灭4'], 0.4)
        const [result] = api.OptimizeSingleWasm.optimize({...inputs.optimize(), algorithm: 'Naive', constraint: null, filter: null}, gear)
        assert.ok(Math.abs(result.value - hit.direct_stellarconduct.expectation) < 1e-5)
    }
    check(0.16)
    character.buffs.pop()
    check(0)
    mode.value = 'custom'
    check(0.08)
})
