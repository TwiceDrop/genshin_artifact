import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { enkaSnapshot } from '../src/import/enka-showcase.mjs'
import * as goodRoster from '../src/import/good-roster.mjs'
import { createMysConverter } from '../src/import/miyoushe.mjs'
import { createEnkaReader } from '../server/enka.mjs'
import { validateUidPackage } from '../src/import/uid-package.mjs'
import * as inventoryFunctions from '../src/import/uid-inventory.mjs'
import * as importHistory from '../src/import/import-history.mjs'
import * as mys from '../src/import/miyoushe.mjs'
import * as summaries from '../src/import/character-summary.mjs'
import * as presetsWorkflow from '../src/utils/preset-workflow.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function loadWith(source, dependencies) {
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    const exports = {}
    new Function('require', 'exports', js)(name => {
        if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name)
        return dependencies[name]
    }, exports)
    return exports
}

const catalogFile = name => JSON.parse(readFileSync(new URL('../src/assets/_gen_' + name + '.js', import.meta.url), 'utf8')
    .split('export default ')[1].trim().replace(/;$/, ''))
const catalog = { characters: catalogFile('character'), weapons: catalogFile('weapon'), artifacts: catalogFile('artifact'),
    targets: catalogFile('tf'), locale: JSON.parse(readFileSync(new URL('../src/i18n/generated/zh-cn.json', import.meta.url))) }
const uid = '999999999'
function showcase() {
    return { uid, ttl: 60, playerInfo: { nickname: '合成展柜' }, avatarInfoList: [{
        avatarId: 10000002, talentIdList: [21, 22, 23], propMap: { 4001: { val: '80' }, 1002: { val: '6' } },
        skillLevelMap: { 10019: 8, 10024: 9, 10018: 7 }, proudSkillExtraLevelMap: { 239: 3 },
        equipList: [
            { itemId: 11302, weapon: { level: 80, promoteLevel: 6, affixMap: { 1: 4 } }, flat: { icon: 'UI_EquipIcon_Sword_Dawn' } },
            { itemId: 1, reliquary: { level: 21 }, flat: { rankLevel: 5, equipType: 'EQUIP_BRACER', setNameTextMapHash: '1959650699',
                reliquaryMainstat: { mainPropId: 'FIGHT_PROP_HP', statValue: 4780 },
                reliquarySubstats: [{ appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 10.5 }] } },
        ],
    }] }
}
test('public showcase maps talents, ascension, refinement and equipped artifact into a transferable local preset', () => {
    const snapshot = enkaSnapshot(uid, showcase(), catalog)
    const { preset, gear, key } = createMysConverter(catalog).character(snapshot.characters[0], uid, snapshot.source)
    assert.equal(key, uid + ':10000002:Ice')
    assert.match(preset.name, /^Enka /)
    assert.deepEqual([preset.character.name, preset.character.ascend, preset.character.constellation], ['KamisatoAyaka', true, 3])
    assert.deepEqual([preset.character.skill1, preset.character.skill2, preset.character.skill3], [8, 6, 10])
    assert.deepEqual([preset.weapon.name, preset.weapon.refine, preset.weapon.ascend], ['HarbingerOfDawn', 5, true])
    assert.equal(gear[0].position, 'flower')
    assert.equal(gear[0].level, 20)
    assert.deepEqual(gear[0].mainTag, { name: 'lifeStatic', value: 4780 })
    assert.deepEqual(gear[0].normalTags, [{ name: 'critical', value: 0.105 }])
    validateUidPackage({ format: 'mona-uid', version: 1, uid, characters: [{ entry: { uid, key }, preset }],
        snapshot, history: [], artifacts: [] }, catalog)
})
test('showcase relics use the stable set ID when the upstream text hash changes', () => {
    const data = showcase()
    const item = data.avatarInfoList[0].equipList[1]
    Object.assign(item.flat, { setId: 15031, icon: 'UI_RelicIcon_15031_4', setNameTextMapHash: '1249831355' })
    const snapshot = enkaSnapshot(uid, data, catalog)
    assert.equal(snapshot.characters[0].relics[0].set.name, '逐影猎人')
    const { gear } = createMysConverter(catalog).character(snapshot.characters[0], uid, snapshot.source)
    assert.equal(gear[0].setName, 'MarechausseeHunter')
})
test('private or empty showcases report no data, and a missing character does not block supported characters', () => {
    assert.throws(() => enkaSnapshot(uid, { playerInfo: {} }, catalog), /公开角色详情/)
    const data = showcase()
    data.avatarInfoList.push({ avatarId: 999999 })
    const snapshot = enkaSnapshot(uid, data, catalog)
    assert.equal(snapshot.characters.length, 1)
    assert.match(snapshot.failures[0], /999999/)
})
test('only anonymous numeric UID lookups go upstream, respect TTL, and report errors', async () => {
    let calls = 0
    const read = createEnkaReader(async (url, options) => {
        calls++
        assert.equal(url, 'https://enka.network/api/uid/' + uid + '/')
        assert.equal(options.credentials, 'omit')
        assert.equal(options.headers.Cookie, undefined)
        return Response.json(showcase())
    })
    await assert.rejects(read('../token'), /UID/)
    await read(uid)
    await read(uid)
    assert.equal(calls, 1)
    await assert.rejects(createEnkaReader(async () => Response.json({}, {status: 429}))(uid), /频繁/)
    await assert.rejects(createEnkaReader(async () => Response.json({uid: '999999998'}))(uid), /UID/)
})

