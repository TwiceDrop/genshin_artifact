import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {buildUsageStatsCharacters, renderUsageStatsCharacters, USAGE_STATS_CHARACTERS_FILE, buildUsageStatsAvatars, renderUsageStatsAvatars, USAGE_STATS_AVATARS_FILE} from '../beta-tools/usage-stats-characters.mjs'
import {listUsageCharacters, getUsageCharacter} from '../server/usage-stats-characters.mjs'
import {listUsageFeatures} from '../server/usage-stats-features.mjs'

test('the shared character list matches the release character catalog', () => {
    assert.equal(fs.readFileSync(USAGE_STATS_CHARACTERS_FILE, 'utf8'), renderUsageStatsCharacters(buildUsageStatsCharacters()),
        'run node beta-tools/usage-stats-characters.mjs to regenerate server/usage-stats-characters.mjs')
    assert.equal(fs.readFileSync(USAGE_STATS_AVATARS_FILE, 'utf8'), renderUsageStatsAvatars(buildUsageStatsAvatars()),
        'run node beta-tools/usage-stats-characters.mjs to regenerate online-service/static/avatars.js')
})

test('characters are looked up by id and carry a Chinese name', () => {
    assert.equal(listUsageCharacters().length, 143)
    assert.deepEqual(getUsageCharacter('Mona'), {name: 'Mona', zh: '莫娜'})
    assert.equal(getUsageCharacter('NotACharacter'), undefined)
    assert.throws(() => { getUsageCharacter('Mona').zh = 'x' }, TypeError)
})

test('only single optimisation and team DPS carry characters', () => {
    assert.deepEqual(listUsageFeatures().filter(f => f.characters).map(f => f.id), ['action.single-optimize', 'action.team-dps'])
})

test('every action that carries characters records them somewhere in src', () => {
    const calls = new Set()
    for (const file of fs.readdirSync('src', { recursive: true })) {
        if (!/\.(vue|mjs|js|ts)$/.test(file)) continue
        for (const [, id] of fs.readFileSync(`src/${file}`, 'utf8').matchAll(/recordCharacterUsage\(\s*['"]([a-z]+\.[a-z0-9-]+)['"]/g)) calls.add(id)
    }
    assert.deepEqual([...calls].sort(), listUsageFeatures().filter(f => f.characters).map(f => f.id).sort())
})
