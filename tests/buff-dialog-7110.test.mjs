import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import Fuse from 'fuse.js'
import * as groups from '../src/algorithms/buff-groups/index.mjs'
import * as polestar from '../src/algorithms/polestar-field.mjs'

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const buffData = Object.fromEntries(['Character', 'Weapon', 'Artifact', 'Resonance', 'Common'].map(genre => {
    const name = genre + 'Sample'
    return [name, { name, genre, nameLocale: name, description: 'Sample BUFF', badge: '',
        config: genre === 'Artifact' ? [] : [{ name: genre === 'Character' ? 'skill1' : 'value', default: 7, min: 1, max: 15 }] }]
}))

function evaluate(source, modules) {
    const exports = {}
    for (const module of Object.values(modules)) if (module.default) module.__esModule = true
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
    vm.runInNewContext(js, { exports, ref: vue.ref, computed: vue.computed, require: key => {
        assert.ok(modules[key], 'Unmocked dependency: ' + key)
        return modules[key]
    } })
    return exports
}

function component(path, modules, capture) {
    const { descriptor, errors } = parse(read(path), { filename: path })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: path })
    const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path,
        compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
    const compiled = evaluate(script.content, modules).default
    compiled.render = evaluate(template.code, { vue }).render
    const setup = compiled.setup
    compiled.setup = (props, context) => { const state = setup(props, context); capture(state); return state }
    return compiled
}

const renderer = vue.createRenderer({
    createElement: type => ({ type, props: {}, children: [] }),
    createText: text => ({ type: 'text', text }), createComment: text => ({ type: 'comment', text }),
    setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text; node.children = [] },
    parentNode: node => node.parent, nextSibling: () => null,
    patchProp: (node, key, _old, value) => { node.props[key] = value },
    insert(node, parent, anchor) {
        if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
        node.parent = parent
        const index = anchor ? parent.children.indexOf(anchor) : -1
        parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    },
    remove(node) { node.parent.children.splice(node.parent.children.indexOf(node), 1) },
})
const nodes = root => [root, ...((root.children || []).flatMap(nodes))]

const wrapper = { setup(_props, { attrs, slots }) { return () => vue.h('section', attrs, [slots.title?.(), slots.default?.()]) } }
const button = { setup(_props, { attrs, slots }) { return () => vue.h('button', attrs, slots.default?.()) } }
const searchInput = { setup(_props, { attrs }) {
    return () => vue.h('input', { value: attrs.modelValue, onInput: event => attrs['onUpdate:modelValue'](event.target.value) })
} }
const setTab = Symbol('setTab')
const radix = {
    AccordionContent: wrapper, AccordionHeader: wrapper, AccordionItem: wrapper, AccordionRoot: wrapper, AccordionTrigger: button,
    TabsContent: wrapper, TabsList: wrapper,
    TabsRoot: { setup(_props, { attrs, slots }) {
        vue.provide(setTab, value => attrs['onUpdate:modelValue'](value))
        return () => vue.h('section', slots.default?.())
    } },
    TabsTrigger: { props: ['value'], setup(props, { slots }) {
        const select = vue.inject(setTab)
        return () => vue.h('button', { role: 'tab', onClick: () => select(props.value) }, slots.default?.())
    } },
}

