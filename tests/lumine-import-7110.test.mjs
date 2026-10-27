import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import { api, read, sum } from '../beta-tools/runtime-7106.mjs';
import { fixture, optimizer, namedBuff, weapon } from '../beta-tools/interface-audit-7108.mjs';
import { createMysConverter } from '../src/import/miyoushe.mjs';
import { characterSummary } from '../src/import/character-summary.mjs';
import { characterBuffProfile, groupCharacterBuffs, bindBuffConfig } from '../src/algorithms/buff-groups/index.mjs';
import { LUMINE_CHARGED_SECOND } from '../beta-data/traveler-model.mjs';
import { expandedWeaponEffects } from '../beta-data/expanded-weapons.mjs';
import * as vue from 'vue';
Object.assign(globalThis, { ref: vue.ref, computed: vue.computed, watch: vue.watch });

const characters = read('src/assets/_gen_character.js'), weapons = read('src/assets/_gen_weapon.js'), artifacts = read('src/assets/_gen_artifact.js'), targets = read('src/assets/_gen_tf.js'), buffs = read('src/assets/_gen_buff.js'), locale = read('src/i18n/generated/zh-cn.json');
const converter = createMysConverter({ characters, weapons, artifacts, targets, locale });
const uid = '999999999';
const near = (a, b, label = '') => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
const quiet = fn => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };
function rawCharacter(name, id = 10000007) {
    const meta = characters[name], element = { Anemo: 'Wind', Geo: 'Rock', Electro: 'Electric', Dendro: 'Grass', Hydro: 'Water', Pyro: 'Fire', Cryo: 'Ice' }[meta.element];
    return { base: { id, name: '旅行者', element, level: 90, actived_constellation_num: 6 },
        skills: [3, 1, 2].map(i => ({ skill_type: 1, name: locale[meta['skillName' + i]], level: 10 })),
        weapon: { name: locale[weapons.DullBlade.nameLocale], level: 90, promote_level: 6, affix_level: 1 }, relics: [] };
}
function loadStores() {
    const root = path.resolve('.'), require = createRequire(path.join(root, 'package.json')), ts = require('typescript'), cache = new Map();
    function load(file) {
        const absolute = path.resolve(root, file); if (cache.has(absolute)) return cache.get(absolute).exports;
        const m = new Module(absolute); cache.set(absolute, m); m.filename = absolute;
        m.require = spec => {
            if (spec.startsWith('@util/')) spec = '@/utils/' + spec.slice(6);
            if (spec.startsWith('@asset/')) spec = '@/assets/' + spec.slice(7);
            if (spec === '@/assets/artifacts') return { artifactsData: artifacts };
            if (spec === '@/assets/character') return { characterData: characters };
            if (spec === '@targetFunction') return { targetFunctionData: targets };
            if (spec === '@/assets/_gen_artifact') return { __esModule: true, default: artifacts };
            if (spec === '@/wasm') return {};
            if (!spec.startsWith('.') && !spec.startsWith('@/')) return require(spec);
            const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : path.resolve(path.dirname(absolute), spec);
            const target = [base, base + '.ts', base + '.js', base + '.json'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
            if (!target) throw Error('Unresolved import ' + spec);
            return target.endsWith('.json') ? JSON.parse(fs.readFileSync(target, 'utf8')) : load(target);
        };
        m._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, absolute);
        return m.exports;
    }
    return { store: load('src/store/pinia/miyoushe.ts').useMiyousheStore(), presets: load('src/store/pinia/preset.ts').usePresetStore(), inventory: load('src/store/pinia/artifact.ts').useArtifactStore() };
}

