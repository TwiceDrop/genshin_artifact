import assert from 'node:assert/strict';
import test from 'node:test';
import {api, named, original, sum, vesna} from '../beta-tools/runtime.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {readPanel} from '../beta-data/panel-search.mjs';
import {dslObjective} from '../src/algorithms/single-result-comparison.mjs';
import {createMonaEvaluator} from '../src/algorithms/artifact-score/evaluator.mjs';

const character = {
    name: 'Mavuika', level: 90, ascend: false, constellation: 0, skill1: 9, skill2: 9, skill3: 9,
    params: {Mavuika: {talent1_rate: 1, talent2_rate: 1, fighting_spirit: 200, c1_rate: 1,
        c2_rate: 1, c2_def_minus_rate: 0, c6_def_minus_rate: 1}},
};
const weapon = {name: 'AThousandBlazingSuns', level: 90, ascend: false, refine: 1,
    params: {AThousandBlazingSuns: {rate1: 1, rate2: 1}}};
const bennett = named('BennettQ', {base_atk: 700, skill3: 6, c1: false});
const xilonen = named('XilonenE', {elements: ['Pyro'], skill_level: 8});
const base = {character, weapon, buffs: [bennett], enemy: null, artifact_config: null};
const slots = ['Flower', 'Feather', 'Sand', 'Goblet', 'Head'];
const mains = ['HPFixed', 'ATKFixed', 'ATKPercentage', 'PyroBonus', 'CriticalRate'];
const gear = slots.map((slot, i) => ({
    id: i + 1, slot, set_name: 'Empty', level: 20, star: 5, sub_stats: [], main_stat: [mains[i], 0],
}));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
    actual + ' != ' + expected);

function run(source, input = base, artifacts = gear) {
    const response = api.DSLInterface.run(source, input, artifacts);
    assert.equal(response.is_error, false, response.error_msg);
    return response.output.trim().split('\n').map(line => Number(line.replace(/^MONA: /, '')));
}

function damage(input, index, artifacts = gear) {
    return api.CalculatorInterface.get_damage_analysis({...input, artifacts, skill: {index, config: 'NoConfig'}}, null);
}

test('three states have independent source buffs, damage, and panel properties', () => {
    const source = [
        'buff bennett = BennettQ({ base_atk: 700, skill3: 6, c1: false })',
        'buff xilonen = XilonenE({ elements: ["Pyro"], skill_level: 8 })',
        'state burst = { buffs: [bennett, xilonen] }',
        'state ride = { buffs: [xilonen] }',
        'state tail = { buffs: [] }',
        'dmg opening = Mavuika.Q1 @burst',
        'dmg spin = Mavuika.ECharged1 @ride',
        'dmg last = Mavuika.ECharged1 @tail',
        'dmg baseHit = Mavuika.ECharged1',
        'prop openingAtk = Mavuika.atk @burst',
        'prop baseAtk = Mavuika.atk',
        'result = opening.normal.e + spin.normal.e * 2 + last.normal.e',
        'print(opening.normal.e, spin.normal.e, last.normal.e, baseHit.normal.e, openingAtk, baseAtk, result)',
    ].join('\n');
    const [opening, spin, last, baseHit, openingAtk, baseAtk, total] = run(source);
    const burst = {...base, buffs: [bennett, xilonen]}, ride = {...base, buffs: [xilonen]}, tail = {...base, buffs: []};
    near(opening, damage(burst, 19).normal.expectation);
    near(spin, damage(ride, 16).normal.expectation);
    near(last, damage(tail, 16).normal.expectation);
    const [oldHit, oldAtk] = run('dmg hit = Mavuika.ECharged1\nprop atk = Mavuika.atk\nprint(hit.normal.e, atk)');
    near(baseHit, oldHit);
    near(baseAtk, oldAtk);
    near(openingAtk - sum(api.CommonInterface.get_attribute({...tail, artifacts: gear}).atk), 700 * .784);
    // Default Pyro resistance is 10%. The configured talent index 8 shreds 30%.
    near(spin / last, (1 + .20 / 2) / .9);
    near(total, opening + 2 * spin + last);
});

