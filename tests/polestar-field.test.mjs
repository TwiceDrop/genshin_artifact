import test from 'node:test'
import assert from 'node:assert/strict'
import { POLESTAR_FIELD, polestarFieldState, updatePolestarField } from '../src/algorithms/polestar-field.mjs'

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
