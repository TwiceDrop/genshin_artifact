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
import * as uidReview from '../src/import/uid-import-review.mjs'
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
test('UID import refreshes the chosen local account, can create a separate copy, and skips routing for its current UID', async () => {
    const vue = require('@vue/runtime-core')
    const saved = id => ({ entries: [], snapshots: {}, boundUid: id })
    const profiles = [saved('100000001'), saved('100000002'), saved('100000002')]
    const accounts = { currentAccountId: vue.ref(1), reloadGeneration: vue.ref(0),
        allAccounts: profiles.map((_, i) => ({ id: i + 1, name: '合成账户' + (i + 1) })) }
    const calls = []
    let action = 'refresh'
    const store = { data: vue.ref(profiles[0]) }
    const inventory = () => ({ artifacts: vue.ref(new Map()), artifactsByPosition: vue.ref({}), init() {} })
    const preset = () => ({ presets: vue.ref({}), init() {} })
    const UiSelect = { name: 'UiSelect' }
    const dialogs = {
        confirm(message, title) {
            calls.push(title)
            if (action === 'new') throw 'cancel'
            if (action === 'close') throw 'close'
            const selector = message.children[1].type()
            assert.equal(selector.type, UiSelect)
            assert.deepEqual(selector.props.options.map(option => option.value), ['2', '3'])
            selector.props['onUpdate:modelValue']('3')
        },
        prompt() { calls.push('命名'); return { value: '副本' } },
    }
    const { uidImportSession } = loadWith(readFileSync(new URL('../src/import/uid-import-session.js', import.meta.url), 'utf8'), {
        vue, 'element-plus': { ElMessageBox: {} },
        '@/components/ui/UiCheckbox.vue': { default: { name: 'UiCheckbox' } },
        '@/components/ui/UiSelect.vue': { default: UiSelect },
        '@/store/backend': { default: { allReady() {}, getItem(key) {
            const match = key.match(/^mona_account_miyoushe_(\d+)$/)
            return match ? structuredClone(profiles[Number(match[1]) - 1]) : null
        } } },
        '@/store/pinia/account': { useAccountStore: () => accounts, getImportRevision: () => 0,
            commitUidImport(id, name, data, check) {
                check()
                if (name) { id = profiles.length + 1; accounts.allAccounts.push({ id, name }) }
                profiles[id - 1] = JSON.parse(JSON.stringify(data.miyoushe))
                accounts.currentAccountId.value = id
                store.data.value = profiles[id - 1]
                return id
            } },
        '@/store/pinia/miyoushe': { useMiyousheStore: () => store },
        '@/store/pinia/artifact': { createArtifactStore: inventory, useArtifactStore: inventory, watchContent: () => ({}) },
        '@/store/pinia/preset': { createPresetStore: preset, usePresetStore: preset },
        './import-history.mjs': importHistory, './uid-import-review.mjs': uidReview,
        '@/assets/_gen_weapon': {}, '@/assets/_gen_artifact': {}, '@/i18n/generated/zh-cn.json': {}
    })
    const run = () => uidImportSession(accounts.currentAccountId.value, undefined, dialogs).run('100000002', '合成导入', draft => {
        draft.roster.data.value.nickname = '已更新'
        return {}
    })
    await run()
    assert.equal(accounts.currentAccountId.value, 3)
    assert.equal(profiles[1].nickname, undefined)
    assert.equal(profiles[2].nickname, '已更新')
    await run()
    assert.deepEqual(calls, ['已找到相同 UID'])
    accounts.currentAccountId.value = 1
    store.data.value = profiles[0]
    action = 'close'
    await assert.rejects(run(), e => e === 'close')
    assert.equal(accounts.currentAccountId.value, 1)
    action = 'new'
    await run()
    assert.equal(accounts.currentAccountId.value, 4)
    assert.equal(accounts.allAccounts.at(-1).name, '副本')
    assert.equal(profiles[3].boundUid, '100000002')
    assert.equal(profiles[0].boundUid, '100000001')
    assert.equal(profiles[0].nickname, undefined)
})

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