test('state coverage and conditional result can reverse the order of the leading segment', () => {
    const source = [
        'state first = { buffs: [] }',
        'state later = { buffs: [], weapon: { rate1: 0, rate2: 0 } }',
        'prop firstAtk = Mavuika.atk @first',
        'prop laterAtk = Mavuika.atk @later',
    ];
    const other = {...gear[1], id: 7, main_stat: ['ATKFixed', 311]};
    const buildB = [gear[0], other, ...gear.slice(2)];
    const threshold = name => (sum(api.CommonInterface.get_attribute({...name, artifacts: gear}).atk)
        + sum(api.CommonInterface.get_attribute({...name, artifacts: buildB}).atk)) / 2;
    const firstThreshold = threshold({...base, buffs: []});
    const laterThreshold = threshold({...base, buffs: [], weapon: {...weapon, params: {AThousandBlazingSuns: {rate1: 0, rate2: 0}}}});
    source.push('p1 = select(firstAtk < ' + firstThreshold + ', 100, 80)',
        'p2 = select(laterAtk < ' + laterThreshold + ', 40, 80)', 'result = p1 + p2');
    const text = source.join('\n');
    assert.deepEqual(run(text + '\nprint(p1, p2, result)'), [100, 40, 140]);
    assert.deepEqual(run(text + '\nprint(p1, p2, result)', base, buildB), [80, 80, 160]);
    const target_function = {name: 'Custom', use_dsl: true, dsl_source: text, params: 'NoConfig'};
    const input = {...base, target_function, algorithm: 'Cutoff2', constraint: {set_mode: 'Any'}};
    const results = api.OptimizeSingleWasm.optimize(input, [...gear, other]);
    assert.deepEqual(results.map(result => [result.feather, result.value]), [[7, 160], [2, 140]]);
    assert.equal(dslObjective(api, input, buildB), 160);
    const evaluator = createMonaEvaluator(api, {input, objective: {kind: 'dsl'}});
    try {
        assert.equal(evaluator.evaluate(buildB), 160);
    } finally {
        evaluator.close();
    }
});

test('legacy objective keeps its search scores and ranking', () => {
    const dsl_source = 'dmg hit = Mavuika.Q1\nresult = hit.normal.e';
    const target_function = {name: 'MavuikaDefault', use_dsl: true, dsl_source, params: 'NoConfig'};
    const input = {...base, target_function, algorithm: 'Naive', constraint: null, filter: null};
    const builds = gear.map(piece => ({...piece, set_name: 'GladiatorsFinale'}));
    const pool = [...builds, {...builds[1], id: 9, main_stat: ['ATKFixed', 311]}];
    const legacy = original.OptimizeSingleWasm.optimize(input, pool);
    assert.equal(legacy.length, 2);
    assert.deepEqual(api.OptimizeSingleWasm.optimize(input, pool), legacy);
});

test('Lumine keeps legacy traveler declarations and her own charged-hit correction in segmented DSL', () => {
    const input = fixture('LumineDendro');
    const source = [
        'dmg first = AetherDendro.Normal1',
        'dmg charged = AetherDendro.Charged2',
        'prop atk = AetherDendro.atk',
        'prop em = AetherDendro.em',
        'print(first.normal.e, charged.normal.e, atk, em)',
    ].join('\n');
    const legacy = run(source, input, input.artifacts);
    const segmented = run('state spare = { buffs: [] }\n' + source, input, input.artifacts);
    segmented.forEach((value, index) => near(value, legacy[index]));
    const aether = run(source, fixture('AetherDendro'), input.artifacts);
    assert.ok(segmented[1] > aether[1]);

    const wrongElement = api.DSLInterface.run(
        'state spare = { buffs: [] }\n' + source.replace('AetherDendro.Normal1', 'AetherCryo.Normal1'),
        input, input.artifacts,
    );
    assert.equal(wrongElement.is_error, true);
    assert.match(wrongElement.error_msg, /第 2 行.*AetherCryo.*LumineDendro/);
});

