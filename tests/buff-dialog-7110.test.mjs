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

test('all BUFF genres stay open through consecutive additions in both calculator consumers', async () => {
    for (const page of ['NewArtifactPlanPage', 'MonaPlaygroundPage']) {
        const useBuff = evaluate(read('src/composables/buff.ts'), {
            '@buff': { buffData }, '@/utils/idProvider': { RandomIDProvider: class { next = 1; generateId() { return this.next++ } } },
            '@/algorithms/polestar-field.mjs': polestar,
        }).useBuff
        const state = useBuff(), showSelectBuffDialog = vue.ref(true)
        const { descriptor } = parse(read(`src/pages/${page}/${page}.vue`))
        const source = ts.createSourceFile(page + '.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
        const handler = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleSelectBuff')
        assert.ok(handler)
        const handlerJs = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
        const handleSelectBuff = vm.runInNewContext(handlerJs + '\nhandleSelectBuff', { ...state, showSelectBuffDialog })
        let childState, pickerState
        const character = component('src/components/select/CharacterBuffGroups.vue', {
            vue, '@/assets/buff': { buffData }, '@/assets/_gen_character': { default: { Mona: { element: 'Hydro', nameLocale: 'Mona' } } },
            '@/assets/character': { characterByElement: { Hydro: [] } },
            '@/i18n/i18n': { useI18n: () => ({ t: x => x, ta: x => x }) },
            '@/store/pinia/miyoushe': { useMiyousheStore: () => ({ uidGroups: vue.ref([]), selectedUid: vue.ref(''), data: vue.ref({ entries: [] }) }) },
            '@/store/pinia/preset': { usePresetStore: () => ({ presets: vue.ref({}) }) },
            '@/components/config/ItemConfig': { default: { render: () => null } },
            '@/algorithms/buff-groups/ownership.json': { default: { CharacterSample: { character: 'Mona', minConstellation: 0 } } },
            '@/algorithms/buff-groups/index.mjs': groups,
        }, value => { childState = value })
        const picker = component('src/components/select/SelectBuff.vue', {
            vue, '@buff': { buffFlat: Object.values(buffData) }, 'fuse.js': Fuse,
            '@/i18n/i18n': { useI18n: () => ({ t: x => x, ta: x => x }) }, './CharacterBuffGroups.vue': { default: character },
        }, value => { pickerState = value })
        const app = renderer.createApp({ render: () => vue.h(picker, { selectedNames: state.buffs.value.map(b => b.name), onSelect: handleSelectBuff }) })
        const wrapper = { setup(_props, { attrs, slots }) { return () => vue.h('section', attrs, [slots.title?.(), slots.default?.()]) } }
        for (const name of ['el-input', 'el-tabs', 'el-tab-pane', 'el-select', 'el-option', 'el-collapse', 'el-collapse-item', 'el-tag', 'el-input-number', 'el-button', 'el-empty']) app.component(name, wrapper)
        const root = { children: [] }
        app.mount(root)
        pickerState.searchString.value = 'Sample'
        childState.expanded.value = 'Mona'
        await vue.nextTick()
        const addCharacter = nodes(root).find(node => node.props?.['aria-label'] === '添加CharacterSample')
        assert.ok(addCharacter)
        addCharacter.props.onClick()
        assert.equal(showSelectBuffDialog.value, true, page)
        assert.deepEqual(plain(state.buffs.value[0].config), { CharacterSample: { skill1: 10 } })
        for (const genre of ['Weapon', 'Artifact', 'Resonance', 'Common']) {
            pickerState.activeTab.value = genre
            await vue.nextTick()
            const row = nodes(root).find(node => node.props?.class === 'buff-item' && nodes(node).some(n => n.text === genre + 'Sample'))
            assert.ok(row, genre)
            row.props.onClick()
            row.props.onClick()
            assert.equal(showSelectBuffDialog.value, true, page + ': ' + genre)
            assert.equal(pickerState.activeTab.value, genre)
            assert.equal(pickerState.searchString.value, 'Sample')
            const entries = state.buffs.value.filter(b => b.name === genre + 'Sample')
            assert.equal(entries.length, 1, 'repeated selection does not duplicate ' + genre)
            assert.deepEqual(plain(entries[0].config), genre === 'Artifact' ? 'NoConfig' : { [genre + 'Sample']: { value: 7 } })
        }
        assert.equal(state.buffs.value.length, 5)
        app.unmount()
    }
})
