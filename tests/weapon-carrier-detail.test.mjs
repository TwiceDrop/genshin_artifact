import test from 'node:test';
import assert from 'node:assert/strict';
import {api, named} from '../beta-tools/runtime.mjs';
import {fixture, weapon} from '../beta-tools/interface-audit-7108.mjs';

function details(character, name, index, buffs = []) {
    const input = fixture(character);
    input.artifacts = [];
    input.weapon = weapon(name);
    input.skill.index = index;
    input.buffs = buffs;
    return [api.CommonInterface.get_attribute(input), api.CalculatorInterface.get_damage_analysis(input, null)];
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('新枝的暴伤归属武器副词条，真实的双暴 BUFF 独立保留', () => {
    for (const withBuff of [false, true]) {
        const buffs = withBuff ? [named('Critical', {p:10}), named('CriticalDamage', {p:20})] : [];
        const rows = details('Kaeya', 'NewBough', 0, buffs);
        for (const row of rows) {
            assert.equal(Object.hasOwn(row.critical, '武器副词条'), false);
            near(row.critical_damage['武器副词条'], .5513);
            for (const [sources,label,value] of [[row.critical,'BUFF: 暴击率',.1],[row.critical_damage,'BUFF: 暴击伤害',.2]]) {
                if (withBuff) near(sources[label], value);
                else assert.equal(Object.hasOwn(sources,label), false);
            }
        }
        const hit = rows[1].normal;
        near(hit.critical, hit.non_critical * (2.0513 + (withBuff ? .2 : 0)));
        near(hit.expectation, hit.non_critical + (hit.critical - hit.non_critical) * (withBuff ? .15 : .05));
    }
});

test('神子直接星超导的明细只在实装流浪乐章时显示其被动', () => {
    for (const name of ['WintersHeavyHeart','StarsealedEdict','TheWidsith']) {
        const rows = details('YaeMiko', name, 16);
        for (const row of rows) {
            assert.equal(JSON.stringify(row).includes('流浪乐章被动等效'), name === 'TheWidsith');
        }
        if (name === 'WintersHeavyHeart') {
            near(rows[1].direct_stellarconduct.expectation, 1919.254338);
            near(rows[1].critical_damage['武器副词条'], .5513);
        }
    }
});
