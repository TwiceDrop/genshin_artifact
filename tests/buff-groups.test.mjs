import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { groupCharacterBuffs, characterBuffProfile, buffAvailability, bindBuffConfig, availableCharacterBuffs, groupSelectedBuffs } from '../src/algorithms/buff-groups/index.mjs'
const read = name => JSON.parse(fs.readFileSync(new URL(`../src/assets/_gen_${name}.js`,import.meta.url),'utf8').replace(/^.*\nexport default /,'').trim().replace(/;$/,''))
const buffs = read('buff'), characters = read('character')
const rules = JSON.parse(fs.readFileSync(new URL('../src/algorithms/buff-groups/ownership.json',import.meta.url)))

test('bulk addition excludes locked constellations and existing buffs, including repeat clicks', () => {
    const odette = groupCharacterBuffs(Object.values(buffs),rules).find(g => g.character === 'Odette').buffs
    const existing = ['OdetteTalent1']
    const available = availableCharacterBuffs(odette,rules,{constellation:3},existing)
    assert.deepEqual(available.map(b => b.name), ['OdetteMarvelousSplendor','OdetteC2MarvelousSplendor','OdetteC2SoloDance'])
    const after = existing.concat(available.map(b => b.name))
    assert.deepEqual(availableCharacterBuffs(odette,rules,{constellation:3},after),[])
    assert.deepEqual(availableCharacterBuffs(odette,rules,{constellation:6},after).map(b => b.name), ['OdetteC4SnowSwanDream','OdetteC6MarvelousSplendor'])
    assert.equal(availableCharacterBuffs(odette,rules,{constellation:0}).length,2)
})

test('selected character grouping preserves editable entries, IDs and disabled states', () => {
    const entries = [
        {id:1,name:'OdetteTalent1',config:{OdetteTalent1:{atk:1234}},lock:false},
        {id:2,name:'BennettQ',config:{BennettQ:{base_atk:700,skill3:6,c1:false}},lock:true},
        {id:3,name:'OdetteMarvelousSplendor',config:{OdetteMarvelousSplendor:{stacks:3}},lock:false},
        {id:4,name:'ResonancePolestarField',config:{},lock:false},
    ]
    const grouped = groupSelectedBuffs(entries,buffs,rules)
    assert.deepEqual(grouped.characters.map(g => g.character), ['Odette','Bennett'])
    assert.strictEqual(grouped.characters[0].buffs[0],entries[0])
    assert.strictEqual(grouped.characters[0].buffs[1],entries[2])
    assert.strictEqual(grouped.characters[1].buffs[0],entries[1])
    assert.equal(grouped.characters[1].buffs[0].lock,true)
    assert.strictEqual(grouped.other[0],entries[3])
    assert.equal(groupSelectedBuffs(entries.filter(e => e.id !== 2),buffs,rules).characters.length,1)
})
test('every published character buff has a reviewed owner and appears exactly once', () => {
    const expected = Object.values(buffs).filter(b => b.genre === 'Character')
    assert.deepEqual(Object.keys(rules).sort(), expected.map(b=>b.name).sort())
    for (const rule of Object.values(rules)) assert.ok(characters[rule.character] || rule.character === 'Traveler')
    const groups = groupCharacterBuffs(Object.values(buffs), rules)
    assert.equal(groups.flatMap(g=>g.buffs).length, expected.length)
    assert.equal(groups.find(g=>g.character==='Odette').buffs.length,6)
    assert.ok(groups.every(g=>g.character !== 'Unmapped'))
})
test('profile selection is isolated by UID and converts zero-based talents only once', () => {
    const presets = { a:{item:{character:{name:'Odette',constellation:3,skill1:0,skill2:12,skill3:5}}}, b:{item:{character:{name:'Odette',constellation:0,skill1:0,skill2:0,skill3:0}}} }
    const entries = [{uid:'111111111',key:'a',presetName:'a'},{uid:'222222222',key:'b',presetName:'b'}]
    const a = characterBuffProfile('Odette','111111111',entries,presets)
    assert.deepEqual([a.constellation,a.skill1,a.skill2,a.skill3],[3,1,13,6])
    assert.equal(characterBuffProfile('Odette','222222222',entries,presets).constellation,0)
    assert.equal(characterBuffProfile('Odette','333333333',entries,presets).imported,false)
    assert.equal(buffAvailability(rules.OdetteC2SoloDance,a).allowed,true)
    assert.equal(buffAvailability(rules.OdetteC4SnowSwanDream,a).allowed,false)
})
test('bound talent and constellation parameters preserve manual combat assumptions', () => {
    const profile = {constellation:0,skill1:1,skill2:13,skill3:6}
    const bennett = bindBuffConfig(buffs.BennettQ,profile).BennettQ
    assert.equal(bennett.skill3,6); assert.equal(bennett.c1,false); assert.equal(bennett.base_atk,800)
    const alyosha = bindBuffConfig(buffs.AlyoshaHunterPrecision,profile).AlyoshaHunterPrecision
    assert.equal(alyosha.skill_level,13); assert.equal(alyosha.stacks,1); assert.equal(alyosha.c6,false)
    const c6 = bindBuffConfig(buffs.AlyoshaHunterPrecision,{...profile,constellation:6}).AlyoshaHunterPrecision
    assert.equal(c6.stacks,2); assert.equal(c6.c6,true)
    assert.equal(bindBuffConfig(buffs.OdetteC4SnowSwanDream,profile).OdetteC4SnowSwanDream.burst_level,6)
    assert.equal(bindBuffConfig(buffs.MonaQ,{...profile,constellation:6}).MonaQ.c4,true)
    assert.equal(bindBuffConfig(buffs.MonaQ,{...profile,constellation:6}).MonaQ.c4_magus,buffs.MonaQ.config.find(c=>c.name==='c4_magus').default)
    assert.equal(bindBuffConfig(buffs.SandroneC1,profile),'NoConfig')
    const manual = bindBuffConfig(buffs.AlyoshaHunterPrecision,profile,{AlyoshaHunterPrecision:{c6:true,stacks:2,skill_level:1,stellar_conduct:false}}).AlyoshaHunterPrecision
    assert.equal(manual.c6,false); assert.equal(manual.stacks,1); assert.equal(manual.skill_level,13); assert.equal(manual.stellar_conduct,false)
})
