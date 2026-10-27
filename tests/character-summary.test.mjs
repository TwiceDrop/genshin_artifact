import test from 'node:test'
import assert from 'node:assert/strict'
import { fourPieceSet, characterSummary } from '../src/import/character-summary.mjs'

test('roster shows only an equipped four-piece set; split sets and duplicate slots do not qualify', () => {
    const sets = { a: { nameLocale: 0 }, b: { nameLocale: 1 } }, locale = ['套装甲', '套装乙']
    const gear = keys => keys.map((setName, position) => ({ setName, position }))
    assert.equal(fourPieceSet(gear(['a', 'a', 'a', 'a', 'b']), sets, locale), '套装甲')
    assert.equal(fourPieceSet(gear(['a', 'a', 'b', 'b', 'a']), sets, locale), '无')
    assert.equal(fourPieceSet(Array(5).fill({ setName: 'a', position: 0 }), sets, locale), '无')
    assert.equal(fourPieceSet([], sets, locale), '无')
})

test('character selection summary uses displayed talent levels and the requested constellation/weapon format', () => {
    const item = characterSummary({ key: 'one', label: '奥黛塔', presetName: 'test' }, {
        preset: { character: { name: 'Odetta', constellation: 3, skill1: 5, skill2: 9, skill3: 12 }, weapon: { name: 'test', refine: 3, level: 90 }, artifactIds: [] },
        characters: { Odetta: { nameLocale: 0, element: 'Cryo', weapon: 'Sword', splash: '/splash.webp' } },
        weapons: { test: { nameLocale: 1 } }, artifacts: {}, locale: ['奥黛塔', '苍耀'], inventory: new Map(),
    })
    assert.equal(`${item.label} ${item.elementLabel} ${item.weaponType} ${item.constellation}命`, '奥黛塔 冰 单手剑 3命')
    assert.equal(item.talents, '天赋：6、10、13')
    assert.equal(item.weapon, '苍耀 精炼3阶 90级')
    assert.equal(item.set, '无'); assert.equal(item.splash, '/splash.webp')
})
