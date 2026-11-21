import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import {singleCalculatorInputs} from './helpers/single-calculator-inputs.mjs'
import {singleSearchArtifactConfig} from '../src/algorithms/single-artifact-effects.mjs'
import {prepareLunarEquipmentBuffs} from '../beta-data/lunar-equipment-rules.mjs'
import sets from '../src/assets/_gen_artifact.js'
import characters from '../src/assets/_gen_character.js'

const snake = name => name.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`).replace(/^_/, '')
const defaults = () => Object.fromEntries(Object.values(sets).filter(s => s.config2.length || s.config4.length)
    .map(s => [`config_${snake(s.name2)}`, Object.fromEntries([...s.config2, ...s.config4].map(c => [c.name, c.default]))]))

test('the four later artifact sets expose explicit inactive conditions', () => {
    for (const name of ['AubadeOfMorningstarAndMoon', 'ADayCarvedFromRisingWinds', 'HeavensGift', 'DisenchantmentInDeepShadow']) {
        const set = sets[name]
        assert.ok(set && set.config4.length, name)
        assert.equal(set.config4.find(config => config.name === 'rate')?.default, 0, name)
    }
    assert.equal(sets.HeavensGift.config4.find(config => config.name === 'on_field_element')?.default, 0)
    for (const name of ['AubadeOfMorningstarAndMoon', 'ADayCarvedFromRisingWinds']) assert.equal(sets[name].minStar, 4)
})

test('single automatic sets distinguish the wearer from active character BUFF sources', () => {
    const config = (name, ...buffs) => singleSearchArtifactConfig({}, name,
        buffs.map(b => typeof b === 'string' ? {name: b} : b))
    for (const name of ['Mualani', 'Ifa', 'Ororon', 'LuminePyro', 'AetherPyro']) {
        assert.deepEqual(config(name).config_obsidian_codex, {set2_rate: 1, set4_rate: 1})
    }
    assert.deepEqual(config('LumineCryo', 'CitlaliTalent1').config_obsidian_codex, {set2_rate: 0, set4_rate: 0})
    assert.deepEqual(config('Mona').config_heavens_gift,
        {rate: 1, is_completed_witch_homework: true, is_secret_arts: true, on_field_element: 7})
    assert.equal(config('Kaeya', 'MonaMagusGlow').config_heavens_gift.rate, 0)
    for (const [name, buffs, expected] of [
        ['Fischl', ['LumineCryoC2'], 1], ['Qiqi', ['RaidenShogunE'], 1],
        ['Keqing', ['RaidenShogunE'], 0], ['Kaeya', ['ShenheE'], 0],
        ['Keqing', ['ResonanceCryo', 'CriticalBase'], 0], ['Mona', ['ShenheE', 'RaidenShogunE'], 0],
    ]) assert.equal(config(name, ...buffs).config_disenchantment_in_deep_shadow.rate, expected, name)
    assert.equal(config('Sucrose', {name: 'ATKPercentage', source_character: 'Qiqi'}).config_scarlet_proof.rate, 1)
    assert.equal(config('Sucrose', 'RaidenShogunE').config_scarlet_proof.rate, 0)
    assert.equal(config('Ganyu', 'KaedeharaKazuhaTalent2').config_scarlet_proof.rate, 0)
    const sources = [{sourceId: 'preset:fixture', characterName: 'Qiqi'}]
    assert.equal(singleSearchArtifactConfig({}, 'Venti', [], sources).config_scarlet_proof.rate, 0)
    assert.equal(singleSearchArtifactConfig({}, 'Venti', [{name:'ATKPercentage', source_id:'preset:fixture'}], sources).config_scarlet_proof.rate, 1)
    for (const name of Object.keys(characters)) assert.equal(config(name).config_heart_of_the_furnace.rate, 1)
})

test('automatic damage and panel searches follow BUFF changes while manual values and previews are preserved', () => {
    const manual = vue.ref(defaults()), mode = vue.ref('auto')
    const buffs = vue.reactive([{name: 'ShenheE'}])
    manual.value.config_scarlet_proof.rate = 0.35
    manual.value.config_heart_of_the_furnace.rate = 0
    const inputs = singleCalculatorInputs({character: {name: 'Venti'}, buffs}, [], manual, mode)
    const previous = inputs.optimize().artifact_config
    assert.equal(previous.config_scarlet_proof.rate, 1)
    assert.equal(previous.config_heart_of_the_furnace.rate, 1)
    assert.equal(inputs.panel().artifact_config.config_scarlet_proof.rate, 1)
    buffs.pop()
    assert.equal(inputs.optimize().artifact_config.config_scarlet_proof.rate, 0)
    assert.equal(previous.config_scarlet_proof.rate, 1)
    assert.equal(inputs.preview.value.artifact_config.config_scarlet_proof.rate, 0.35)
    mode.value = 'custom'
    assert.deepEqual(inputs.optimize().artifact_config, JSON.parse(JSON.stringify(manual.value)))
    assert.deepEqual(inputs.panel().artifact_config, inputs.optimize().artifact_config)
})

test('single artifact searches grant five Long Night stacks to plunge wearers and both Finale bonuses to Skirk', () => {
    const manual = vue.ref(defaults()), mode = vue.ref('auto')
    const inputs = name => singleCalculatorInputs({character: {name}, buffs: [{name: 'XianyunTalent2'}]}, [], manual, mode)
    for (const name of ['Varesa', 'Xiao', 'Gaming', 'Xianyun']) {
        const {optimize, panel} = inputs(name)
        assert.equal(optimize().artifact_config.config_long_nights_oath.level, 5, name)
        assert.equal(panel().artifact_config.config_long_nights_oath.level, 5, name)
    }
    const skirk = inputs('Skirk'), kaeya = inputs('Kaeya')
    assert.equal(skirk.optimize().artifact_config.config_long_nights_oath.level, 0)
    for (const search of [skirk.optimize, skirk.panel]) {
        assert.deepEqual(search().artifact_config.config_finale_of_the_deep_galleries, {rate1: 1, rate2: 1})
    }
    assert.deepEqual(kaeya.optimize().artifact_config.config_finale_of_the_deep_galleries, {rate1: 0, rate2: 0})
    manual.value.config_finale_of_the_deep_galleries.rate1 = 0.4
    manual.value.config_long_nights_oath.level = 2
    assert.equal(kaeya.optimize().artifact_config.config_finale_of_the_deep_galleries.rate1, 0.4)
    mode.value = 'custom'
    assert.equal(skirk.optimize().artifact_config.config_finale_of_the_deep_galleries.rate1, 0.4)
    assert.equal(inputs('Varesa').optimize().artifact_config.config_long_nights_oath.level, 2)
})

test('Deepwood follows the wearer and Gilded counts distinct enabled teammate owners in both searches', () => {
    const manual = vue.ref(defaults()), mode = vue.ref('auto')
    manual.value.config_deepwood_memories.rate = 0.4
    manual.value.config_gilded_dreams = {same_count: 1, diff_count: 1, rate: 0.5}
    const buffs = vue.reactive([{name: 'NahidaTalent1'}, {name: 'ResonanceDendro'}, {name: 'HPPercentage'}])
    const sources = [{sourceId: 'support', characterName: 'Fischl'}]
    const {optimize, panel} = singleCalculatorInputs({character: {name: 'Nahida'}, buffs, sources}, [], manual, mode)
    function check(same_count, diff_count, rate, deepwood = 1) {
        for (const search of [optimize, panel]) {
            const config = search().artifact_config
            assert.deepEqual(config.config_gilded_dreams, {same_count, diff_count, rate})
            assert.equal(config.config_deepwood_memories.rate, deepwood)
        }
    }
    check(0, 0, 0)
    buffs.push({name: 'FischlWitchEve'}, {name: 'HPPercentage', source_id: 'support'}, {name: 'RaidenShogunE'})
    check(0, 2, 1)
    buffs.push(...['Yaoyao', 'Baizhu', 'Tighnari', 'Collei', 'Xingqiu', 'Bennett'].map(source_character =>
        ({name: 'HPPercentage', source_character})))
    check(3, 3, 1)
    buffs.splice(3)
    check(0, 0, 0)
    mode.value = 'custom'
    check(1, 1, 0.5, 0.4)
    assert.equal(singleSearchArtifactConfig({}, 'Fischl', [{name: 'NahidaTalent1'}]).config_deepwood_memories.rate, 0)
})

test('early sets distinguish wearer conditions from enabled BUFF elements in both single search modes', () => {
    const manual = vue.ref(defaults()), mode = vue.ref('auto')
    const buffs = vue.reactive([{name: 'ResonanceElectro'}])
    manual.value.config_archaic_petra.element = 'Hydro'
    const input = name => singleCalculatorInputs({character: {name}, buffs,
        sources: [{sourceId: 'support', characterName: 'Bennett'}]}, [], manual, mode)
    const albedo = input('Albedo')
    function checkAuras(electro, pyro) {
        for (const search of [albedo.optimize, albedo.panel]) {
            const config = search().artifact_config
            assert.equal(config.config_thundersoother.rate, electro)
            assert.equal(config.config_lavawalker.rate, pyro)
        }
    }
    checkAuras(0, 0)
    buffs.push({name: 'RaidenShogunE'}, {name: 'ATKPercentage', source_id: 'support'})
    checkAuras(1, 1)
    buffs.splice(1, 1)
    checkAuras(0, 1)
    buffs.pop()
    checkAuras(0, 0)
    assert.equal(input('Fischl').optimize().artifact_config.config_thundersoother.rate, 1)
    assert.equal(input('Amber').optimize().artifact_config.config_lavawalker.rate, 1)
    for (const [name, data] of Object.entries(characters)) {
        const cfg = singleSearchArtifactConfig(manual.value, name, [])
        assert.deepEqual(cfg.config_archaic_petra, {element: 'Hydro', rate: Number(data.element === 'Geo')}, name)
        assert.equal(cfg.config_blizzard_strayer.critical_bonus, name === 'KamisatoAyaka' ? 0.4 : 0, name)
        assert.deepEqual(cfg.config_pale_flame, name === 'Eula' ? {avg_level: 2, full_rate: 1} : {avg_level: 0, full_rate: 0}, name)
        assert.equal(cfg.config_crimson_witch_of_flames.level, 1.5)
        for (const set of ['noblesse_oblige', 'heart_of_depth', 'tenacity_of_the_millelith']) assert.equal(cfg['config_' + set].rate, 1)
    }
    mode.value = 'custom'
    assert.deepEqual(albedo.optimize().artifact_config, JSON.parse(JSON.stringify(manual.value)))
})

test('Inazuma sets use only the wearer in automatic searches and preserve custom settings', () => {
    const manual = vue.ref(defaults()), mode = vue.ref('auto')
    const husk = ['Albedo', 'AratakiItto', 'Gorou', 'Noelle', 'Yunjin', 'Chiori', 'Kachina', 'Xilonen', 'Zibai', 'Linnea', 'Illuga']
    for (const [wearer, data] of Object.entries(characters)) {
        if (data.element !== 'Geo' && !['Yoimiya', 'Xiao', 'Amber'].includes(wearer)) continue
        const config = singleSearchArtifactConfig(manual.value, wearer, [{name: 'HPPercentage', source_character: 'Xiao'}])
        assert.equal(config.config_husk_of_opulent_dreams.level, husk.includes(wearer) ? 4 : 0, wearer)
        assert.equal(config.config_shimenawas_reminiscence.rate, Number(wearer === 'Yoimiya'), wearer)
        assert.deepEqual(config.config_vermillion_hereafter, wearer === 'Xiao' ? {rate_q: 1, stack: 4} : {rate_q: 0, stack: 0}, wearer)
    }
    manual.value.config_vermillion_hereafter = {rate_q: 0.5, stack: 2}
    const {optimize, panel, preview} = singleCalculatorInputs({character: {name: 'Xiao'}, buffs: []}, [], manual, mode)
    for (const search of [optimize, panel]) assert.deepEqual(search().artifact_config.config_vermillion_hereafter, {rate_q: 1, stack: 4})
    assert.equal(preview.value.artifact_config.config_vermillion_hereafter.stack, 2)
    mode.value = 'custom'
    assert.deepEqual(optimize().artifact_config.config_vermillion_hereafter, {rate_q: 0.5, stack: 2})
})

test('Fontaine automatic sets use the wearer and enabled BUFF owners independently', () => {
    const config = (name, ...buffNames) => singleSearchArtifactConfig({}, name, buffNames.map(name => ({name})))
    for (const name of Object.keys(characters)) {
        const auto = config(name)
        assert.equal(auto.config_marechaussee_hunter.stack, ['Neuvillette', 'Wriothesley'].includes(name) ? 3 : 0, name)
        assert.equal(auto.config_golden_troupe.rate, Number(['Fischl', 'Furina', 'YaeMiko'].includes(name)), name)
        const coverage = Number(name === 'Navia')
        assert.deepEqual(auto.config_nighttime_whispers_in_the_echoing_woods, {rate1: coverage, rate2: coverage}, name)
        assert.equal(auto.config_fragment_of_harmonic_whimsy.level, ['Arlecchino', 'Clorinde'].includes(name) ? 3 : 0, name)
    }
    for (const [wearer, buffs, expected] of [
        ['Amber', ['NahidaTalent1'], 1], ['Nahida', ['BennettQ'], 1], ['Kaeya', ['BennettQ', 'NahidaC2'], 1],
        ['Amber', ['BennettQ'], 0], ['Kaeya', ['NahidaC2', 'NahidaTalent1'], 0],
        ['Kaeya', ['ResonancePyro', 'NahidaTalent1'], 0],
    ]) assert.equal(config(wearer, ...buffs).config_unfinished_reverie.rate, expected)
})

test('disabling a Furina BUFF clears Hunter in both searches; manual and Days Past values survive', () => {
    const manual = vue.ref(defaults()), mode = vue.ref('auto'), active = vue.reactive([{name: 'FurinaQ'}])
    manual.value.config_marechaussee_hunter.stack = 1
    manual.value.config_song_of_days_past = {regeneration: 6000, rate: 0.5}
    const {optimize, panel, preview} = singleCalculatorInputs({character: {name:'Gaming'}, buffs:active,
        sources:[{sourceId:'teammate', characterName:'Furina'}]}, [], manual, mode)
    function check(stacks) {
        for (const search of [optimize, panel]) {
            const config = search().artifact_config
            assert.equal(config.config_marechaussee_hunter.stack, stacks)
            assert.equal(config.config_golden_troupe.rate, 0)
            assert.deepEqual(config.config_song_of_days_past, {regeneration: 6000, rate: 0.5})
        }
    }
    check(3)
    active.pop()
    check(0)
    active.push({name:'CustomBonus', source_id:'teammate'})
    check(3)
    assert.equal(preview.value.artifact_config.config_marechaussee_hunter.stack, 1)
    mode.value = 'custom'
    check(1)
})

test('single searches count distinct Moonsign owners, including the wearer, from active BUFFs', () => {
    const mode = vue.ref('auto'), manual = vue.ref(defaults())
    const buffs = vue.reactive([])
    const {optimize, panel} = singleCalculatorInputs({character: {name: 'Sucrose'}, buffs,
        sources: [{sourceId: 'helper', characterName: 'Ineffa'}]}, [], manual, mode)
    function check(level) {
        const config = optimize().artifact_config
        for (const key of ['config_realm_mirror_night', 'config_spin_moon_serenade']) {
            assert.deepEqual(config[key], {moon_state: level, moon_reaction_bonus: Number(level > 0)})
            assert.deepEqual(panel().artifact_config[key], config[key])
        }
        assert.deepEqual(config.config_aubade_of_morningstar_and_moon, {rate: 0, is_ascendant_gleam: level === 2})
    }
    check(0)
    buffs.push({name: 'ATKPercentage', source_id: 'helper'}, {name: 'IneffaTalent3'})
    check(1)
    buffs.push({name: 'AinoC1'}, {name: 'LinneaC2', source_character: 'Linnea'})
    check(2)
    buffs.splice(0)
    check(0)
    for (const name of ['Columbina', 'Ineffa', 'Linnea']) {
        const config = extra => singleSearchArtifactConfig({}, name, [{name: 'ATKPercentage', source_character: name}, ...extra])
        assert.deepEqual(config([]).config_aubade_of_morningstar_and_moon, {rate: 1, is_ascendant_gleam: false})
        assert.deepEqual(config([{name:'JahodaTalent2'}]).config_aubade_of_morningstar_and_moon, {rate: 1, is_ascendant_gleam: true})
    }
    assert.deepEqual(optimize().artifact_config.config_a_day_carved_from_rising_winds, {rate: 1, is_completed_witch_homework: true})
    assert.deepEqual(singleSearchArtifactConfig({}, 'Amber', [{name:'MonaQ'}]).config_a_day_carved_from_rising_winds,
        {rate: 0, is_completed_witch_homework: false})
    mode.value = 'custom'
    assert.deepEqual(optimize().artifact_config, JSON.parse(JSON.stringify(manual.value)))
})

test('explicit teammate moonlight and automatic wearer stats enter the kernel without duplicate claims', () => {
    const spin = {name: 'SpinMoonSerenade', config: {SpinMoonSerenade: {mode: 2, rate: 0.1}}}
    const realm = {name: 'RealmMirrorNight', config: {RealmMirrorNight: {rate: 0.1}}}
    for (const input of [[spin], prepareLunarEquipmentBuffs([spin]), [realm]]) {
        const buffs = [...input, {name: 'LaumaTalent1'}]
        const config = singleSearchArtifactConfig({}, 'Linnea', buffs)
        assert.equal(config.config_realm_mirror_night.moon_state, 2)
        assert.equal(config.config_spin_moon_serenade.moon_state, input[0] === realm ? 2 : 0)
        assert.equal(config.config_realm_mirror_night.moon_reaction_bonus, 0)
        assert.doesNotThrow(() => prepareLunarEquipmentBuffs(buffs, {artifact_config: config}))
    }
})

function harness() {
    const items = new Map()
    const slots = ['flower', 'feather', 'sand', 'cup', 'head']
    const wasmSlots = ['Flower', 'Feather', 'Sand', 'Goblet', 'Head']
    for (const [offset, setName] of [[0, 'ObsidianCodex'], [5, 'FinaleOfTheDeepGalleries']]) {
        slots.forEach((position, i) => items.set(offset + i, {
            id: offset + i, setName, position, level: 20, star: 5, omit: false,
            mainTag: { name: 'lifeStatic', value: 4780 }, normalTags: []
        }))
    }
    const exports = {}
    const modules = {
        '@/store/pinia/artifact': { useArtifactStore: () => ({ artifacts: vue.ref(items) }) },
        '@artifact': { artifactsData: sets },
        '@/utils/converter': { convertArtifactName: name => sets[name].name2, convertArtifact: a => ({
            id: a.id, set_name: sets[a.setName].name2, slot: wasmSlots[slots.indexOf(a.position)],
            level: 20, star: 5, main_stat: ['HPFixed', 4780], sub_stats: []
        }) },
        '@/utils/common': { toSnakeCase: snake },
        '@/utils/artifacts': { newDefaultArtifactConfigForWasm: defaults,
            getArtifactAllConfigsByName: name => [...sets[name].config2, ...sets[name].config4] },
        '@/i18n/i18n': { useI18n: () => ({ t: x => x, ta: x => x }) }
    }
    const source = fs.readFileSync(new URL('../src/composables/artifact.ts', import.meta.url), 'utf8')
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    vm.runInNewContext(js, { exports, require: key => {
        if (!modules[key]) throw new Error(`Unmocked dependency: ${key}`)
        return modules[key]
    }, ref: vue.ref, computed: vue.computed, watch: vue.watch, Set })
    return exports.use5Artifacts()
}

test('switch Obsidian 4 to Finale 4 without clearing its configuration or crashing the reactive panel', async () => {
    const a = harness(), scope = vue.effectScope()
    const seen = []
    scope.run(() => vue.watchEffect(() => seen.push(JSON.stringify(a.artifactConfigForCalculator.value)), { flush: 'sync' }))
    a.artifactIds.value = [0, 1, 2, 3, 4]
    assert.equal(a.artifactNeedConfig2.value, 'ObsidianCodex')
    a.artifactIds.value = [5, 6, 7, 8, 9]
    await vue.nextTick()
    assert.equal(a.artifactNeedConfig2.value, null)
    assert.equal(a.artifactNeedConfig4.value, 'FinaleOfTheDeepGalleries')
    const key = 'config_finale_of_the_deep_galleries'
    assert.deepEqual(JSON.parse(JSON.stringify(a.artifactConfigForCalculator.value[key])), defaults()[key])
    assert.ok(a.artifactSingleConfig.value[key])
    const config = sets.FinaleOfTheDeepGalleries.config4[0]
    a.artifactSingleConfig.value = { [key]: { ...a.artifactSingleConfig.value[key], [config.name]: 0 } }
    assert.equal(a.artifactConfigForCalculator.value[key][config.name], 0)
    a.artifactIds.value = [-1, -1, -1, -1, -1]
    assert.doesNotThrow(() => a.artifactConfigForCalculator.value)
    a.artifactIds.value = [5, 6, 7, 8, 9]
    assert.equal(a.artifactConfigForCalculator.value[key][config.name], 0)
    assert.ok(seen.length >= 4)
    a.artifactIds.value = [0, 1, 2, 3, 4]
    assert.ok(a.artifactSingleConfig.value.config_obsidian_codex)
    scope.stop()
})

test('single optimizer and damage preview use edits from both coverage controls, including unequipped sets', () => {
    const a = harness(), config = a.artifactSingleConfig
    const page = fs.readFileSync(new URL('../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue', import.meta.url), 'utf8')
    assert.match(page, /<artifact-config\s+v-model="artifactConfig"/)
    assert.match(page, /<item-config\s+v-if="artifactConfig"\s+v-model="artifactConfig"/i)
    const {preview, optimize} = singleCalculatorInputs({}, [], config)
    const key = 'config_scarlet_proof'
    config.value = {...config.value, [key]: {rate: 0.5}}
    const previous = optimize().artifact_config
    assert.equal(preview.value.artifact_config[key].rate, 0.5)
    assert.equal(previous[key].rate, 0.5)
    config.value = {[key]: {rate: 0}}
    assert.deepEqual(optimize().artifact_config, JSON.parse(JSON.stringify(preview.value.artifact_config)))
    assert.ok(preview.value.artifact_config.config_obsidian_codex)
    assert.equal(previous[key].rate, 0.5)
})

test('two-piece-only controls reach the calculator too', () => {
    const a = harness()
    a.artifactIds.value = [0, 1, -1, -1, -1]
    const key = 'config_obsidian_codex', field = sets.ObsidianCodex.config2[0].name
    a.artifactSingleConfig.value[key][field] = 0
    assert.equal(a.artifactConfigForCalculator.value[key][field], 0)
})

test('Skirk damage stays finite with Finale 4 after a set switch', async () => {
    const { bindings } = await import('../mona_wasm/pkg/bindings.js')
    const bridge = await import('../mona_wasm/pkg/mona_wasm_bg.js')
    const instance = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm', import.meta.url))), { './mona_wasm_bg.js': bridge })
    bindings.lI(instance.exports)
    const a = harness()
    a.artifactIds.value = [0, 1, 2, 3, 4]
    a.artifactIds.value = [5, 6, 7, 8, 9]
    const config = Object.fromEntries(characters.Skirk.config.map(c => [c.name, c.default]))
    const skillConfig = Object.fromEntries(characters.Skirk.configSkill.map(c => [c.name, c.default]))
    const input = { character: { name: 'Skirk', level: 90, ascend: true, constellation: 0, skill1: 0, skill2: 9, skill3: 9, params: { Skirk: config } },
        weapon: { name: 'DullBlade', level: 90, ascend: true, refine: 1, params: 'NoConfig' },
        buffs: [], artifacts: a.artifactWasmFormat.value, artifact_config: a.artifactConfigForCalculator.value, enemy: null,
        skill: { index: 9, config: { Skirk: skillConfig } } }
    const panel = bindings.Ps.get_attribute(input)
    const damage = bindings.K2.get_damage_analysis(input, null)
    assert.ok(Object.values(panel.atk).reduce((s, n) => s + n, 0) > 0)
    assert.ok(Number.isFinite(damage.normal.expectation) && damage.normal.expectation > 0)
    console.log('Skirk E-mode damage after set swap:', damage.normal.expectation.toFixed(2))
})
