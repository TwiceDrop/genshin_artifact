import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';
import {api, read, sum} from '../beta-tools/runtime-7106.mjs';
import {fixture, optimizer} from '../beta-tools/interface-audit-7108.mjs';
import {createMysConverter, mergeEquipped} from '../src/import/miyoushe.mjs';
import * as importHistory from '../src/import/import-history.mjs';
import * as uidInventory from '../src/import/uid-inventory.mjs';

const characters = read('src/assets/_gen_character.js'), weapons = read('src/assets/_gen_weapon.js');
const artifacts = read('src/assets/_gen_artifact.js'), targets = read('src/assets/_gen_tf.js'), locale = read('src/i18n/generated/zh-cn.json');
const A = [.336, .3612, .3864, .42, .4452, .4704, .504, .5376, .5712, .6048, .6384, .672, .714, .756, .798];
const B = [2.2592, 2.4286, 2.5981, 2.824, 2.9934, 3.1629, 3.3888, 3.6147, 3.8406, 4.0666, 4.2925, 4.5184, 4.8008, 5.0832, 5.3656];
const uid = '999999999', report = {kernel: process.env.MONA_PROGRESS === '1' ? 'progress' : 'standard', imports: [], formulas: [], optimization: []};
const near = (a, b, label) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
after(() => {
    const dir = '.build-target/illuga-fix-20261025'; fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(`${dir}/${report.kernel}.json`, JSON.stringify(report, null, 2));
});
function input(q = 1, constellation = 0) {
    const x = fixture('Illuga');
    Object.assign(x.character, {level: 80, skill1: 0, skill2: 0, skill3: q - 1, constellation});
    x.skill = {index: 8, config: 'NoConfig'};
    return x;
}
const converter = createMysConverter({characters, weapons, artifacts, targets, locale, inferAscend(c, w, hp) {
    if (!Number.isFinite(hp)) return undefined;
    const values = [false, true].map(ascend => api.CommonInterface.get_attribute({character: {...c, ascend}, weapon: w, artifacts: [], buffs: [], artifact_config: null}).hp['角色基础生命']);
    const errors = values.map(n => Math.abs(n - hp));
    if (Math.min(...errors) > 3 || Math.abs(values[0] - values[1]) < 1) return undefined;
    return errors[1] < errors[0];
}});
function raw(level, ascend) {
    const x = input(), c = {...x.character, level, ascend};
    const hp = api.CommonInterface.get_attribute({...x, character: c, artifacts: []}).hp['角色基础生命'];
    return {base: {id: 99901001, name: locale[characters.Illuga.nameLocale], element: 'Rock', level, actived_constellation_num: 0},
        weapon: {name: locale[weapons.BeginnersProtector.nameLocale], level: 90, promote_level: 6, affix_level: 1},
        skills: [1, 2, 3].map(i => ({skill_type: 1, name: locale[characters.Illuga['skillName' + i]], level: 1})),
        selected_properties: [{property_type: 2000, base: String(hp)}], relics: []};
}
function storeHarness() {
    const inventory = {artifacts: vue.ref(new Map()), addArtifact(a) {const id = this.artifacts.value.size; this.artifacts.value.set(id, {...a, id}); return id;}};
    const presets = {presets: vue.ref({}), addOrOverwrite(name, item) {this.presets.value[name] = {name, item};}, getPreset(name) {return this.presets.value[name];}};
    const modules = {vue, '@/import/import-history.mjs': importHistory, '@/import/uid-inventory.mjs': uidInventory,
        './artifact': {useArtifactStore: () => inventory}, './preset': {usePresetStore: () => presets}, '@/import/miyoushe.mjs': {mergeEquipped}}, exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/store/pinia/miyoushe.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext}}).outputText, {exports, require: key => modules[key]});
    return {store: exports.useMiyousheStore(), presets};
}

test('import: Q1 infers both ascension states at six breakpoints and replaces a previous failed entry without changing raw data', () => {
    for (const level of [20, 40, 50, 60, 70, 80]) for (const ascend of [false, true]) {
        const value = raw(level, ascend), before = JSON.stringify(value), r = converter.character(value, uid);
        assert.equal(r.preset.character.skill3, 0); assert.equal(r.preset.character.ascend, ascend);
        assert.equal(r.preset.character.params.Illuga.q_buff_active, true); assert.equal(JSON.stringify(value), before);
        report.imports.push({level, ascend, imported: true});
    }
    const value = raw(80, false), before = JSON.stringify(value), key = `${uid}:99901001:Rock`, {store, presets} = storeHarness();
    store.init({snapshots: {}, entries: [{key, uid, label: '叶洛亚', error: 'unreachable'}]});
    const snapshot = {version: 1, source: 'miyoushe', role: {uid}, characters: [value], importedAt: '2026-10-25T00:00:00Z'};
    const imported = store.importSnapshot(snapshot, converter);
    assert.equal(imported.imported, 1); assert.equal(imported.rejected, 0); assert.equal(store.data.value.entries[0].error, undefined);
    const name = store.data.value.entries[0].presetName, preset = JSON.stringify(presets.getPreset(name).item);
    const again = store.importSnapshot(snapshot, converter); assert.equal(again.imported, 1); assert.equal(again.added, 0);
    assert.equal(Object.keys(presets.presets.value).length, 1); assert.equal(JSON.stringify(presets.getPreset(name).item), preset);
    assert.equal(JSON.stringify(value), before);
});

