import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { damageComparison } from '../src/algorithms/damage-comparison.mjs'
import { sameHitBaseline } from '../src/algorithms/single-result-comparison.mjs'
import * as stellarDetailHelpers from '../src/algorithms/stellar-detail.mjs'
import {
    damageReactionLabel,
    damageReactionOptions,
    defaultDamageReaction,
    visibleDamageReactionKeys,
} from '../src/algorithms/reaction-labels.mjs'

const damage = expectation => ({ expectation, critical: expectation * 1.5, non_critical: expectation * .75 })

test('only direct stellar skill choices remain', () => {
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
    assert.equal(labels.stellarswirl_anemo, undefined)
    assert.equal(labels.stellarswirl_cryo, undefined)
    assert.equal(labels.stellarconduct, undefined)
    assert.equal(labels.direct_stellarconduct, '直接星超导')
    assert.equal(labels.direct_stellarswirl, '直接星扩散')
    assert.equal(labels.incomplete, undefined)
    assert.equal(defaultDamageReaction(analysis), 'direct_stellarswirl')
})

test('curve keeps valid stellarconduct preference and ignores unavailable direct stellar results', () => {
    assert.equal(defaultDamageReaction({ normal: damage(100), direct_stellarconduct: damage(300), direct_stellarswirl: damage(0) }), 'direct_stellarconduct')
    assert.equal(defaultDamageReaction({ normal: damage(100), direct_stellarswirl: damage(NaN), direct_stellarconduct: damage(0), stellarswirl_cryo: damage(400) }), 'direct_stellarconduct')
    assert.equal(defaultDamageReaction({ normal: damage(0), vaporize: damage(200) }), 'vaporize')
    assert.equal(defaultDamageReaction({ normal: damage(0) }), 'normal')
    assert.equal(defaultDamageReaction({}), '')
})

test('unknown future results receive a Chinese fallback without exposing raw field names', () => {
    assert.deepEqual(damageReactionOptions({ new_reaction: damage(20) }), [])
    assert.equal(damageReactionLabel('new_reaction'), '其他伤害')
    assert.deepEqual(damageReactionOptions(null), [])
})

function componentOptions(path, dependencies) {
    const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
    const script = descriptor.script.content.replace(/^import .*$/gm, '').replace('export default', 'return')
    return new Function(...Object.keys(dependencies), script)(...Object.values(dependencies))
}

test('damage table excludes retired reactions while retaining direct labels and comparisons', () => {
    const component = componentOptions('../src/pages/NewArtifactPlanPage/DamagePanel.vue', {
        sameHitBaseline, damageComparison, damageReactionLabel, visibleDamageReactionKeys,
    })
    const analysis = { normal: damage(100), stellarswirl_anemo: damage(300), stellarswirl_cryo: damage(500), stellarconduct: damage(200), direct_stellarswirl: damage(800) }
    const context = {
        analysisFromWasm: analysis,
        visibleKeys: visibleDamageReactionKeys(analysis),
        baseline: { stellarswirl_anemo: damage(150) },
        normalDamageTitle: '风元素伤害',
        t: key => key,
    }
    const rows = component.computed.tableData.call(context)
    assert.deepEqual(rows.map(row => row.name), ['直接星扩散'])
    assert.deepEqual(rows[0].expectation, damageComparison(800))
    context.baseline = { direct_stellarswirl: damage(600) }
    assert.deepEqual(component.computed.tableData.call(context)[0].expectation, damageComparison(800, 600))
})

test('detail panel preserves stellar results and clears them when opening another skill', () => {
    const component = componentOptions('../src/components/display/DamageAnalysis/DamageAnalysis.vue', {
        ...stellarDetailHelpers, damageReactionOptions, defaultDamageReaction,
        DamageAnalysisUtil: {}, StellarDamageDetail: {},
    })
    const state = { ...component.data() }
    const analysis = { element: 'Anemo', normal: damage(100), direct_stellarswirl: damage(800), stellarswirl_cryo: damage(500) }
    component.methods.setValue.call(state, analysis)
    assert.equal(state.damageType, 'direct_stellarswirl')
    assert.deepEqual(Object.keys(state.stellarDetailStates), ['direct_stellarswirl'])
    assert.deepEqual(component.computed.selectedStellarResult.call(state), { key: 'direct_stellarswirl', label: '直接星扩散', ...damage(800), reason: undefined })
    state.damageType = 'stellarswirl_cryo'
    assert.equal(component.computed.selectedStellarResult.call(state), undefined)
    component.methods.setValue.call(state, { element: 'Pyro', normal: damage(200) })
    assert.equal(state.damageType, 'normal')
    assert.deepEqual(state.stellarResults, [])
    assert.deepEqual(state.stellarDetailStates, {})
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