test('the calculator BUFF picker stays open through consecutive additions in every genre', async () => {
    const useBuff = evaluate(read('src/composables/buff.ts'), {
        '@buff': { buffData }, '@/utils/idProvider': { RandomIDProvider: class { next = 1; generateId() { return this.next++ } } },
        '@/algorithms/polestar-field.mjs': polestar,
    }).useBuff
    const state = useBuff(), showSelectBuffDialog = vue.ref(true)
    const page = 'NewArtifactPlanPage'
    const { descriptor } = parse(read(`src/pages/${page}/${page}.vue`))
    assert.match(descriptor.template.content, /<select-buff\b[^>]*\bshadcn(?:\s|>)/)
    const source = ts.createSourceFile(page + '.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
    const handler = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleSelectBuff')
    assert.ok(handler)
    const handlerJs = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
    const confirmations = []
    let confirmDuplicate = false
    const calculationPrompt = {
        request: vue.ref(null),
        async confirm(message) {
            confirmations.push(message)
            if (!confirmDuplicate) throw 'cancel'
        },
    }
    const handleSelectBuff = vm.runInNewContext(handlerJs + '\nhandleSelectBuff', {
        ...state, showSelectBuffDialog, buffData, ta: value => value, calculationPrompt, showCalculationNotice() {},
    })
    let childState, pickerState
    const character = component('src/components/select/CharacterBuffGroups.vue', {
        vue, 'radix-vue': radix,
        'element-plus': { ElButton: button, ElCollapse: wrapper, ElCollapseItem: wrapper, ElInputNumber: wrapper },
        '@/assets/buff': { buffData }, '@/assets/_gen_character': { default: { Mona: { element: 'Hydro', nameLocale: 'Mona' } } },
        '@/assets/character': { characterByElement: { Hydro: [] } },
        '@/assets/element-icons': { default: { Hydro: 'hydro.png' } },
        '@/i18n/i18n': { useI18n: () => ({ t: x => x, ta: x => x }) },
        '@/store/pinia/miyoushe': { useMiyousheStore: () => ({ uidGroups: vue.ref([]), selectedUid: vue.ref(''), data: vue.ref({ entries: [] }) }) },
        '@/store/pinia/preset': { usePresetStore: () => ({ presets: vue.ref({}) }) },
        '@/components/config/ItemConfig': { default: { render: () => null } },
        '@/components/ui/UiButton.vue': { default: button }, '@/components/ui/UiNumberInput.vue': { default: wrapper },
        '@/components/ui/UiSelect.vue': { default: wrapper },
        '@/algorithms/buff-groups/ownership.json': { default: { CharacterSample: { character: 'Mona', minConstellation: 0 } } },
        '@/algorithms/buff-groups/index.mjs': groups,
    }, value => { childState = value })
    const picker = component('src/components/select/SelectBuff.vue', {
        vue, 'radix-vue': radix, '@buff': { buffFlat: Object.values(buffData) }, 'fuse.js': Fuse,
        '@/components/ui/UiButton.vue': { default: button }, '@/components/ui/UiSearchInput.vue': { default: searchInput },
        '@/i18n/i18n': { useI18n: () => ({ t: (key, name) => name || key, ta: x => x }) }, './CharacterBuffGroups.vue': { default: character },
    }, value => { pickerState = value })
    let pendingSelection
    const app = renderer.createApp({ render: () => vue.h(picker, {
        shadcn: true,
        selectedNames: state.buffs.value.map(buff => buff.name),
        onSelect: (...args) => { pendingSelection = handleSelectBuff(...args) },
    }) })
    app.component('el-input', searchInput)
    for (const name of ['el-tabs', 'el-tab-pane', 'el-select', 'el-option', 'el-tag', 'el-empty', 'i-ep-arrow-down']) app.component(name, wrapper)
    const root = { children: [] }
    app.mount(root)
    nodes(root).find(node => node.type === 'input').props.onInput({ target: { value: 'Sample' } })
    childState.expanded.value = 'Mona'
    await vue.nextTick()
    const addCharacter = nodes(root).find(node => node.props?.['aria-label'] === '添加CharacterSample')
    assert.ok(addCharacter)
    addCharacter.props.onClick()
    await pendingSelection
    assert.equal(showSelectBuffDialog.value, true, page)
    assert.deepEqual(plain(state.buffs.value[0].config), { CharacterSample: { skill1: 10 } })
    for (const genre of ['Weapon', 'Artifact', 'Resonance', 'Common']) {
        const tab = nodes(root).find(node => node.props?.role === 'tab' && nodes(node).some(n => n.text === genre))
        assert.ok(tab, genre)
        tab.props.onClick()
        await vue.nextTick()
        const row = nodes(root).find(node => node.props?.class === 'buff-item buff-choice'
            && nodes(node).some(n => n.text === genre + 'Sample'))
        assert.ok(row, genre)
        assert.equal(row.type, 'button')
        row.props.onClick()
        row.props.onClick()
        await pendingSelection
        assert.equal(showSelectBuffDialog.value, true, page + ': ' + genre)
        assert.equal(pickerState.activeTab.value, genre)
        assert.equal(pickerState.searchString.value, 'Sample')
        const entries = state.buffs.value.filter(b => b.name === genre + 'Sample')
        assert.equal(entries.length, 1, 'repeated selection does not duplicate ' + genre)
        assert.deepEqual(plain(entries[0].config), genre === 'Artifact' ? 'NoConfig' : { [genre + 'Sample']: { value: 7 } })
    }
    assert.equal(state.buffs.value.length, 5)
    assert.equal(confirmations.length, 4)
    confirmDuplicate = true
    const row = nodes(root).find(node => node.props?.class === 'buff-item buff-choice'
        && nodes(node).some(n => n.text === 'CommonSample'))
    row.props.onClick()
    await pendingSelection
    assert.equal(state.buffs.value.filter(buff => buff.name === 'CommonSample').length, 2)
    assert.equal(showSelectBuffDialog.value, true)
    app.unmount()
})
