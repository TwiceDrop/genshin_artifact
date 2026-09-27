import test from 'node:test'
import assert from 'node:assert/strict'
import { damageComparison } from '../src/algorithms/damage-comparison.mjs'
test('damage comparison rounds displayed values consistently and uses red increase / green decrease', () => {
    assert.deepEqual(damageComparison(120.6, 100.2), { current: '121', before: '100', delta: '+21', percent: '+20.36%', direction: 'increase' })
    assert.equal(damageComparison(80, 100).direction, 'decrease')
    assert.equal(damageComparison(80, 100).delta, '-20')
    assert.equal(damageComparison(0, 0).delta, '0')
    assert.equal(damageComparison(42, null).before, null)
    assert.equal(damageComparison(42, undefined).before, null)
    assert.equal(damageComparison(NaN, 1).current, '无数据')
})

test('damage percent uses unrounded damage and handles zero baseline safely', () => {
    assert.equal(damageComparison(120, 100).percent, '+20.00%')
    assert.equal(damageComparison(80, 100).percent, '-20.00%')
    assert.equal(damageComparison(0, 100).percent, '-100.00%')
    assert.equal(damageComparison(100, 0).percent, '百分比不适用')
    assert.equal(damageComparison(0, 0).percent, '0.00%')
})
