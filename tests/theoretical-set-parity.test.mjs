import test from 'node:test'
import assert from 'node:assert/strict'
import {compareTheoreticalSetParity} from '../beta-data/theoretical-set-parity.mjs'

const api = value => ({CalculatorInterface: {get_damage_analysis: () => ({
    direct_stellarswirl: {non_critical: value, critical: value * 2, expectation: value * 1.5}
})}})
const cases = [{name: 'star target', input: {}, field: 'direct_stellarswirl'}]

test('theoretical ranking gates on all three independently calculated damage values', () => {
    assert.equal(compareTheoreticalSetParity(api(100), api(100 + 1e-7), cases).equal, true)
    assert.equal(compareTheoreticalSetParity(api(100), api(101), cases).equal, false)
    assert.equal(compareTheoreticalSetParity(api(100), {CalculatorInterface: {get_damage_analysis: () => ({})}}, cases).equal, false)
})
