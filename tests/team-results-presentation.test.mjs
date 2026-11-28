import assert from 'node:assert/strict'
import test from 'node:test'
import { teamResultSets, teamResultDamageDelta, teamResultSlots } from '../src/pages/TeamOptimizationPage/team-results-presentation.mjs'

const pieces = (...setNames) => setNames.map(setName => ({ setName }))
const effects = items => teamResultSets(items).filter(set => set.effect).map(({ name, effect }) => ({ name, count: effect }))

test('effective set counts show only activated effects', () => {
    assert.deepEqual(effects(pieces('A', 'A', 'A', 'A', 'A')), [{ name: 'A', count: 4 }])
    assert.deepEqual(effects(pieces('A', 'B', 'B', 'A', 'C')), [{ name: 'A', count: 2 }, { name: 'B', count: 2 }])
    assert.deepEqual(effects(pieces('A', 'B', 'A', 'C', 'A')), [{ name: 'A', count: 2 }])
    assert.deepEqual(effects([...pieces('A', 'B', 'C', 'D'), undefined]), [])
    assert.deepEqual(teamResultSets(pieces('A', 'A', 'B', 'A', 'C')).map(set => set.count), [3, 1, 1])
})

test('relative damage uses the ranking baseline and omits a zero or negative baseline', () => {
    assert.equal(teamResultDamageDelta(9964, 10000), '-0.36%')
    assert.equal(teamResultDamageDelta(10010, 10000), '0.10%')
    assert.equal(teamResultDamageDelta(10000, 10000), '0.00%')
    assert.equal(teamResultDamageDelta(0, 10000), '-100.00%')
    assert.equal(teamResultDamageDelta(0, 0), null)
    assert.equal(teamResultDamageDelta(25, -10), null)
})

test('slot order, missing snapshots and differences are based on the equipped artifact IDs', () => {
    const items = new Map([[1, { id: 1 }], [2, { id: 2 }], [9, { id: 9 }]])
    const equipped = { head: 5, goblet: 4, flower: 1, sand: 3, feather: 2 }
    const changed = { ...equipped, feather: '9', goblet: 8 }
    const slots = teamResultSlots(changed, items, equipped)
    assert.deepEqual(slots.map(slot => slot.key), ['flower', 'feather', 'sand', 'goblet', 'head'])
    assert.deepEqual(slots.map(slot => slot.item?.id), [1, 9, undefined, undefined, undefined])
    assert.deepEqual(slots.map(slot => slot.different), [false, true, false, true, false])
    assert.equal(teamResultSlots({ ...equipped, feather: '2' }, items, equipped)[1].different, false)
    assert.ok(teamResultSlots(equipped, items).every(slot => !slot.different))
    assert.equal(teamResultSlots({}, items, equipped).length, 5)
})