test('declared effect fields preserve zero and agree with the public damage calculator', () => {
    const source = [
        'state full = { buffs: [] }',
        'state charOff = { buffs: [], character: { fighting_spirit: 0 } }',
        'state weaponOff = { buffs: [], weapon: { rate1: 0, rate2: 0 } }',
        'state bothOff = { buffs: [], character: { fighting_spirit: 0 }, weapon: { rate1: 0, rate2: 0 } }',
    ];
    const names = ['full', 'charOff', 'weaponOff', 'bothOff'];
    const declarations = names.map((name, i) => 'dmg d' + i + ' = Mavuika.Q1 @' + name);
    const expression = 'result = d0.normal.e + d1.normal.e + d2.normal.e + d3.normal.e\n'
        + 'print(d0.normal.e, d1.normal.e, d2.normal.e, d3.normal.e, result)';
    const values = run([...source, ...declarations, expression].join('\n'));
    assert.deepEqual(run([...source, ...declarations.reverse(), expression].join('\n')), values);
    const charOff = {...character, params: {Mavuika: {...character.params.Mavuika, fighting_spirit: 0}}};
    const weaponOff = {...weapon, params: {AThousandBlazingSuns: {rate1: 0, rate2: 0}}};
    [[character, weapon], [charOff, weapon], [character, weaponOff], [charOff, weaponOff]].forEach(([c, w], i) => {
        near(values[i], damage({...base, buffs: [], character: c, weapon: w}, 19).normal.expectation);
    });
    assert.ok(values[0] > values[1] && values[0] > values[2] && values[1] > values[3]);
    near(values[4], values.slice(0, 4).reduce((a, b) => a + b, 0));
});

test('state and expression errors identify their source location', () => {
    const input = {...base};
    for (const [source, expected] of [
        ['state s = { buffs: [] }\ndmg d = Mavuika.Q1 @unknown\nresult = 0', /第 2 行.*unknown/],
        ['state s = { buffs: [], weapon: { noSuchField: false } }\nresult = 0', /第 1 行.*noSuchField/],
        ['state s = { buffs: [] }\nresult = 1 @s', /第 2 行/],
        ['state s = { buffs: [] }\nresult = 1 +', /解析.*第 2 行/],
    ]) {
        const response = api.DSLInterface.run(source, input, gear);
        assert.equal(response.is_error, true);
        assert.match(response.error_msg, expected);
    }
});

test('stat gains recalculate the entire expression with the perturbed build', () => {
    const source = 'state dry = { buffs: [] }\nprop first = Mavuika.atk @dry\nprop second = Mavuika.atk\nresult = first * 2 + second';
    const tf = {name: 'Custom', use_dsl: true, dsl_source: source, params: 'NoConfig'};
    const gains = api.BonusPerStat.bonus_per_stat({...base, artifacts: gear, tf, artifacts_config: null});
    const changed = gear.map((piece, i) => i ? piece : {...piece, sub_stats: [['ATKFixed', 19]]});
    const baseline = dslObjective(api, {...base, target_function: tf}, gear);
    const perturbed = dslObjective(api, {...base, target_function: tf}, changed);
    near(perturbed - baseline, 57);
    near(gains.atk[0], (perturbed - baseline) / baseline);
    assert.equal(gains.def.length, 0);
});

test('base and named direct hits keep adapted damage aliases and explicit false', () => {
    const mitya = fixture('Mitya');
    mitya.character.params.Mitya.core_mode = 2;
    const declaration = 'dmg h = Mitya.GradientStellar';
    const [oldNormal, oldStellar] = run(declaration + '\nprint(h.normal.e, h.direct_stellarconduct.e)', mitya, mitya.artifacts);
    assert.ok(oldNormal > 0);
    const [normal, stellar] = run('state base = { buffs: [] }\n' + declaration + '\nprint(h.normal.e, h.direct_stellarconduct.e)',
        mitya, mitya.artifacts);
    near(normal, oldNormal);
    near(stellar, oldStellar);

    const input = {...vesna, buffs: []};
    const source = 'state dim = { buffs: [], character: { radiance: false } }\n'
        + 'dmg on = Vesna.Burst\ndmg off = Vesna.Burst @dim\nprint(on.normal.e, off.normal.e)';
    const unmarked = run(source, input, []);
    const off = {...input, character: {...input.character, params: {Vesna: {...input.character.params.Vesna, radiance: false}}}};
    near(unmarked[0], api.CalculatorInterface.get_damage_analysis(input, null).direct_stellarswirl.expectation);
    near(unmarked[1], api.CalculatorInterface.get_damage_analysis(off, null).normal.expectation);
});