test('single hit: Q1/Q2/Q10/Q15 use the correct two tables, independent final damage, and activation/C6 controls', () => {
    for (const [q, constellation, enabled] of [[1, 0, true], [2, 0, true], [10, 0, true], [15, 0, true], [1, 6, true], [15, 6, true], [1, 0, false]]) {
        const x = input(q, constellation); x.character.params.Illuga.q_buff_active = enabled;
        const before = structuredClone(x), r = api.CalculatorInterface.get_damage_analysis(x, null), em = sum(r.em);
        const geo = enabled ? em * (A[q - 1] + .07) : 0, moon = enabled ? em * (B[q - 1] + .48) : 0;
        near(sum(r.extra_damage), geo, 'Geo flat Q' + q); near(sum(r.direct_mooncrystallize_extra_fixed), moon, 'Moon flat Q' + q);
        const base = sum(r.atk) * sum(r.atk_ratio) + sum(r.def) * sum(r.def_ratio) + sum(r.hp) * sum(r.hp_ratio) + em * sum(r.em_ratio) + geo;
        const noncrit = base * .9 * 180 / 370, critical = sum(r.critical), cdmg = sum(r.critical_damage);
        near(r.normal.non_critical, noncrit, 'independent noncrit'); near(r.normal.critical, noncrit * (1 + cdmg), 'independent crit');
        near(r.normal.expectation, noncrit * (1 + critical * cdmg), 'independent expectation'); assert.deepEqual(x, before);
        report.formulas.push({q, constellation, enabled, em, geo, moon, expectation: r.normal.expectation});
    }
});

test('single optimization: both algorithms rescore live EM candidates, default and DSL targets; DSL and EM gains agree with single hit', () => {
    for (const q of [1, 10]) {
        const x = input(q), alt = {...structuredClone(x.artifacts[2]), id: 6, main_stat: ['ElementalMastery', 187]}, pool = [...x.artifacts, alt];
        const inputs = [x, {...x, artifacts: x.artifacts.map(a => a.slot === 'Sand' ? alt : a)}];
        const expected = inputs.map(row => {
            const r = api.CalculatorInterface.get_damage_analysis(row, null), em = sum(r.em);
            assert.ok(sum(api.CommonInterface.get_attribute(row).recharge) >= 1.4);
            return {sand: row.artifacts[2].id, default: em * (A[q - 1] + B[q - 1] + .07 + .48), dsl: r.normal.expectation};
        });
        const source = 'dmg hit = Illuga.ETap\nresult = hit.normal.e';
        for (const target of ['default', 'dsl']) for (const algorithm of ['Naive', 'AStar']) {
            const config = structuredClone(optimizer(x)); config.algorithm = algorithm;
            if (target === 'dsl') config.target_function = {...config.target_function, use_dsl: true, dsl_source: source};
            const before = JSON.stringify({config, pool}), best = api.OptimizeSingleWasm.optimize(config, pool)[0];
            const winner = [...expected].sort((a, b) => b[target] - a[target])[0];
            assert.equal(best.sand, winner.sand); near(best.value, winner[target], `${target} ${algorithm} Q${q}`);
            assert.equal(JSON.stringify({config, pool}), before);
            report.optimization.push({q, target, algorithm, sand: best.sand, value: best.value});
        }
        const dsl = api.DSLInterface.run(source + '\nprint(result)', x, x.artifacts); assert.equal(dsl.is_error, false, dsl.error_msg);
        near(Number(dsl.output.trim().replace(/^MONA: /, '')), expected[0].dsl, 'DSL single');
        x.target_function = {...x.target_function, use_dsl: true, dsl_source: source};
        const gain = api.BonusPerStat.bonus_per_stat({...x, tf: x.target_function, artifacts_config: null});
        const improved = structuredClone(x); improved.artifacts[0].sub_stats.push(['ElementalMastery', 23]);
        near(gain.elemental_mastery[0], api.CalculatorInterface.get_damage_analysis(improved, null).normal.expectation / expected[0].dsl - 1, 'EM gain');
    }
});