test('1 original traveler identity and names survive import, failed snapshot recovery and repeated real-store merging', () => {
    for (const element of ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']) for (const [prefix, id] of [['Aether', 10000005], ['Lumine', 10000007]]) {
        const raw = rawCharacter(prefix + element, id), before = structuredClone(raw), result = converter.character(raw, uid);
        assert.equal(result.id, id); assert.equal(result.gender, prefix); assert.equal(result.preset.character.name, prefix + element);
        assert.equal(result.key, `${uid}:${id}:${raw.base.element}`); assert.equal(result.label, locale[characters[prefix + element].nameLocale]);
        assert.deepEqual(raw, before);
    }
    const raw = rawCharacter('LumineDendro');
    const setName = Object.keys(artifacts).find(k => artifacts[k].name2 === 'GladiatorsFinale'), set = artifacts[setName];
    raw.relics = ['flower', 'feather', 'sand', 'cup', 'head'].map((position, i) => ({ pos: i + 1, name: locale[set[position].text], rarity: 5, level: 20,
        main_property: { property_type: i === 0 ? 2 : i === 1 ? 5 : 6, value: i === 0 ? '4780' : i === 1 ? '311' : '46.6%' }, sub_property_list: [{ property_type: 20, value: '7%' }, { property_type: 28, value: '23' }] }));
    const snapshot = { version: 1, source: 'miyoushe', role: { uid }, characters: [raw], importedAt: '2026-10-10T00:00:00Z' };
    const { store, inventory, presets } = loadStores(); inventory.init(null); presets.init(null);
    const key = `${uid}:10000007:Grass`;
    store.init({ snapshots: { [uid]: snapshot }, entries: [{ key, uid, label: '旅行者', error: '未知角色：旅行者' }] });
    const saved = store.data.value.snapshots[uid];
    const first = store.importSnapshot(saved, converter, '合成旧快照重新导入');
    assert.equal(first.imported, 1); assert.equal(first.rejected, 0); assert.equal(first.added, 5);
    const entry = store.data.value.entries[0], preset = presets.getPreset(entry.presetName).item, ids = [...entry.artifactIds];
    assert.equal(entry.error, undefined); assert.equal(entry.key, key); assert.equal(entry.id, 10000007); assert.equal(entry.gender, 'Lumine');
    assert.equal(preset.character.name, 'LumineDendro'); assert.equal(preset.targetFunction.name, 'LumineDendroDefault');
    const summary = characterSummary(entry, { raw, preset, characters, weapons, artifacts, locale, inventory: inventory.artifacts.value });
    assert.equal(summary.label, '荧-草'); assert.equal(summary.error, ''); assert.equal(summary.element, 'Dendro');
    preset.character.params = { LumineDendro: { c4_active: false } };
    const again = store.importSnapshot(saved, converter, '合成重新同步');
    assert.equal(again.added, 0); assert.equal(again.reused, 5); assert.equal(inventory.artifacts.value.size, 5);
    assert.deepEqual(store.data.value.entries[0].artifactIds, ids); assert.equal(presets.count.value, 1);
    assert.equal(presets.getPreset(entry.presetName).item.character.params.LumineDendro.c4_active, false);
});