test('disabled BUFF parameters are ignored and transformative damage works without a selected skill', () => {
    const source = 'buff disabled = ATKFixed({ value: "unused", active: false })\n'
        + 'state reaction = { buffs: [disabled] }\ndmg t = Mavuika.transformative @reaction\n'
        + 'result = t.bloom\nprint(result)';
    const [legacy] = run('dmg t = Mavuika.transformative\nprint(t.bloom)', {...base, buffs: []});
    near(run(source)[0], legacy);
    const target_function = {name: 'MavuikaDefault', use_dsl: true, dsl_source: source, params: 'NoConfig'};
    near(api.OptimizeSingleWasm.optimize({...base, target_function}, gear)[0].value, legacy);
});

test('segmented DSL respects the single-hit scope of a manual reaction panel', () => {
    const input = {
        ...fixture('Kaeya'),
        direct_stellar_context: {
            owner: {id: 'Kaeya', em: 0, critRate: 0, critDamage: 0},
            scalingStat: 100, skillMultiplier: 1, baseMultiplier: 1, element: 'Electro', resistanceMultiplier: 1,
        },
    };
    const source = 'state spare = { buffs: [] }\ndmg hit = Kaeya.Normal1\nresult = hit.direct_stellarconduct.e';
    const target = {name: 'Custom', use_dsl: true, dsl_source: source, params: 'NoConfig'};
    const scopeError = /手填单次伤害面板仅支持单次伤害计算/;

    near(api.CalculatorInterface.get_damage_analysis(input, null).direct_stellarconduct.expectation, 100);
    assert.throws(() => api.OptimizeSingleWasm.optimize({...input, target_function: target}, input.artifacts), scopeError);
    assert.throws(() => api.BonusPerStat.bonus_per_stat({...input, tf: target}), scopeError);
    assert.throws(() => api.DSLInterface.prepareObjective(source, input), scopeError);
    const response = api.DSLInterface.run(source, input, input.artifacts);
    assert.equal(response.is_error, true);
    assert.match(response.error_msg, scopeError);
});

test('search mastery threshold uses base mastery before extra reaction mastery', () => {
    const buffs = [named('NahidaTalent1', {max_em: 1000})];
    const dsl_source = 'state dry = { buffs: [] }\nprop atk = Mavuika.atk @dry\nresult = atk';
    const target_function = {name: 'MavuikaDefault', use_dsl: true, dsl_source, params: 'NoConfig'};
    const builds = gear.map(piece => ({...piece, set_name: 'GladiatorsFinale'}));
    const withMastery = {...builds[4], id: 11, sub_stats: [['ElementalMastery', 125]]};
    const input = {...base, buffs, target_function, constraint: {em_min: 100}};
    assert.ok(sum(api.CommonInterface.get_attribute({...input, artifacts: builds}).elemental_mastery) >= 100);
    const pool = [...builds, withMastery];
    const legacy = api.OptimizeSingleWasm.optimize({
        ...input, algorithm: 'Naive', constraint: {...input.constraint, set_mode: 'Any'},
        target_function: {...target_function, dsl_source: 'result = 1'},
    }, pool);
    assert.deepEqual(legacy.map(result => result.head), [11]);
    assert.deepEqual(api.OptimizeSingleWasm.optimize(input, pool).map(result => result.head), [11]);
});

