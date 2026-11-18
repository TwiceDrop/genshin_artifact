import test from 'node:test';
import assert from 'node:assert/strict';
import {api, sum} from '../beta-tools/runtime.mjs';
import {fixture, optimizer} from '../beta-tools/interface-audit-7108.mjs';
import {refreshGamePreset, snapshotPreset} from '../src/utils/preset-workflow.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const panel = x => api.CommonInterface.get_attribute(x);

test('真实之月：七种共鸣按各自属性增加，可跨元素叠加，只对旅行者自身生效', () => {
    for (const name of ['AetherAnemo', 'LumineAnemo']) {
        const x = fixture(name);
        x.artifacts = [];
        const before = panel(x);
        const expected = {
            Anemo: ['critical', .10], Geo: ['def', 683 * .20], Electro: ['recharge', .20],
            Dendro: ['elemental_mastery', 60], Hydro: ['hp', 10875 * .20],
            Pyro: ['atk', (212 + 185) * .20], Cryo: ['critical_damage', .20],
        };
        for (const [element, [key, gain]] of Object.entries(expected)) {
            x.character.resonated_elements = [element];
            const after = panel(x);
            for (const [stat] of Object.values(expected)) {
                near(sum(after[stat]) - sum(before[stat]), stat === key ? gain : 0);
            }
        }
        x.character.resonated_elements = Object.keys(expected);
        const all = panel(x);
        for (const [stat, gain] of Object.values(expected)) near(sum(all[stat]) - sum(before[stat]), gain);
        assert.deepEqual(x.buffs, []);
    }
    const other = fixture('Kaeya'), before = panel(other);
    other.character.resonated_elements = ['Anemo', 'Pyro'];
    assert.deepEqual(panel(other), before);
});

test('共鸣后的单次伤害、DSL、配装目标与词条收益使用同一面板', () => {
    const x = fixture('LumineAnemo');
    const damage = input => api.CalculatorInterface.get_damage_analysis(input, null).normal.expectation;
    const before = damage(x);
    x.character.resonated_elements = ['Pyro', 'Anemo', 'Cryo'];
    const expected = damage(x);
    assert.ok(expected > before);
    const source = 'dmg h = LumineAnemo.Normal1\nresult = h.normal.e';
    const result = api.DSLInterface.run(source + '\nprint(result)', x, x.artifacts);
    assert.equal(result.is_error, false, result.error_msg);
    near(Number(result.output.trim().replace(/^MONA: /, '')), expected);
    x.target_function = {...x.target_function, use_dsl: true, dsl_source: source};
    near(api.OptimizeSingleWasm.optimize(optimizer(x), x.artifacts)[0].value, expected);
    const gain = api.BonusPerStat.bonus_per_stat({...x, tf: x.target_function, artifacts_config: null});
    const improved = structuredClone(x);
    improved.artifacts[0].sub_stats.push(['ATKPercentage', .058]);
    near(gain.atk_percentage[0], damage(improved) / expected - 1);
});

test('保存和刷新同一游戏角色预设时保留手选的共鸣元素', () => {
    const imported = fixture('AetherCryo');
    const saved = snapshotPreset({...imported, character: {...imported.character, resonated_elements: ['Anemo', 'Dendro']}});
    const refreshed = refreshGamePreset(saved, imported, [], 'synthetic', '合成预设');
    assert.deepEqual(refreshed.character.resonated_elements, ['Anemo', 'Dendro']);
});
