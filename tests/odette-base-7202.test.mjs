import test from 'node:test';
import assert from 'node:assert/strict';
import {api, read, sum} from '../beta-tools/runtime-7106.mjs';
import {input, named, gear} from '../beta-tools/preview-7201-fixtures.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {compilePreviewBuff} from '../beta-data/preview-7201-facade.mjs';
import {deriveTeamBuffs} from '../beta-data/hybrid-team-optimizer.mjs';
import {generateDsl} from '../src/algorithms/dsl-generator.mjs';

const close = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const hit = x => api.CalculatorInterface.get_damage_analysis(x, null);
const blessing = (atk, mode = 1) => named('OdetteTalent1', {atk, radiance_mode: mode});
// Level-10 Mitya Skill: 403.2% EM; own blessing 2.8% per 100 EM, capped at 14%.
// Synthetic fixture has 25% CR / 88.4% CD and enemy resistance multiplier 0.9.
const expectedDamage = (em, baseBonus) => em * 4.032 * (1 + Math.min(em * .00028, .14) + baseBonus) * (1 + 6 * em / (2000 + em)) * .9;

test('Odette blessing: independent slope/cap, separate modes and disabled effects', () => {
    for (const [atk, expected] of [[1000, .07], [2000, .14], [3000, .14]]) {
        const x = input();
        x.buffs = [blessing(atk)];
        const result = hit(x);
        close(result.direct_stellarconduct.non_critical, expectedDamage(100, expected));
        close(result.direct_stellarconduct.expectation, expectedDamage(100, expected) * (1 + .25 * .884));
        for (const role of ['Mitya', 'Valeriy']) for (const mode of [0, 1, 2]) {
            const values = Object.assign({}, ...compilePreviewBuff(blessing(atk, mode), input(role)).map(b => b.config.ExtensionEffect.values));
            close(values.StellarConductBaseBonus || 0, mode === 1 ? expected : 0);
            close(values.StellarSwirlBaseBonus || 0, mode === 2 ? expected : 0);
        }
    }
    for (const buff of [{...blessing(2000), lock: true}, named('OdetteTalent1', {atk: 2000, radiance_mode: 1, active: false}), blessing(2000, 0), blessing(2000, 2)]) {
        close(hit({...input(), buffs: [buff]}).direct_stellarconduct.non_critical, expectedDamage(100, 0));
    }
});

test('Team-derived Odette blessing reaches actual DSL and candidate optimization', () => {
    const x = input(), source = fixture('Odette');
    source.artifacts = [];
    source.buffs = [named('ATKFixed', {value: 2000})];
    source.team_effects = {support_triggers: {odetteBlessing: true, odetteRadianceMode: 1}};
    x.buffs = deriveTeamBuffs(api, [x, source], [[], []], 0);
    assert.equal(x.buffs.length, 1);
    assert.ok(x.buffs[0].config.OdetteTalent1.atk > 2000);
    close(hit(x).direct_stellarconduct.non_critical, expectedDamage(100, .14));
    const dsl = generateDsl({character: 'Mitya', entries: [{token: read('beta-data/dsl-skill-names.json').Mitya[8], params: {}, infusion: 'None', reaction: 'direct_stellarconduct', value: 'e', count: 1, weight: 1}]});
    x.artifacts = structuredClone(gear);
    const alternative = {...structuredClone(gear[2]), id: 6, main_stat: ['ElementalMastery', 287]};
    const original = JSON.stringify(x);
    for (const artifacts of [x.artifacts, x.artifacts.map(a => a.slot === 'Sand' ? alternative : a)]) {
        const em = 100 + artifacts.reduce((n, a) => n + (a.main_stat[0] === 'ElementalMastery' ? a.main_stat[1] : 0), 0);
        const expected = expectedDamage(em, .14) * (1 + .25 * .884);
        close(hit({...x, artifacts}).direct_stellarconduct.expectation, expected);
        const result = api.DSLInterface.run(dsl + '\nprint(result)', x, artifacts);
        assert.equal(result.is_error, false, result.error_msg);
        close(Number(result.output.trim().replace(/^MONA: /, '')), expected);
    }
    const target = {name: 'MityaDefault', params: 'NoConfig', use_dsl: true, dsl_source: dsl};
    const result = api.OptimizeSingleWasm.optimize({...x, target_function: target, algorithm: 'Naive', constraint: {set_mode: 'Any'}, filter: null}, [...x.artifacts, alternative]);
    close(result[0].value, expectedDamage(100 + 187 * 2 + 287, .14) * (1 + .25 * .884));
    assert.equal(JSON.stringify(x), original);
});

test('Original native Odette self blessing and older recipient keep the 14% cap', () => {
    const own = fixture('Odette');
    own.artifacts = [];
    own.character.params.Odette.radiance_mode = 1;
    own.buffs = [named('ATKFixed', {value: 2000})];
    own.skill.index = 12;
    close(sum(hit(own).direct_stellarconduct_base_compose), .14);
    const receiver = fixture('Qiqi');
    receiver.artifacts = [];
    receiver.buffs = [blessing(2000)];
    close(sum(hit(receiver).direct_stellarconduct_base_compose), .14);
});
