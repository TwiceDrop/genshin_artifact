import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { damageComparison } from '../src/algorithms/damage-comparison.mjs'
import {
    ADDITIONAL_DAMAGE_REACTIONS,
    damageReactionLabel,
    damageReactionOptions,
    defaultDamageReaction,
    stellarDamageResults,
} from '../src/algorithms/reaction-labels.mjs'

const damage = expectation => ({ expectation, critical: expectation * 1.5, non_critical: expectation * .75 })

test('stellar reaction and direct skill choices have distinct Chinese names', () => {
    const analysis = {
        normal: damage(100),
        stellarswirl_anemo: damage(300),
        stellarswirl_cryo: damage(500),
        stellarconduct: damage(200),
        direct_stellarconduct: damage(400),
        direct_stellarswirl: damage(800),
        incomplete: { critical: 123 },
    }
    const labels = Object.fromEntries(damageReactionOptions(analysis).map(item => [item.key, item.label]))
    assert.equal(labels.stellarswirl_anemo, '反应星扩散·风')
    assert.equal(labels.stellarswirl_cryo, '反应星扩散·冰')
    assert.equal(labels.stellarconduct, '反应星超导')
    assert.equal(labels.direct_stellarconduct, '直接星超导')
    assert.equal(labels.direct_stellarswirl, '直接星扩散')
    assert.equal(labels.incomplete, undefined)
    assert.equal(defaultDamageReaction(analysis), 'direct_stellarswirl')
})

test('curve keeps valid stellarconduct preference and ignores unavailable direct stellar results', () => {
    assert.equal(defaultDamageReaction({ normal: damage(100), direct_stellarconduct: damage(300), direct_stellarswirl: damage(0) }), 'direct_stellarconduct')
    assert.equal(defaultDamageReaction({ normal: damage(100), direct_stellarswirl: damage(NaN), direct_stellarconduct: damage(0), stellarswirl_cryo: damage(400) }), 'normal')
    assert.equal(defaultDamageReaction({ normal: damage(0), vaporize: damage(200) }), 'vaporize')
    assert.equal(defaultDamageReaction({ normal: damage(0) }), 'normal')
    assert.equal(defaultDamageReaction({}), '')
})

test('unknown future results receive a Chinese fallback without exposing raw field names', () => {
    assert.deepEqual(damageReactionOptions({ new_reaction: damage(20) }), [{ key: 'new_reaction', label: '其他伤害' }])
    assert.equal(damageReactionLabel('new_reaction'), '其他伤害')
    assert.deepEqual(damageReactionOptions(null), [])
})

function componentOptions(path) {
    const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
    const script = descriptor.script.content.replace(/^import .*$/gm, '').replace('export default', 'return')
    return new Function('damageComparison', 'ADDITIONAL_DAMAGE_REACTIONS', 'damageReactionLabel', 'stellarDamageResults', 'defaultDamageReaction', 'DamageAnalysisUtil', 'LEVEL_MULTIPLIER', script)(
        damageComparison, ADDITIONAL_DAMAGE_REACTIONS, damageReactionLabel, stellarDamageResults, defaultDamageReaction, {}, [],
    )
}

test('damage table renders reaction stellar rows, direct labels, and baseline comparisons', () => {
    const component = componentOptions('../src/pages/NewArtifactPlanPage/DamagePanel.vue')
    const analysis = { normal: damage(100), stellarswirl_anemo: damage(300), stellarswirl_cryo: damage(500), stellarconduct: damage(200), direct_stellarswirl: damage(800) }
    const rows = component.computed.tableData.call({
        analysisFromWasm: analysis,
        baseline: { stellarswirl_anemo: damage(150) },
        normalDamageTitle: '风元素伤害',
        t: key => key,
    })
    assert.deepEqual(rows.map(row => row.name), ['风元素伤害', '反应星超导', '反应星扩散·风', '反应星扩散·冰', '直接星扩散'])
    assert.deepEqual(rows.find(row => row.name === '反应星扩散·风').expectation, damageComparison(300, 150))
    assert.equal(rows.find(row => row.name === '直接星扩散').expectation.current, damageComparison(800).current)
})

test('detail panel preserves stellar results and clears them when opening another skill', () => {
    const component = componentOptions('../src/components/display/DamageAnalysis/DamageAnalysis.vue')
    const state = { ...component.data() }
    const analysis = { element: 'Anemo', normal: damage(100), direct_stellarswirl: damage(800), stellarswirl_cryo: damage(500) }
    component.methods.setValue.call(state, analysis)
    assert.equal(state.damageType, 'direct_stellarswirl')
    assert.deepEqual(component.computed.selectedStellarResult.call(state), { key: 'direct_stellarswirl', label: '直接星扩散', ...damage(800) })
    state.damageType = 'stellarswirl_cryo'
    assert.equal(component.computed.selectedStellarResult.call(state).expectation, 500)
    component.methods.setValue.call(state, { element: 'Pyro', normal: damage(200) })
    assert.equal(state.damageType, 'normal')
    assert.deepEqual(state.stellarResults, [])
    assert.equal(component.computed.selectedStellarResult.call(state), undefined)
})

for (const path of [
    '../src/pages/NewArtifactPlanPage/DamagePanel.vue',
    '../src/components/display/OptimalStatGainCurve.vue',
    '../src/components/display/DamageAnalysis/DamageAnalysis.vue',
]) {
    test('Vue script and template compile: ' + path, () => {
        const source = readFileSync(new URL(path, import.meta.url), 'utf8')
        const { descriptor, errors } = parse(source)
        assert.deepEqual(errors, [])
        const script = compileScript(descriptor, { id: path })
        const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } })
        assert.deepEqual(template.errors, [])
    })
}
