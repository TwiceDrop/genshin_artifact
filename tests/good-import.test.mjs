import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))
const ts = require('typescript'), vue = require('vue'), compiler = require('@vue/compiler-sfc')
Object.assign(globalThis, { ref: vue.ref, computed: vue.computed, watch: vue.watch })
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const meta = name => {
    const s = read('src/assets/_gen_' + name + '.js')
    return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
}
const artifacts = meta('artifact'), characters = meta('character')
const locale = JSON.parse(read('src/i18n/generated/zh-cn.json'))
const cache = new Map()
function load(file) {
    const absolute = path.resolve(root, file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const m = new Module(absolute)
    cache.set(absolute, m)
    m.filename = absolute
    m.require = spec => {
        if (spec === '@/assets/artifacts') return { artifactsData: artifacts }
        if (spec === '@/assets/character') return { characterData: characters }
        if (spec === '@/assets/_gen_artifact') return { __esModule: true, default: artifacts }
        if (spec === '@/i18n/i18n') return { useI18n: () => ({ ta: index => locale[index] }) }
        if (spec === '@/wasm') return {}
        if (!spec.startsWith('.') && !spec.startsWith('@/')) return require(spec)
        const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : path.resolve(path.dirname(absolute), spec)
        const target = [base, base + '.ts', base + '.js', base + '.json'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
        if (!target) throw new Error('Unresolved import ' + spec)
        return target.endsWith('.json') ? JSON.parse(fs.readFileSync(target, 'utf8')) : load(target)
    }
    const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText
    m._compile(output, absolute)
    return m.exports
}
const { convertGoodArtifacts } = load('src/import/good.ts')
const { importMonaJson } = load('src/utils/artifacts.ts')
const { convertArtifact } = load('src/utils/converter.ts')
const store = load('src/store/pinia/artifact.ts').useArtifactStore()
const kumi = load('src/store/pinia/kumi.ts').useKumiStore()
function reset() { store.init(null); kumi.init(null) }
const artifact = (slotKey, mainStatKey, extra = {}) => ({
    setKey: 'GladiatorsFinale', slotKey, mainStatKey, rarity: 5, level: 20,
    substats: [{ key: 'critRate_', value: 7 }, { key: 'eleMas', value: 23 }, { key: 'enerRech_', value: 11.7 }, { key: 'def', value: 19 }],
    location: 'KamisatoAyaka', lock: true, ...extra
})
const good = list => ({ format: 'GOOD', version: 3, source: 'yas-GOODScanner', artifacts: list })
const fixture = () => good([
    artifact('flower', 'hp'),
    artifact('plume', 'atk', { setKey: 'CrimsonWitchOfFlames' }),
    artifact('sands', 'atk_', { setKey: 'NightOfTheSkysUnveiling' }),
    artifact('goblet', 'cryo_dmg_', { setKey: 'SilkenMoonsSerenade' }),
    artifact('circlet', 'critDMG_', { setKey: 'CelestialGift' })
])
const contents = () => JSON.stringify([...store.artifacts.value.values()])
const groups = () => JSON.stringify(kumi.kumi.value)

test('GOOD main stats, units, aliases and active substats use real Mona metadata', () => {
    const raw = fixture(), before = JSON.stringify(raw)
    raw.artifacts[0].unactivatedSubstats = [{ key: 'critDMG_', value: 7.8 }]
    const converted = convertGoodArtifacts(raw)
    assert.equal(converted.flower[0].mainTag.value, 4780)
    assert.equal(converted.feather[0].mainTag.value, 311)
    assert.equal(converted.sand[0].mainTag.value, .466)
    assert.equal(converted.cup[0].mainTag.value, .466)
    assert.equal(converted.head[0].mainTag.value, .622)
    assert.equal(converted.feather[0].setName, 'crimsonWitch')
    assert.equal(converted.sand[0].setName, 'RealmMirrorNight')
    assert.equal(converted.cup[0].setName, 'SpinMoonSerenade')
    assert.equal(converted.head[0].setName, 'HeavensGift')
    assert.equal(converted.flower[0].equip, '神里绫华')
    converted.flower[0].normalTags.forEach((t, i) => assert.ok(Math.abs(t.value - [.07, 23, .117, 19][i]) < 1e-12))
    assert.equal(converted.flower[0].normalTags.length, 4)
    assert.equal(converted.flower[0].omit, undefined)
    delete raw.artifacts[0].unactivatedSubstats
    assert.equal(JSON.stringify(raw), before)
    const levels = convertGoodArtifacts(good([
        artifact('flower', 'hp', { level: 0 }),
        artifact('plume', 'atk', { rarity: 4, level: 16 }),
        artifact('sands', 'eleMas', { level: 20 }),
        artifact('circlet', 'critRate_', { rarity: 4, level: 8 })
    ]))
    assert.equal(levels.flower[0].mainTag.value, 717)
    assert.equal(levels.feather[0].mainTag.value, 232)
    assert.equal(levels.sand[0].mainTag.value, 187)
    assert.equal(levels.head[0].mainTag.value, .137)
    const v1 = fixture(); v1.version = 1; v1.source = 'yas'
    assert.deepEqual(convertGoodArtifacts(v1), converted)
})

test('actual inventory merges, upgrades, preserves omit, and equips partial sets by slot', () => {
    reset()
    const first = importMonaJson(fixture(), false, false)
    assert.deepEqual(first, { skip: 0, upgrade: 0, add: 5, remove: 0 })
    assert.equal(store.artifactsCount.value, 5)
    assert.ok([...store.artifacts.value.values()].every(a => a.omit === false))
    const equipped = kumi.kumisByDirId.value[1][0]
    assert.equal(equipped.title, '神里绫华')
    assert.deepEqual(equipped.artifactIds.map(id => store.getArtifact(id).position), ['flower', 'feather', 'sand', 'cup', 'head'])
    store.lockArtifact(equipped.artifactIds[0])
    const repeated = importMonaJson(fixture(), false, true)
    assert.deepEqual(repeated, { skip: 5, upgrade: 0, add: 0, remove: 0 })
    assert.equal(store.getArtifact(equipped.artifactIds[0]).omit, true)
    reset()
    const low = good([artifact('goblet', 'cryo_dmg_', { level: 0 })])
    importMonaJson(low, false, false)
    const id = [...store.artifacts.value.keys()][0]
    store.lockArtifact(id)
    const upgraded = importMonaJson(good([artifact('goblet', 'cryo_dmg_')]), true, false)
    assert.deepEqual(upgraded, { skip: 0, upgrade: 1, add: 0, remove: 0 })
    assert.equal(store.getArtifact(id).omit, true)
    assert.equal(store.getArtifact(id).mainTag.value, .466)
    assert.deepEqual(kumi.kumisByDirId.value[1][0].artifactIds, [null, null, null, id, null])
    const mona = convertGoodArtifacts(good([artifact('goblet', 'cryo_dmg_')]))
    assert.deepEqual(importMonaJson(mona, false, false), { skip: 1, upgrade: 0, add: 0, remove: 0 })
})

test('omitted, empty, unrelated and unknown GOOD input cannot clear inventory or equipment', () => {
    reset(); importMonaJson(fixture(), false, false)
    const before = contents(), saved = groups()
    const unsupported = fixture(); unsupported.artifacts[4].setKey = 'UnknownFutureSet'
    const invalid = [
        { format: 'GOOD', version: 3, characters: [{ key: 'Mona' }] },
        { format: 'GOOD', version: 3, weapons: [{ key: 'DullBlade' }] },
        good([]), { flower: [], feather: [], sand: [], cup: [], head: [] },
        { format: 'HSR-Scanner', version: 4, relics: [] }, unsupported
    ]
    for (const input of invalid) {
        assert.throws(() => importMonaJson(input, true, false), /artifacts|没有可导入|未知套装/)
        assert.equal(contents(), before); assert.equal(groups(), saved)
    }
})

test('imported equipment crosses the actual public WASM calculator and scoring boundary', async () => {
    reset()
    const input = good(['flower', 'plume', 'sands', 'goblet', 'circlet'].map((slot, i) =>
        artifact(slot, ['hp', 'atk', 'atk_', 'pyro_dmg_', 'critDMG_'][i], { setKey: 'GladiatorsFinale', location: 'Klee' })))
    importMonaJson(input, false, false)
    const equipped = kumi.kumisByDirId.value[1][0].artifactIds.map(id => store.getArtifact(id))
    const { api } = await import('../beta-tools/runtime-7106.mjs')
    const config = {
        character: { name: 'Klee', level: 90, ascend: false, constellation: 0, skill1: 9, skill2: 9, skill3: 9, params: 'NoConfig' },
        weapon: { name: 'MagicGuide', level: 90, ascend: false, refine: 1, params: 'NoConfig' },
        artifacts: equipped.map(convertArtifact), buffs: [], artifact_config: null, enemy: null,
        skill: { index: 0, config: 'NoConfig' }
    }
    const result = api.CalculatorInterface.get_damage_analysis(config, null)
    const reference = [
        [4780, 0], [311, 1], [.466, 2], [.466, 3], [.622, 4]
    ].map(([value, i]) => ({ ...equipped[i], mainTag: { ...equipped[i].mainTag, value }, normalTags: [
        { name: 'critical', value: .07 }, { name: 'elementalMastery', value: 23 },
        { name: 'recharge', value: .117 }, { name: 'defendStatic', value: 19 }
    ] }))
    const expected = api.CalculatorInterface.get_damage_analysis({ ...config, artifacts: reference.map(convertArtifact) }, null)
    assert.deepEqual(result, expected)
    assert.ok(result.normal.expectation > 0)
    const without = api.CalculatorInterface.get_damage_analysis({ ...config, artifacts: [] }, null)
    assert.ok(result.normal.expectation > without.normal.expectation)
    const { scoreBuild } = await import('../src/algorithms/artifact-score/score.mjs')
    const score = scoreBuild(equipped, { name: '可莉', options: { elem: 'pyro' } })
    assert.deepEqual(score, scoreBuild(reference, { name: '可莉', options: { elem: 'pyro' } }))
    assert.ok(Number.isFinite(score.total)); assert.ok(score.total > 0)
    console.log('合成可莉伤害与评分', result.normal.expectation, score.total)
})

test('actual file reader and page save callback reach shared import and wait for completion', async () => {
    const descriptor = compiler.parse(read('src/pages/ArtifactsPage/ArtifactsPage.vue')).descriptor
    compiler.compileScript(descriptor, { id: 'artifacts' })
    assert.deepEqual(compiler.compileTemplate({ source: descriptor.template.content, filename: 'ArtifactsPage.vue', id: 'artifacts' }).errors, [])
    const toolsSource = read('src/pages/helps/ExportToolPage/ExportToolPage.vue')
    const toolsPage = compiler.parse(toolsSource).descriptor
    compiler.compileScript(toolsPage, { id: 'export-tools' })
    assert.ok(toolsSource.includes('https://github.com/Anyrainel/GOODScanner'))
    reset()
    const upload = compiler.parse(read('src/components/misc/ImportBlock.vue')).descriptor
    const uploadCode = ts.transpileModule(upload.scriptSetup.content.replace(/import[^;]+;/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
    const pageScript = descriptor.scriptSetup.content
    const start = pageScript.indexOf('const showImportDialog')
    const end = pageScript.indexOf('function getArtifactString()', start)
    const pageCode = ts.transpileModule(pageScript.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
    const { chromium } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
    const assets = {
        '/vue.js': fs.readFileSync(require.resolve('vue/dist/vue.global.js')),
        '/element.js': fs.readFileSync(require.resolve('element-plus/dist/index.full.js'))
    }
    const html = '<!doctype html><html><body><div id="app"></div><script src="/vue.js"></script><script src="/element.js"></script><script>' +
        'const {ref,computed}=Vue; const ImportBlock={template:' + JSON.stringify(upload.template.content) + ',setup(props,{expose}){' +
        'return (new Function("ref","defineProps","defineExpose",' + JSON.stringify(uploadCode + '\nreturn {isDragover,file,hasFile,fileName,fileInput,handleDragEnter,handleDragLeave,handleDragover,handleClick,handleSelectFile,handleDrop,props};') + '))(ref,()=>props,expose);}};' +
        'Vue.createApp({components:{ImportBlock},setup(){const t=x=>x;const ElLoading={service:()=>({close(){window.events.push("close")}})};const ElMessage=e=>window.messages.push(e.message);window.events=[];window.messages=[];' +
        pageCode + ';return {fileUploader,handleImportJson};},template:\'<import-block ref="fileUploader"/><button @click="handleImportJson">导入</button>\'}).use(ElementPlus).mount("#app");</script></body></html>'
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript')
        res.end(req.url === '/' ? html : assets[req.url] || '')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
    try {
        const page = await browser.newPage()
        const errors = []; page.on('pageerror', e => errors.push(e.message))
        await page.exposeFunction('importMonaJson', async (raw, remove, backup) => {
            await new Promise(resolve => setTimeout(resolve, 50))
            const result = importMonaJson(raw, remove, backup)
            await page.evaluate(() => window.events.push('import-complete'))
            return result
        })
        await page.goto('http://127.0.0.1:' + server.address().port)
        await page.locator('input[type=file]').setInputFiles({ name: '任意文件名.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture())) })
        await page.getByRole('button', { name: '导入', exact: true }).click()
        await page.waitForFunction(() => window.events.includes('close'))
        assert.deepEqual(await page.evaluate(() => window.events), ['import-complete', 'close'])
        assert.deepEqual(await page.evaluate(() => window.messages), [])
        assert.deepEqual(errors, [])
        assert.equal(store.artifactsCount.value, 5)
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})

const initialThreeStats = () => artifact('flower', 'hp', {
    level: 0,
    substats: [
        { key: 'critRate_', value: 3.9 },
        { key: 'critDMG_', value: 7.8 },
        { key: 'atk_', value: 5.8 },
    ],
})
const addedFourthStat = () => ({
    ...initialThreeStats(), level: 4,
    substats: [...initialThreeStats().substats, { key: 'enerRech_', value: 6.5 }],
})

test('review: unique three-to-four upgrade preserves ID, lock and saved equipment in GOOD and Mona imports', () => {
    for (const monaFormat of [false, true]) {
        for (const removeNonExisting of [false, true]) {
            reset()
            importMonaJson(good([initialThreeStats()]), false, false)
            const id = [...store.artifacts.value.keys()][0]
            store.lockArtifact(id)
            const savedId = kumi.createKumi(0, '合成原配装')
            kumi.addArtifact(savedId, id)
            const raw = good([addedFourthStat()])
            const incoming = monaFormat ? convertGoodArtifacts(raw) : raw
            if (monaFormat) incoming.flower[0].omit = false
            assert.deepEqual(importMonaJson(incoming, removeNonExisting, false),
                { skip: 0, upgrade: 1, add: 0, remove: 0 })
            assert.equal(store.artifactsCount.value, 1)
            assert.equal(store.getArtifact(id).omit, true)
            assert.equal(store.getArtifact(id).level, 4)
            assert.equal(store.getArtifact(id).mainTag.value, 1530)
            assert.equal(store.getArtifact(id).normalTags.length, 4)
            assert.equal(kumi.itemById(savedId).artifactIds[0], id)
            assert.deepEqual(importMonaJson(incoming, removeNonExisting, false),
                { skip: 1, upgrade: 0, add: 0, remove: 0 })
            const next = addedFourthStat()
            next.level = 8
            next.substats[0].value = 7.8
            assert.deepEqual(importMonaJson(good([next]), removeNonExisting, false),
                { skip: 0, upgrade: 1, add: 0, remove: 0 })
            assert.equal(store.getArtifact(id).omit, true)
            assert.equal(kumi.itemById(savedId).artifactIds[0], id)
        }
    }
})

test('review: ambiguous three-to-four upgrades do not reuse an existing artifact ID', () => {
    reset()
    const initial = convertGoodArtifacts(good([initialThreeStats()])).flower[0]
    const first = store.addArtifact(initial, true)
    const second = store.addArtifact(initial, true)
    assert.deepEqual(importMonaJson(good([addedFourthStat()]), false, false),
        { skip: 0, upgrade: 0, add: 1, remove: 0 })
    assert.equal(store.getArtifact(first).level, 0)
    assert.equal(store.getArtifact(second).level, 0)
    assert.equal(store.getArtifact(first).omit, true)
    assert.equal(store.getArtifact(second).omit, true)

    reset()
    const oldId = store.addArtifact(initial, true)
    const other = addedFourthStat()
    other.substats[3] = { key: 'def', value: 23 }
    assert.deepEqual(importMonaJson(good([addedFourthStat(), other]), false, false),
        { skip: 0, upgrade: 0, add: 2, remove: 0 })
    assert.equal(store.getArtifact(oldId).level, 0)
    assert.equal(store.getArtifact(oldId).omit, true)

    for (const reversed of [false, true]) {
        reset()
        const id = store.addArtifact(initial, true)
        const incoming = [initialThreeStats(), addedFourthStat()]
        if (reversed) incoming.reverse()
        assert.deepEqual(importMonaJson(good(incoming), false, false),
            { skip: 1, upgrade: 0, add: 1, remove: 0 })
        assert.equal(store.getArtifact(id).level, 0)
        assert.equal(store.getArtifact(id).omit, true)
    }
})
