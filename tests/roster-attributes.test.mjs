import test from 'node:test'
import assert from 'node:assert/strict'
import {rosterAttributes} from '../src/algorithms/roster-attributes.mjs'
import {api, sum} from '../beta-tools/runtime.mjs'
import {fixture, weapon} from '../beta-tools/interface-audit-7108.mjs'

test('基础精通从 1 级起计入面板，与装备叠加且独立于战斗状态', () => {
    for (const [name, initial] of [['Nefer', 100], ['Mitya', 100], ['Lauma', 200], ['Amber', 0]]) {
        const input = fixture(name)
        input.character.level = 1
        input.artifacts = []
        const bare = rosterAttributes(input)
        assert.equal(sum(bare.elemental_mastery), initial, name)
        input.character.level = 90
        input.artifacts = fixture().artifacts.slice(0, 1)
        const ascension = name === 'Lauma' ? 115.2 : 0
        assert.equal(sum(rosterAttributes(input).elemental_mastery), initial + ascension + 20, name)
    }
})

test('队外旅行者不显示共鸣和队伍加攻，战斗计算仍应用两者', () => {
    const input = fixture('AetherCryo')
    input.artifacts = []
    input.weapon = weapon('HarbingerOfDawn')
    input.weapon.refine = 5
    const before = rosterAttributes(input)
    const damage = () => api.CalculatorInterface.get_damage_analysis(input, null).normal.expectation
    const baseDamage = damage()
    input.character.resonated_elements = ['Anemo', 'Pyro']
    input.buffs = [{name: 'ResonancePyro2', config: 'NoConfig'}]
    assert.deepEqual(rosterAttributes(input), before)
    assert.equal(sum(before.critical), 0.05)
    assert.equal(Math.round(sum(before.critical_damage) * 1000), 969)
    assert.ok(damage() > baseDamage)
})

test('常驻属性与条件转化分开，圣遗物和突破按原始精度累计', () => {
    const input = fixture('Kaeya')
    input.weapon = weapon('PrimordialJadeCutter')
    input.artifacts = []
    const base = rosterAttributes(input)
    assert.equal(Math.round(sum(base.hp)), 13963)
    assert.equal(Math.round(sum(base.atk)), 765)
    const gear = fixture().artifacts.slice(0, 2)
    const equipped = rosterAttributes({...input, artifacts: gear})
    assert.equal(Math.round(sum(equipped.hp) - sum(base.hp)), 4780)
    assert.equal(Math.round(sum(equipped.atk) - sum(base.atk)), 449)
    assert.equal(sum(equipped.elemental_mastery), 40)
    const mona = fixture('Mona')
    assert.equal(sum(rosterAttributes(mona).bonus_hydro), 0)
    const xingqiu = fixture('Xingqiu')
    xingqiu.character.level = 60
    assert.equal(sum(rosterAttributes(xingqiu).bonus_hydro), 0)
    xingqiu.character.ascend = true
    assert.equal(sum(rosterAttributes(xingqiu).bonus_hydro), 0.2)
    const kokomi = rosterAttributes(fixture('SangonomiyaKokomi'))
    assert.equal(sum(kokomi.critical), -0.95)
    assert.equal(sum(kokomi.healing_bonus), 0.25)
})
