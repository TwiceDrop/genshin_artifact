import assert from 'node:assert/strict'
import test from 'node:test'
import { comparePanelRolls } from '../src/algorithms/roster-panel-rolls.mjs'

const equipment = artifacts => ({
    character: {name: 'Amber', level: 1, constellation: 0},
    weapon: {name: 'DullBlade', level: 1, refine: 1},
    artifacts,
})
const item = (star, level, main_stat, sub_stats) => ({
    star, level, set_name: star === 2 ? 'Adventurer' : 'GladiatorsFinale', main_stat, sub_stats,
})

test('two single 7.77% rolls display as 7.8% separately and 15.5% together', () => {
    const subs = [['CriticalDamage', .078], ['DEFPercentage', .073], ['ATKPercentage', .058]]
    const build = equipment([item(5, 0, ['HPFixed', 717], subs), item(5, 0, ['ATKFixed', 47], subs)])
    for (const target of ['65.5', '65.6', '']) {
        assert.equal(comparePanelRolls(build, {critical_damage: target}).critical_damage, '65.5')
    }
})

test('a legal value per line is insufficient if the piece has too few upgrade rolls', () => {
    const lines = [['CriticalRate', .078], ['CriticalDamage', .078], ['DEFFixed', 19], ['ElementalMastery', 23]]
    assert.throws(() => comparePanelRolls(equipment([item(5, 0, ['HPFixed', 717], lines)]), {critical: '12.8'}), /副词条/)
    assert.equal(comparePanelRolls(equipment([item(5, 4, ['HPFixed', 1530], lines)]), {critical: '12.8'}).critical, '12.8')
})

test('low rarity uses its own tiers and accepts an exact manually entered substat', () => {
    const calc = value => comparePanelRolls(equipment([item(2, 0, ['HPFixed', 258], [['CriticalRate', value]])]), {critical: '6.2'})
    assert.equal(calc(.011).critical, '6.1')
    assert.equal(calc(.0109).critical, '6.1')
    assert.throws(() => calc(.0111), /副词条/)
})
