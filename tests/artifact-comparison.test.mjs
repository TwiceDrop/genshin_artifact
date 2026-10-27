import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { compareEquipment, snapshotEquipment, useArtifactComparison } from '../src/composables/artifactComparison.mjs'
import { attributeComparison } from '../src/algorithms/attribute-comparison.mjs'

const artifact = (id, value = .1) => ({ id, position: 'flower', setName: 'test', star: 5, level: 20, mainTag: { name: 'lifeStatic', value: 4780 }, normalTags: [{ name: 'critical', value }] })
test('comparison detects replacements, removals and same-ID edits while snapshots remain immutable', () => {
    const items = [artifact(1)], baseline = snapshotEquipment(items)
    items[0].normalTags[0].value = .2
    assert.equal(baseline[0].normalTags[0].value, .1)
    assert.equal(compareEquipment(items, baseline)[0], '已替换')
    assert.equal(compareEquipment([], baseline)[0], '已卸下')
    assert.equal(compareEquipment(items, [])[0], '新增')
    assert.equal(compareEquipment(items, null)[0], '')
})
test('switch game/session/history baselines, disable comparison, retain history by UID through reload', () => {
    const storage = ref({}), key = ref('111111111:21:Pyro'), items = ref([artifact(1)]), gameBaseline = ref({ items: snapshotEquipment(items.value), description: '游戏内穿戴' })
    const c = useArtifactComparison({ storage, key, items, gameBaseline })
    c.begin(items.value)
    items.value = [artifact(2)]
    c.record('计算结果 1')
    assert.equal(c.changes.value[0], '已替换')
    c.mode.value = 'game'
    assert.equal(c.changes.value[0], '已替换')
    c.enabled.value = false
    assert.ok(c.changes.value.every(x => x === ''))
    c.enabled.value = true; c.mode.value = 'history'
    c.historyId.value = c.history.value.find(r => r.label === '计算结果 1').id
    assert.equal(c.changes.value[0], '')
    key.value = '222222222:21:Pyro'
    assert.equal(c.history.value.length, 0)
    c.record('手动保存')
    key.value = '111111111:21:Pyro'
    assert.equal(c.history.value.length, 2)
    const reloaded = useArtifactComparison({ storage: ref(JSON.parse(JSON.stringify(storage.value))), key, items, gameBaseline })
    assert.equal(reloaded.history.value.length, 2)
    assert.equal(reloaded.mode.value, 'history')
    assert.equal(c.record('计算结果 1'), c.history.value.find(r => r.label === '计算结果 1').id)
    assert.equal(c.history.value.length, 2)
})
test('attribute deltas use displayed units, red increases, green decreases, and no false negative zero', () => {
    assert.deepEqual(attributeComparison({ base: .5, gear: .463 }, { base: .5, gear: .473 }, true), { current: '96.3%', before: '97.3%', delta: '-1.0%', direction: 'decrease' })
    assert.deepEqual(attributeComparison({ base: 1000, gear: 122.6 }, { base: 1000, gear: 20.1 }), { current: '1123', before: '1020', delta: '+103', direction: 'increase' })
    assert.equal(attributeComparison({ v: .963000000001 }, { v: .963 }, true).direction, '')
    assert.equal(attributeComparison({ v: .963 }, null, true).before, null)
})
