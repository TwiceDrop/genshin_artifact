import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'

const catalog = name => JSON.parse(fs.readFileSync(new URL(`../src/assets/_gen_${name}.js`, import.meta.url), 'utf8').replace(/^.*\nexport default /, '').trim().replace(/;$/, ''))
const sets = catalog('artifact'), characters = catalog('character')
const snake = name => name.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`).replace(/^_/, '')
const defaults = () => Object.fromEntries(Object.values(sets).filter(s => s.config2.length || s.config4.length)
    .map(s => [`config_${snake(s.name2)}`, Object.fromEntries([...s.config2, ...s.config4].map(c => [c.name, c.default]))]))

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