test('2 female skill ratios keep flat additions and agree across damage, DSL, candidate optimization and stat gains', () => quiet(() => {
    fs.mkdirSync('.build-target/lumine-import-7110', { recursive: true });
    const report = [];
    for (const role of ['LumineAnemo', 'LumineGeo', 'LumineElectro', 'LumineDendro', 'LumineHydro', 'LuminePyro', 'LumineCryo']) {
        const x = fixture(role); x.artifacts = []; delete x.target_function;
        const panel = api.CommonInterface.get_attribute(x);
        const analysis = api.CalculatorInterface.get_damage_analysis({ ...x, skill: { ...x.skill, index: role === 'LumineGeo' ? 7 : 6 } }, null);
        near(sum(analysis.atk_ratio), 1.428, role + ' second ratio'); assert.ok(sum(panel.atk) > 0);
        report.push({ role, secondRatio: sum(analysis.atk_ratio), normal: analysis.normal.expectation });
    }
    for (const level of [0, 14]) {
        const x = fixture('LumineAnemo'); x.character.skill1 = level; x.skill.index = 6;
        near(sum(api.CalculatorInterface.get_damage_analysis(x, null).atk_ratio), LUMINE_CHARGED_SECOND[level], 'female talent boundary ' + level);
    }
    const redeclared = fixture('LumineAnemo');
    for (const [firstName, finalName, finalIndex] of [['Charged12', 'Normal1', 0], ['Normal1', 'Charged12', 6], ['Charged12', 'Charged12', 6]]) {
        const dsl = `dmg h = LumineAnemo.${firstName}\na = h.normal.e\ndmg h = LumineAnemo.${finalName}\nresult = a + h.normal.e\nprint(result)`;
        const result = api.DSLInterface.run(dsl, redeclared, redeclared.artifacts);
        assert.equal(result.is_error, true); assert.match(result.error_msg, /damage name must be unique/);
    }
    const copySource = 'dmg hit = LumineAnemo.Charged12\ndmg normal = LumineAnemo.Normal1\ncopy = hit\nhit = normal\nresult = copy.normal.e + hit.normal.e\nprint(result)';
    const copyResult = api.DSLInterface.run(copySource, redeclared, redeclared.artifacts);
    assert.equal(copyResult.is_error, false, copyResult.error_msg);
    const originalCharge = api.CalculatorInterface.get_damage_analysis({ ...redeclared, skill: { index: 6, config: 'NoConfig' } }, null).normal.expectation;
    const originalNormal = api.CalculatorInterface.get_damage_analysis({ ...redeclared, skill: { index: 0, config: 'NoConfig' } }, null).normal.expectation;
    near(Number(copyResult.output.trim().replace(/^MONA: /, '')), originalCharge + originalNormal, 'copied damage survives later variable assignment');
    const scalarSource = 'dmg hit = LumineAnemo.Charged12\nhit = hit.normal.e + hit.normal.e\nresult = hit\nprint(result)';
    const scalarResult = api.DSLInterface.run(scalarSource, redeclared, redeclared.artifacts);
    assert.equal(scalarResult.is_error, false, scalarResult.error_msg); near(Number(scalarResult.output.trim().replace(/^MONA: /, '')), originalCharge * 2, 'self scalar assignment uses original damage');
    for (const [role, index, firstSkill, secondSkill, kind] of [['LumineAnemo', 6, 'Charged11', 'Charged12', 'normal'], ['LumineGeo', 7, 'Charged1', 'Charged2', 'normal'], ['LumineCryo', 6, 'Charged1', 'Charged2', 'melt'], ['LumineCryo', 16, 'ChargedIceCondensation1', 'ChargedIceCondensation2', 'direct_stellarswirl']]) {
        const x = fixture(role); x.character.constellation = 6;
        if (role === 'LumineCryo') x.character.params[role].radiance_mode = 2;
        x.skill.index = index;
        x.buffs = [{ name: 'ExtensionEffect', config: { ExtensionEffect: { label: '合成定额', values: { ExtraDmgChargedAttack: 300 } } } }];
        const original = structuredClone(x), hit = api.CalculatorInterface.get_damage_analysis(x, null), first = api.CalculatorInterface.get_damage_analysis({ ...x, skill: { ...x.skill, index: index - 1 } }, null);
        const male = { ...x, character: { ...x.character, name: role.replace('Lumine', 'Aether'), params: x.character.params === 'NoConfig' ? 'NoConfig' : { [role.replace('Lumine', 'Aether')]: x.character.params[role] } }, skill: { ...x.skill, config: x.skill.config === 'NoConfig' ? 'NoConfig' : { [role.replace('Lumine', 'Aether')]: x.skill.config[role] } } };
        const maleSecond = api.CalculatorInterface.get_damage_analysis(male, null);
        const ratioKey = index === 16 ? 'direct_stellarswirl_ratio' : 'atk_ratio';
        near(sum(hit[ratioKey]), LUMINE_CHARGED_SECOND[x.character.skill1], role + ' ratio');
        assert.ok(hit[kind].expectation > maleSecond[kind].expectation);
        assert.deepEqual(hit.extra_damage, maleSecond.extra_damage);
        const config = role === 'LumineCryo' ? '({e_infusion: true})' : '';
        const dsl = `// LumineAnemo.Charged12 must remain in this comment\ndmg hit = ${role}.${secondSkill}${config}\ndmg first = ${role}.${firstSkill}${config}\ncopy = (hit) number = copy.${kind}\nLumineAnemo = hit\nresult = number.expectation + (LumineAnemo).${kind}.c * 0.1 + first.${kind}.n\nprint(result)`;
        const result = api.DSLInterface.run(dsl, x, x.artifacts); assert.equal(result.is_error, false, result.error_msg);
        near(Number(result.output.trim().replace(/^MONA: /, '')), hit[kind].expectation + hit[kind].critical * .1 + first[kind].non_critical, role + ' DSL');
        const source = `dmg hit = ${role}.${secondSkill}${config}\nresult = hit.${kind}.e`;
        x.target_function = { name: role === 'LumineCryo' ? 'LumineCryoDefault' : 'MaxATK', params: 'NoConfig', use_dsl: true, dsl_source: source };
        const strong = { ...structuredClone(x.artifacts[4]), id: 6, sub_stats: [...x.artifacts[4].sub_stats, ['ATKFixed', 450], ['CriticalDamage', .7]] };
        const candidates = [...x.artifacts, strong], candidate = { ...x, artifacts: x.artifacts.map(a => a.slot === 'Head' ? strong : a) };
        const expected = api.CalculatorInterface.get_damage_analysis(candidate, null)[kind].expectation;
        const best = api.OptimizeSingleWasm.optimize(optimizer(x), candidates)[0]; assert.equal(best.head, 6); near(best.value, expected, role + ' candidate');
        const gain = api.BonusPerStat.bonus_per_stat({ ...x, tf: x.target_function, artifacts_config: null });
        const improved = structuredClone(x); improved.artifacts[0].sub_stats.push(['ATKPercentage', .058]);
        near(gain.atk_percentage[0], api.CalculatorInterface.get_damage_analysis(improved, null)[kind].expectation / hit[kind].expectation - 1, role + ' stat gain');
        x.target_function = original.target_function; assert.deepEqual(x, original);
        report.push({ role, index, kind, actual: hit[kind].expectation, male: maleSecond[kind].expectation, selectedHead: best.head, optimized: best.value });
    }
    for (const [mode, stacks] of [[0, 0], [1, 8], [2, 8]]) {
        const x = fixture('LumineCryo'); x.character.constellation = 6;
        Object.assign(x.character.params.LumineCryo, { radiance_mode: mode, cold_glow_stacks: stacks });
        x.skill.config.LumineCryo.radiance_mode = mode;
        x.buffs = [{ name: 'ExtensionEffect', config: { ExtensionEffect: { label: '合成定额', values: { ExtraDmgChargedAttack: 300, ExtraDmgNormalAttack: 200 } } } }];
        const male = { ...x, character: { ...x.character, name: 'AetherCryo', params: { AetherCryo: x.character.params.LumineCryo } }, skill: { ...x.skill, config: { AetherCryo: x.skill.config.LumineCryo } }, target_function: { ...x.target_function, name: 'AetherCryoDefault' } };
        const kind = ['normal', 'direct_stellarconduct', 'direct_stellarswirl'][mode];
        const expected = input => {
            const hit = index => api.CalculatorInterface.get_damage_analysis({ ...input, skill: { ...input.skill, index } }, null);
            return 3 * (hit(0).normal.expectation + hit(1).normal.expectation) + hit(8).normal.expectation + hit(mode ? 15 : 5)[kind].expectation + hit(mode ? 16 : 6)[kind].expectation + (stacks >= 8 ? 5 : 3) * hit(12 + mode)[kind].expectation;
        };
        const maleBest = api.OptimizeSingleWasm.optimize(optimizer(male), male.artifacts)[0];
        near(maleBest.value, expected(male), 'published Cryo default mode ' + mode);
        const femaleBest = api.OptimizeSingleWasm.optimize(optimizer(x), x.artifacts)[0];
        near(femaleBest.value, expected(x), 'female Cryo default mode ' + mode);
        assert.ok(femaleBest.value > maleBest.value);
        report.push({ role: 'LumineCryo', target: 'default', mode, stacks, male: maleBest.value, female: femaleBest.value });
        if (mode === 2) fs.writeFileSync('.build-target/lumine-import-7110/worker-input.json', JSON.stringify({ input: optimizer(x), artifacts: x.artifacts, expected: femaleBest.value }, null, 2) + '\n');
    }
    fs.writeFileSync('.build-target/lumine-import-7110/consumer-evidence.json', JSON.stringify(report, null, 2) + '\n');
}));