test('login controls render, Miyoushe QR login opens, and the gold form saves to the active account', async () => {
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
    const importSession = { uidImportSession: (account, check) => ({ account, check: () => check(account) }) }
    let finishSave
    function loadComponent(path, id) {
        const source = readFileSync(new URL(path, import.meta.url), 'utf8')
        const script = compileScript(parse(source).descriptor, { id, inlineTemplate: true })
        return loadWith(script.content, { vue })
    }
    Object.assign(modules, {
        '@/components/ui/UiButton.vue': loadComponent('../src/components/ui/UiButton.vue', 'button'),
        '@/components/ui/UiDialog.vue': { default: { inheritAttrs: false, props: ['modelValue'], setup: (props, { slots }) =>
            () => props.modelValue ? slots.default?.() : null } },
        '@/components/ui/UiDropdownMenu.vue': { default: { inheritAttrs: false, setup: (_, { slots }) =>
            () => [slots.trigger?.(), slots.default?.()] } },
        '@/components/ui/UiDropdownMenuItem.vue': { default: { emits: ['select'], setup: (_, { slots, emit }) =>
            () => vue.h('button', { onClick: () => emit('select') }, slots.default?.()) } },
        './CharacterImportResult.vue': loadComponent('../src/components/import/CharacterImportResult.vue', 'import-result'),
        vue, './MiyousheCharacterPicker.vue': { default: { inheritAttrs: false, render() { return this.$slots.actions?.({ openManual() {} }) } } }, './MiyousheVerification.vue': { default: stub },
        'vue-router': { useRoute: () => ({ path: '/uid-data' }), useRouter: () => ({}) },
        'element-plus': { ElMessageBox: {} },
        '@/pages/ArtifactsPage/ArtifactPromptDialog.vue': { default: { setup: (_, { expose }) => {
            expose({ prompt: async label => { prompts.push(label); return { value: uid } } })
            return () => null
        } } },
        qrcode: { default: { toDataURL: async () => 'data:image/png;base64,fixture' } },
        '@/import/good': {}, '@/assets/_gen_artifact': {default: catalog.artifacts}, '@/assets/_gen_tf': {default: catalog.targets},
        '@/import/good-roster.mjs': goodRoster,
        '@/store/pinia/preset': { usePresetStore: () => ({ presets: vue.ref({}) }) },
        '@/store/pinia/artifact': { useArtifactStore: () => ({ artifacts: vue.ref(new Map()) }) },
        '@/usage-stats/index.mjs': { recordUsage() {} },
        '@/store/pinia/miyoushe': { useMiyousheStore: () => ({ data: vue.ref({ entries: [], snapshots: {} }), uidGroups: vue.ref([]), selectedUid: vue.ref('') }) },
        '@/store/pinia/account': { useAccountStore: () => ({ currentAccountId: active, reloadGeneration: vue.ref(0) }) },
        '@/platform/mys-api.mjs': { mysApi: async (path, method, body) => {
            if (path === 'login') {
                assert.equal(method, 'POST')
                requests.push(body.platform)
                if (body.platform === 'hoyolab') return { mode: 'web' }
                return {url:'https://example.invalid/qr', expiresAt:Date.now()+120000}
            }
            requests.push(path)
            return { accounts: [] }
        } },
        '@/platform/enka.mjs': { fetchEnkaShowcase: async value => { requests.push(value); return showcase() } },
        '@/import/enka-showcase.mjs': { enkaSnapshot }, '@/assets/_gen_character': { default: catalog.characters },
        '@/assets/_gen_weapon': { default: catalog.weapons }, '@/i18n/generated/zh-cn.json': { default: catalog.locale },
        './uid-import-session': importSession, '@/import/uid-import-session': importSession,
        './uid-import-review.mjs': {}, './role-presets.js': { isRolePresetFile: () => false },
        '@/import/save-game-snapshot.mjs': { savePreparedSnapshot: async (uid, build, source, session) => {
            session.check()
            const snapshot = await build({ roster: modules['@/store/pinia/miyoushe'].useMiyousheStore(),
                inventory: modules['@/store/pinia/artifact'].useArtifactStore(), presets: modules['@/store/pinia/preset'].usePresetStore() })
            writes.push([snapshot.role.uid, session.account, source])
            return { imported: 1, added: 0, reused: 0 }
        }, saveGameSnapshot: async (snapshot, account, label, check) => {
            check()
            await new Promise(resolve => { finishSave = resolve })
            writes.push([snapshot.role.uid, account, label])
            return { imported: 1, added: 1, reused: 0 }
        } },
    })
    const restoreFile = readFileSync(new URL('../src/import/restore-character-file.mjs', import.meta.url), 'utf8')
    modules['@/import/restore-character-file.mjs'] = loadWith(restoreFile, {
        ...modules, '@/import/uid-package.mjs': {}, './warehouse-file.js': { isWarehouseFile: () => false },
    })
    const app = vue.createApp(loadWith(compiled.content, modules).default)
    for (const icon of ['key', 'plus', 'arrow-down', 'user', 'connection', 'folder-opened', 'iphone', 'clock', 'picture', 'download']) app.component('i-ep-' + icon, stub)
    const click = label => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === label)
    const settle = () => new Promise(resolve => setImmediate(resolve))
    try {
        app.mount('#app')
        await settle()
        click('Cookie 账号管理').click()
        await vue.nextTick()
        for (const label of ['使用米游社登录', '使用 HoYoLAB 登录', '使用 Enka API 登录', '手动录入 Cookie']) {
            assert.equal(click(label), undefined)
        }
        click('Cookie 导入米游社 / HoYoLAB').click()
        await vue.nextTick()
        click('使用 HoYoLAB 登录').click()
        await settle()
        assert.ok(document.querySelector('.mys-pending'))
        click('取消登录').click()
        await settle()
        click('使用米游社登录').click()
        await settle()
        assert.ok(document.querySelector('img[alt="米游社登录二维码"]'))
        assert.deepEqual(requests, ['accounts', 'hoyolab', 'cancel', 'miyoushe'])
        click('UID 导入Enka 展柜').click()
        await vue.nextTick()
        const field = document.querySelector('input[aria-label="原神 UID"]')
        field.value = uid
        field.dispatchEvent(new window.Event('input', { bubbles: true }))
        await vue.nextTick()
        click('导入展柜角色').click()
        await settle()
        assert.equal(document.contains(field), false, '进入差异核对前应收起 UID 输入框')
        finishSave()
        await settle()
        assert.deepEqual(requests, ['accounts', 'hoyolab', 'cancel', 'miyoushe', uid])
        assert.deepEqual(writes, [[uid, 'local-test', 'Enka 展柜导入']])
        assert.equal(document.querySelector('input[aria-label="原神 UID"]'), null, '保存后应退出 UID 输入框')
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
        '@/import/character-summary.mjs': summaries, '@/import/uid-import-review.mjs': uidReview,
        '@/utils/preset-workflow.mjs': presetsWorkflow }).useMiyousheStore()
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
