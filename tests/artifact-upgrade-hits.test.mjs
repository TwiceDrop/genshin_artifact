import assert from 'node:assert/strict'
import test from 'node:test'
import { artifactUpgradeHits } from '../src/algorithms/artifact-upgrade-hits.mjs'

const stats = (crit, cdmg, mastery, def) => [
    ['CriticalRate', crit], ['CriticalDamage', cdmg], ['ElementalMastery', mastery], ['DEFFixed', def],
]

test('count additional rolls after each line first appears, at the equipped rarity', () => {
    assert.deepEqual(artifactUpgradeHits(5, 20, stats(.078, .210, 40, 19)), [1, 2, 1, 0])
    assert.deepEqual(artifactUpgradeHits(4, 16, stats(.062, .124, 30, 19)), [1, 1, 1, 0])
    assert.deepEqual(artifactUpgradeHits(3, 12, stats(.047, .047, 14, 11)), [1, 0, 0, 0])
    assert.deepEqual(artifactUpgradeHits(5, 4, stats(.039, .078, 23, 19)), [0, 0, 0, 0])
})

test('ambiguous and rounded inputs select the closest legal whole-piece counts', () => {
    assert.deepEqual(artifactUpgradeHits(5, 20, stats(.163, .078, 23, 19)), [4, 0, 0, 0])
    assert.deepEqual(artifactUpgradeHits(5, 20, stats(.163, .078, 23, 37)), [4, 0, 0, 1])
    assert.deepEqual(artifactUpgradeHits(5, 4, stats(.163, .078, 23, 19)), [1, 0, 0, 0])
    assert.deepEqual(artifactUpgradeHits(5, 20, stats(.233, .078, 23, 19)), [5, 0, 0, 0])
})

test('all displayed hits together stay within the upgrade budget even for impossible input', () => {
    for (const star of [3, 4, 5]) {
        for (let level = 0; level <= star * 4; level++) {
            const hits = artifactUpgradeHits(star, level, stats(.311, .466, 112, 110))
            const budget = Math.max(0, Math.floor(level / 4) - (5 - star))
            assert.ok(hits.reduce((sum, n) => sum + n, 0) <= budget)
        }
    }
})