test('3 UI catalog, dedicated targets, saved female BUFF profiles and browser/Node registration agree', () => quiet(() => {
    const ownership = read('src/algorithms/buff-groups/ownership.json');
    const x = fixture('LumineCryo'); x.character.constellation = 6; x.character.skill2 = 8;
    const profile = characterBuffProfile('LumineCryo', uid, [{ uid, key: `${uid}:10000007:Ice`, presetName: '荧' }], { 荧: { item: x } });
    assert.equal(profile.imported, true); assert.equal(profile.skill2, 9);
    const groups = groupCharacterBuffs(['LumineCryoTalent1', 'LumineCryoC2', 'LumineCryoC6'].map(name => ({ ...buffs[name], title: locale[buffs[name].nameLocale] })), ownership);
    assert.equal(groups.length, 1); assert.equal(groups[0].character, 'LumineCryo'); assert.equal(groups[0].buffs.length, 3);
    for (const role of ['LumineDendro', 'LumineCryo']) assert.equal(targets[role + 'Default'].for, role);
    const buff = namedBuff('LumineCryoC2'); assert.equal(bindBuffConfig(buffs.LumineCryoC2, profile)[buff.name].stellar_triggered, true);
    const recipient = fixture('Kaeya'), plain = sum(api.CommonInterface.get_attribute(recipient).elemental_mastery);
    near(sum(api.CommonInterface.get_attribute({ ...recipient, buffs: [buff] }).elemental_mastery) - plain, 120, 'female source BUFF');
    const female = fixture('LumineCryo'), male = fixture('AetherCryo');
    for (const name of ['SilverLight', 'ExaiphanesBlade']) {
        const w = weapon(name);
        if (name === 'SilverLight') w.params[name].stacks = 2;
        else { w.refine = 2; Object.assign(w.params[name], { hit_active: true, resonated_elements: 3 }); }
        female.weapon = w; male.weapon = w;
        assert.deepEqual(api.CommonInterface.get_attribute(female), api.CommonInterface.get_attribute(male));
        assert.deepEqual(expandedWeaponEffects(w, { characterName: 'LumineCryo' }), expandedWeaponEffects(w, { characterName: 'AetherCryo' }));
        if (name === 'SilverLight') {
            const none = structuredClone(female); none.weapon.params[name].stacks = 0;
            near(sum(api.CommonInterface.get_attribute(female).elemental_mastery) - sum(api.CommonInterface.get_attribute(none).elemental_mastery), 104, 'female SilverLight stacks');
        } else assert.ok(expandedWeaponEffects(w, { characterName: 'LumineCryo' }).attackPercentage > 0);
    }
    assert.deepEqual(characters.LumineHydro.skillMap1.filter(row => [5,6].includes(row.index)).map(row => row.text), [3159,3160]);
    for (const file of ['mona_wasm/pkg/index.js', 'beta-tools/runtime-7106.mjs']) assert.match(fs.readFileSync(file, 'utf8'), /withLumineTraveler\(withHybridTeamOptimization\(createExpandedWeaponsFacade/);
    for (const file of ['/characters/lumine-avatar.png', '/characters/lumine-splash.png']) { const bytes = fs.readFileSync('public' + file); assert.equal(bytes.readUInt32BE(0), 0x89504e47); }
    assert.equal(characterSummary({ key: 'failed', label: '旅行者', error: '未知角色：旅行者' }, { raw: rawCharacter('LumineCryo'), characters, weapons, artifacts, locale, inventory: new Map() }).label, '荧-冰');
}));