test('segmented search honors main-stat filters, two-piece pairs and base-panel minimums', () => {
    const source = 'state dry = { buffs: [] }\nprop atk = Mavuika.atk @dry\nresult = atk';
    const target_function = {name: 'Custom', use_dsl: true, dsl_source: source, params: 'NoConfig'};
    const requiredSets = ['GladiatorsFinale', 'GladiatorsFinale', 'WanderersTroupe', 'WanderersTroupe', 'Empty'];
    const selected = gear.map((piece, index) => ({...piece, set_name: requiredSets[index]}));
    selected[4].sub_stats = [['Recharge', .25]];
    const offSetFeather = {...selected[1], id: 7, set_name: 'Empty', main_stat: ['ATKFixed', 311]};
    const otherSand = {...selected[2], id: 8, main_stat: ['ElementalMastery', 187], sub_stats: [['ATKFixed', 200]]};
    const lowRechargeHead = {...selected[4], id: 9, sub_stats: [['ATKFixed', 200]]};
    const inventory = [...selected, offSetFeather, otherSand, lowRechargeHead];

    const expected = sum(api.CommonInterface.get_attribute({...base, buffs: [], artifacts: selected}).atk);
    const baseAttack = sum(api.CommonInterface.get_attribute({...base, artifacts: selected}).atk);
    assert.ok(baseAttack > expected);
    const input = {...base, target_function, filter: {sand_main_stat: ['ATKPercentage']}, constraint: {
        set_mode: {Set22: ['GladiatorsFinale', 'WanderersTroupe']}, atk_min: (expected + baseAttack) / 2, recharge_min: 1.2,
    }};

    for (const algorithm of ['AStar', 'Naive']) {
        const results = api.OptimizeSingleWasm.optimize({...input, algorithm}, inventory);
        assert.equal(results.length, 1);
        assert.deepEqual(slots.map(slot => results[0][slot.toLowerCase()]), selected.map(piece => piece.id));
        near(results[0].value, expected);
        assert.equal(results[0].ratio, 1);
    }
});

test('segmented search applies an inclusive base-panel maximum before ranking', () => {
    const dsl_source = 'state dry = { buffs: [] }\nprop atk = Mavuika.atk @dry\nresult = atk';
    const target_function = {name: 'MavuikaDefault', use_dsl: true, dsl_source, params: 'NoConfig'};
    const extraAttack = {...gear[1], id: 12, main_stat: ['ATKFixed', 311]};
    const strong = [gear[0], extraAttack, ...gear.slice(2)];
    const inventory = [...gear, extraAttack];
    const atkMax = readPanel(api, base, gear).atk;
    assert.ok(readPanel(api, base, strong).atk > atkMax);

    for (const algorithm of ['AStar', 'Naive']) {
        const input = {...base, target_function, algorithm};
        const unrestricted = api.OptimizeSingleWasm.optimize(input, inventory);
        assert.deepEqual(unrestricted.map(({feather}) => feather), [12, 2]);
        assert.ok(unrestricted[0].value < atkMax);

        const progress = [];
        const constraint = {set_mode: 'Any', panel_max: {atk: atkMax}};
        const rows = api.OptimizeSingleWasm.optimize({...input, constraint}, inventory, event => progress.push(event));
        assert.deepEqual(rows.map(({feather, value}) => [feather, value]), [[2, unrestricted[1].value]]);
        assert.equal(progress.at(-1).percent, 100);
        assert.equal(progress.at(-1).remainingGroups, 0);
    }
});

test('segmented search keeps nonpositive scores and ranks without a ratio', () => {
    const input = fixture('Kaeya');
    const weaker = {...input.artifacts[1], id: 12, main_stat: ['ATKFixed', 13]};
    const inventory = [...input.artifacts, weaker];
    for (const objective of ['-atk', '0']) {
        const source = 'state spare = { buffs: [] }\nprop atk = Kaeya.atk\nresult = ' + objective;
        const target_function = {name: 'Custom', use_dsl: true, dsl_source: source, params: 'NoConfig'};
        const rows = api.OptimizeSingleWasm.optimize({...input, target_function}, inventory);
        assert.deepEqual(rows.map(row => row.ratio), [null, null]);
        if (objective === '-atk') {
            assert.deepEqual(rows.map(row => row.feather), [12, 2]);
            near(rows[1].value, -readPanel(api, input, input.artifacts).atk);
            near(rows[0].value - rows[1].value, 298);
        } else {
            assert.deepEqual(rows.map(row => [row.feather, row.value]), [[2, 0], [12, 0]]);
        }
    }
});