test('login controls render, grey button shows the supplied message, and the gold form saves to the active account', async () => {
    const { JSDOM } = require('jsdom'), { parse, compileScript } = require('@vue/compiler-sfc')
    const dom = new JSDOM('<div id="app"></div>')
    for (const name of ['window', 'document', 'Element', 'SVGElement']) globalThis[name] = dom.window[name]
    const vue = require('vue')
    const file = readFileSync(new URL('../src/components/import/MiyousheImport.vue', import.meta.url), 'utf8')
    const { descriptor } = parse(file)
    const compiled = compileScript(descriptor, { id: 'uid-login', inlineTemplate: true })
    const modules = Object.fromEntries(compiled.imports ? Object.values(compiled.imports).map(row => [row.source, {}]) : [])
    const requests = [], writes = [], prompts = []
    const stub = { render: () => null }
    const active = vue.ref('local-test')
    Object.assign(modules, {
        vue, './MiyousheCharacterPicker.vue': { default: stub }, './MiyousheVerification.vue': { default: stub },
        'element-plus': { ElMessageBox: { prompt: async label => { prompts.push(label); return { value: uid } } } },
        '@/import/good-roster.mjs': goodRoster,
        '@/store/pinia/preset': { usePresetStore: () => ({ presets: vue.ref({}) }) },
        '@/store/pinia/artifact': { useArtifactStore: () => ({ artifacts: vue.ref(new Map()) }) },
        '@/usage-stats/index.mjs': { recordUsage() {} },
        '@/store/pinia/miyoushe': { useMiyousheStore: () => ({ data: vue.ref({ entries: [], snapshots: {} }), uidGroups: vue.ref([]), selectedUid: vue.ref('') }) },
        '@/store/pinia/account': { useAccountStore: () => ({ currentAccountId: active }) },
        '@/platform/mys-api.mjs': { mysApi: async path => { requests.push(path); return { accounts: [] } } },
        '@/platform/enka.mjs': { fetchEnkaShowcase: async value => { requests.push(value); return showcase() } },
        '@/import/enka-showcase.mjs': { enkaSnapshot }, '@/assets/_gen_character': { default: catalog.characters },
        '@/assets/_gen_weapon': { default: catalog.weapons }, '@/i18n/generated/zh-cn.json': { default: catalog.locale },
        '@/import/save-game-snapshot.mjs': { saveGameSnapshot: async (snapshot, account, label, check) => {
            check(); writes.push([snapshot.role.uid, account, label]); return { imported: 1, added: 1, reused: 0 }
        } },
    })
    const app = vue.createApp(loadWith(compiled.content, modules).default)
    app.component('el-button', { props: ['nativeType', 'type'], setup: (props, { slots }) => () =>
        vue.h('button', { type: props.nativeType || 'button', 'data-kind': props.type }, slots.default?.()) })
    app.component('el-input', { props: ['modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => () =>
        vue.h('input', { value: props.modelValue, onInput: event => emit('update:modelValue', event.target.value) }) })
    app.component('el-alert', { props: ['title'], setup: props => () => vue.h('div', { role: 'alert' }, props.title) })
    for (const name of ['el-checkbox', 'el-select', 'el-option', 'el-progress']) app.component(name, stub)
    const click = label => [...document.querySelectorAll('button')].find(button => button.textContent === label)
    const settle = () => new Promise(resolve => setImmediate(resolve))
    try {
        app.mount('#app')
        await settle()
        click('使用米游社登录').click()
        await vue.nextTick()
        assert.equal(document.querySelector('[role=alert]').textContent, '该登录方式暂时关闭，请尝试通过其他方式登录。')
        assert.deepEqual(requests, ['accounts'])
        const open = click('使用 Enka API 登录')
        assert.equal(open.dataset.kind, 'primary')
        open.click()
        await vue.nextTick()
        const field = document.querySelector('input[aria-label="原神 UID"]')
        field.value = uid
        field.dispatchEvent(new window.Event('input', { bubbles: true }))
        await vue.nextTick()
        click('导入展柜角色').click()
        await settle()
        assert.deepEqual(requests, ['accounts', uid])
        assert.deepEqual(writes, [[uid, 'local-test', 'Enka 展柜导入']])
        assert.match(document.querySelector('.mys-result').textContent, /已保存 1 名角色/)
        const input = document.querySelector('input[type=file]')
        const good = { format: 'GOOD', version: 3, source: 'yas-GOODScanner', characters: [
            { key: 'Amber', level: 70, ascension: 4, constellation: 0, talent: { auto: 4, skill: 5, burst: 6 } },
        ] }
        Object.defineProperty(input, 'files', { value: [{ size: 200, name: 'GOODv3.json', text: async () => JSON.stringify(good) }] })
        input.dispatchEvent(new window.Event('change'))
        await settle()
        assert.deepEqual(prompts, ['导入到原神 UID'])
        assert.deepEqual(writes.at(-1), [uid, 'local-test', 'GOODv3.json'])
        good.metadata = { uid: '999999998' }
        input.dispatchEvent(new window.Event('change'))
        await settle()
        assert.equal(prompts.length, 1)
        assert.deepEqual(writes.at(-1), ['999999998', 'local-test', 'GOODv3.json'])
    } finally { app.unmount(); dom.window.close() }
})

test('re-import preserves non-showcase characters and their gear, and matches existing character element aliases', () => {
    const vue = require('vue'), inventory = { artifacts: vue.ref(new Map()), addArtifact(a) {
        const id = this.artifacts.value.size + 1
        this.artifacts.value.set(id, { ...a, id }); return id
    } }
    const presets = { presets: vue.ref({}), addOrOverwrite(name, item) { this.presets.value[name] = { name, item } } }
    const file = readFileSync(new URL('../src/store/pinia/miyoushe.ts', import.meta.url), 'utf8')
    const store = loadWith(file, { vue, './artifact': { useArtifactStore: () => inventory }, './preset': { usePresetStore: () => presets },
        '@/import/uid-inventory.mjs': inventoryFunctions, '@/import/import-history.mjs': importHistory, '@/import/miyoushe.mjs': mys,
        '@/import/character-summary.mjs': summaries, '@/utils/preset-workflow.mjs': presetsWorkflow }).useMiyousheStore()
    const old = enkaSnapshot(uid, showcase(), catalog)
    old.source = 'miyoushe'
    old.characters[0].base.element = 'Cryo'
    const hidden = structuredClone(old.characters[0])
    hidden.base = { ...hidden.base, id: 10000003, name: '琴', element: 'Wind' }
    hidden.skills = [1, 2, 3].map(i => ({ skill_type: 1, name: catalog.locale[catalog.characters.Jean['skillName' + i]], level: 1 }))
    old.characters.push(hidden)
    old.characters[0].relics = []
    const converter = createMysConverter(catalog)
    assert.equal(store.importSnapshot(old, converter).imported, 2)
    const before = JSON.stringify(store.data.value.entries.find(row => row.id === hidden.base.id))
    const update = () => store.importSnapshot(enkaSnapshot(uid, showcase(), catalog), converter, 'Enka 展柜导入')
    assert.equal(update().added, 1)
    assert.equal(update().added, 0)
    assert.equal(store.data.value.entries.length, 2)
    assert.equal(store.data.value.snapshots[uid].characters.length, 2)
    assert.equal(JSON.stringify(store.data.value.entries.find(row => row.id === hidden.base.id)), before)
    assert.equal(inventory.artifacts.value.size, 2)
    assert.equal(Object.keys(presets.presets.value).length, 2)
})
