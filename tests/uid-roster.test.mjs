import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import * as importHistory from '../src/import/import-history.mjs'
import * as uidInventory from '../src/import/uid-inventory.mjs'
import { mergeEquipped } from '../src/import/miyoushe.mjs'
import { characterSummary } from '../src/import/character-summary.mjs'

function harness() {
    const inventory = { artifacts: vue.ref(new Map()), addArtifact(a) { const id = this.artifacts.value.size; this.artifacts.value.set(id, { ...a, id }); return id } }
    const presets = { presets: vue.ref({}), addOrOverwrite(name, item) { this.presets.value[name] = { name, item } }, getPreset(name) { return this.presets.value[name] } }
    const modules = { '@/import/import-history.mjs': importHistory, '@/import/uid-inventory.mjs': uidInventory, vue, './artifact': { useArtifactStore: () => inventory }, './preset': { usePresetStore: () => presets }, '@/import/miyoushe.mjs': { mergeEquipped } }
    const exports = {}
    const source = fs.readFileSync(new URL('../src/store/pinia/miyoushe.ts', import.meta.url), 'utf8')
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, { exports, require: key => modules[key] })
    return { store: exports.useMiyousheStore(), presets, inventory }
}
const converter = { character(raw, uid) {
    if (raw.fail) throw new Error('暂时无法读取')
    return { key: `${uid}:${raw.base.id}:Pyro`, label: '安柏', gear: [{ position: 'flower', setName: 'set', star: 5, level: 20, mainTag: { name: 'lifeStatic', value: 4780 }, normalTags: [{ name: 'critical', value: raw.critical || .1 }] }],
        preset: { name: `米游社 ${uid} · 安柏`, character: { name: 'Amber', level: 90, constellation: 0 }, weapon: { name: 'Bow' } } }
} }
const snapshot = (uid, character = { base: { id: 21, element: 'Pyro' } }) => ({ version: 1, source: 'miyoushe', role: { uid, nickname: `测试${uid}` }, characters: character ? [character] : [], importedAt: '2026-09-11T10:00:00Z' })

test('import and refresh two UIDs independently, retain presets, equipment, groups and selection across reload', () => {
    const { store, presets } = harness()
    store.importSnapshot(snapshot('111111111'), converter)
    const first = JSON.stringify(store.data.value.entries[0])
    store.importSnapshot(snapshot('222222222'), converter)
    assert.equal(JSON.stringify(store.data.value.entries[0]), first)
    assert.equal(store.uidGroups.value.length, 2)
    assert.equal(store.selectedUid.value, '222222222')
    store.selectedUid.value = '111111111'
    store.data.value.artifactComparison = { history: [{ key: 'example' }] }
    store.init(JSON.parse(JSON.stringify(store.data.value)))
    assert.equal(store.selectedUid.value, '111111111')
    const second = JSON.stringify(store.data.value.entries.find(e => e.uid === '222222222'))
    store.importSnapshot(snapshot('111111111', { base: { id: 21, element: 'Pyro' }, critical: .2 }), converter)
    assert.equal(JSON.stringify(store.data.value.entries.find(e => e.uid === '222222222')), second)
    assert.equal(Object.keys(presets.presets.value).length, 2)
    assert.equal(store.data.value.artifactComparison.history.length, 1)
    assert.ok(store.data.value.entries.every(e => presets.getPreset(e.presetName)))
})

test('partial or failed sync preserves the previously usable character and frozen game equipment', () => {
    const { store, inventory } = harness()
    store.importSnapshot(snapshot('111111111'), converter)
    const entry = store.data.value.entries[0]
    inventory.artifacts.value.get(entry.artifactIds[0]).normalTags[0].value = .4
    assert.equal(entry.equippedArtifacts[0].normalTags[0].value, .1)
    store.importSnapshot(snapshot('111111111', null), converter)
    assert.ok(store.data.value.entries[0].warning)
    assert.ok(!store.data.value.entries[0].error)
    store.importSnapshot(snapshot('111111111', { base: { id: 21, element: 'Pyro' }, fail: true }), converter)
    assert.ok(store.data.value.entries[0].presetName)
    assert.ok(!store.data.value.entries[0].error)
    assert.equal(store.data.value.entries[0].equippedArtifacts[0].normalTags[0].value, .1)
})

test('older missing-character errors become non-blocking warnings when a valid preset exists', () => {
    const summary = characterSummary({ label: '安柏', error: '本次同步未返回该角色，保留旧数据，请重新同步' }, {
        preset: { character: { name: 'Amber' }, artifactIds: [] }, characters: {}, weapons: {}, artifacts: {}, locale: {}, inventory: new Map(),
    })
    assert.equal(summary.error, '')
    assert.ok(summary.warning)
})
