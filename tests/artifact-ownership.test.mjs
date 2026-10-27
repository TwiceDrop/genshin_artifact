import test from 'node:test'
import assert from 'node:assert/strict'
import { otherCharacterArtifactIds } from '../src/algorithms/artifact-ownership.mjs'

test('protect game equipment of other characters in the selected UID while retaining own and idle copies', () => {
    const inventory = new Map([0,1,2,3,4,5,6].map(id => [id,{id}]))
    const entries = [
        {uid:'111111111',key:'own',artifactIds:[0,1,-1,-1,-1]},
        {uid:'111111111',key:'other',artifactIds:[2,3,-1,-1,-1]},
        // Cross-UID imports can share deduplicated inventory IDs, including own items.
        {uid:'222222222',key:'foreign',artifactIds:[0,5,-1,-1,-1]},
    ]
    const reserved = otherCharacterArtifactIds(entries,'111111111','own',inventory)
    assert.deepEqual([...reserved],[2,3])
    assert.deepEqual([...inventory.keys()].filter(id => !reserved.has(id)),[0,1,4,5,6])
    assert.deepEqual([...otherCharacterArtifactIds(entries,'222222222','foreign',inventory)],[])
    // A manually selected, unimported character can use idle pieces only.
    assert.deepEqual([...otherCharacterArtifactIds(entries,'111111111',undefined,inventory)],[0,1,2,3])
    assert.equal(otherCharacterArtifactIds(entries,'',undefined,inventory).size,0)
})

test('protection follows imported IDs through sync, ignores deleted items and preserves equal-stat idle copies', () => {
    const inventory = new Map([[10,{id:10,stats:'identical'}],[11,{id:11,stats:'identical'}],[12,{id:12}]])
    const entry = {uid:'111111111',key:'other',artifactIds:[10,99,-1,null,undefined],presetName:'edited preset'}
    assert.deepEqual([...otherCharacterArtifactIds([entry],'111111111','own',inventory)],[10])
    entry.artifactIds = [12,-1,-1,-1,-1]
    assert.deepEqual([...otherCharacterArtifactIds([entry],'111111111','own',inventory)],[12])
    inventory.delete(12)
    assert.equal(otherCharacterArtifactIds([entry],'111111111','own',inventory).size,0)
})
