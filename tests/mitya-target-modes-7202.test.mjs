import test from 'node:test';
import assert from 'node:assert/strict';
import {api, read} from '../beta-tools/runtime-7106.mjs';
import {input, gear, named} from '../beta-tools/preview-7201-fixtures.mjs';

const target = {name: 'MityaDefault', params: 'NoConfig', use_dsl: false, dsl_source: ''};
const close = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const artifacts = gear.map((a,i) => ({...structuredClone(a), main_stat: i === 2 ? ['ATKPercentage', .466] : a.main_stat}));
const alternative = {...structuredClone(artifacts[2]), id: 6, main_stat: ['ElementalMastery', 187]};
const candidates = [...artifacts, alternative];
function setup(mode) {
    const x = input(); x.character.params.Mitya.core_mode = mode;
    return {...x, artifacts: structuredClone(artifacts), target_function: structuredClone(target), constraint: {set_mode: 'Any'}, filter: null};
}
// Native level-10 coefficients and independent synthetic fixture stats.
function expected(mode, emSand, emExtra = 0) {
    const atk = 286 * (1.18 + (emSand ? 0 : .466)) + 311;
    const em = 100 + 374 + (emSand ? 187 : 0) + (mode === 1 ? 120 : 0) + emExtra;
    const crit = 1 + .25 * .884;
    return mode === 0 ? atk * 2.46384 * 1.2 * .5 * .9 * crit
        : em * (mode === 1 ? 1.44 : 4.032) * (1 + Math.min(em * .00028, .14)) * (1 + 6 * em / (2000 + em)) * .9 * crit;
}

test('Default target selects all three core modes in both actual search algorithms', () => {
    for (const mode of [0,1,2]) {
        const x = setup(mode), before = JSON.stringify(x);
        for (const emSand of [false,true]) {
            const selected = x.artifacts.map(a => emSand && a.slot === 'Sand' ? alternative : a);
            const damage = api.CalculatorInterface.get_damage_analysis({...x, artifacts: selected, skill: {index: [3,12,8][mode], config: 'NoConfig'}}, null);
            close(damage[mode === 0 ? 'normal' : 'direct_stellarconduct'].expectation, expected(mode, emSand));
        }
        for (const algorithm of ['Naive','AStar']) {
            const rows = api.OptimizeSingleWasm.optimize({...x, algorithm}, candidates);
            assert.ok(rows.length > 0, `mode ${mode} / ${algorithm}`);
            close(rows[0].value, Math.max(expected(mode, false), expected(mode, true)));
            assert.equal(rows[0].sand, mode === 0 ? 3 : 6);
        }
        assert.equal(JSON.stringify(x), before);
    }
});

test('Stat gains follow the selected default target mode, and switching back is reproducible', () => {
    for (const mode of [1,0,2,1]) {
        const x = setup(mode);
        const gains = api.BonusPerStat.bonus_per_stat({...x, tf: target, artifacts_config: null});
        assert.ok(Object.values(gains).flat().every(Number.isFinite));
        if (mode === 0) {
            assert.deepEqual(gains.elemental_mastery, []);
            close(gains.atk_percentage[0], 286 * .058 / (286 * (1.18 + .466) + 311));
        } else close(gains.elemental_mastery[0], expected(mode, false, 23) / expected(mode, false) - 1);
        const increased = api.CalculatorInterface.get_damage_analysis({...x, buffs: [named('ElementalMastery', {value:23})], skill: {index: [3,12,8][mode], config:'NoConfig'}}, null);
        close(increased[mode === 0 ? 'normal' : 'direct_stellarconduct'].expectation, expected(mode, false, 23));
    }
});

test('Explicit DSL and real artifact constraints retain their meaning', () => {
    for (const mode of [0,1,2]) {
        const x = setup(mode), custom = {...target, use_dsl: true, dsl_source: 'result = 123'};
        const before = JSON.stringify(custom);
        const rows = api.OptimizeSingleWasm.optimize({...x, target_function: custom, algorithm:'Naive'}, candidates);
        assert.ok(rows.length > 0); close(rows[0].value, 123);
        assert.equal(JSON.stringify(custom), before);
        const impossible = api.OptimizeSingleWasm.optimize({...x, algorithm:'AStar', constraint:{set_mode:'Any', em_min:10000}}, candidates);
        assert.deepEqual(impossible, []);
    }
});

test('Signature weapon and support buffs also reach the mode-aware default', () => {
    const metadata = read('src/assets/_gen_buff.js');
    const names = ['OdetteTalent1','OdetteMarvelousSplendor','OdetteC2MarvelousSplendor','OdetteC2SoloDance','YaeMikoC1','SucroseTalent1','SucroseTalent2','Instructor4','ViridescentVenerer4','HeartOfTheFurnace4','ResonancePolestarField'];
    for (const mode of [0,1,2]) {
        const x = setup(mode);
        x.weapon = {name:'StarsealedEdict',level:90,ascend:false,refine:1,params:{StarsealedEdict:{skill_active:true,stacks:3,radiance:true}}};
        x.buffs = names.map(name => metadata[name].config?.length
            ? named(name, Object.fromEntries(metadata[name].config.map(p => [p.name, p.default])))
            : {name, config:'NoConfig'});
        x.constraint.recharge_min = 1;
        const before = JSON.stringify(x);
        const scores = [false,true].map(emSand => {
            const selected = x.artifacts.map(a => emSand && a.slot === 'Sand' ? alternative : a);
            const damage = api.CalculatorInterface.get_damage_analysis({...x, artifacts:selected, skill:{index:[3,12,8][mode],config:'NoConfig'}}, null);
            return damage[mode === 0 ? 'normal' : 'direct_stellarconduct'].expectation;
        });
        const rows = api.OptimizeSingleWasm.optimize({...x,algorithm:'AStar'}, candidates);
        assert.ok(rows.length > 0); close(rows[0].value, Math.max(...scores));
        assert.equal(JSON.stringify(x), before);
    }
});
