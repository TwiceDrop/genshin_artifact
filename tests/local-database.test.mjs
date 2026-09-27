import test from 'node:test'
import assert from 'node:assert/strict'
import { localDatabase } from '../src/algorithms/local-database.mjs'

test('offline database reports local presets, set bonuses and average roll counts', () => {
    const gear = new Map([0,1,2,3,4].map(id => [id, { id, set_name: id === 4 ? 'B' : 'A', slot: ['Flower','Feather','Sand','Goblet','Head'][id], main_stat: ['ATKPercentage', .466], sub_stats: [['CriticalRate',.066]] }]))
    const presets = { a: { item: { character: { name: 'Amber' }, weapon: { name: 'BowA' }, artifactIds: [0,1,2,3,4] } },
        b: { item: { character: { name: 'Amber' }, weapon: { name: 'BowB' }, artifactIds: [0,1,2,3,99] } } }
    const result = localDatabase(presets,gear,a=>a)
    assert.equal(result.source, 'local-presets')
    const a = result.character_result.Amber
    assert.equal(a.sample_count, 2)
    assert.deepEqual(a.weapon_usage, [['BowA',.5],['BowB',.5]])
    assert.deepEqual(a.artifact_set_usage, [[{Set4:'A'},1]])
    assert.equal(a.artifact_sub_stat_statistics.CriticalRate, 9)
    assert.equal(a.main_stat_usage.Head.ATKPercentage, 1)
    assert.deepEqual(localDatabase({},gear,a=>a).character_result, {})
})
