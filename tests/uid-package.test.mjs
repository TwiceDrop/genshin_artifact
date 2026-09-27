import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createMysConverter } from '../src/import/miyoushe.mjs'
import { exportUidPackage, importUidPackage, validateUidPackage } from '../src/import/uid-package.mjs'
import { createHash as nativeHash } from 'node:crypto'
import { createHash, randomBytes, randomInt } from '../src/platform/crypto-browser.mjs'

const meta = name => JSON.parse(fs.readFileSync(new URL(`../src/assets/_gen_${name}.js`, import.meta.url), 'utf8').replace(/^.*\nexport default /, '').trim().replace(/;$/, ''))
const catalog = { characters: meta('character'), weapons: meta('weapon'), artifacts: meta('artifact'), targets: meta('tf'), locale: JSON.parse(fs.readFileSync(new URL('../src/i18n/generated/zh-cn.json', import.meta.url))) }
const converter = createMysConverter(catalog)
function fixture(uid = '111111111') {
    const snapshot = JSON.parse(fs.readFileSync(new URL('./fixtures/miyoushe-synthetic.json', import.meta.url)))
    snapshot.role.uid = uid
    const data = { snapshots: { [uid]: snapshot }, entries: [] }, presets = {}, inventory = new Map()
    for (const raw of snapshot.characters) {
        const c = converter.character(raw, uid), ids = c.gear.map(a => { const id = inventory.size + 10; inventory.set(id, { ...a, id }); return id })
        const item = { ...c.preset, artifactIds: ids, miyousheKey: c.key }
        presets[item.name] = { name: item.name, item }
        data.entries.push({ key: c.key, uid, label: c.label, artifactIds: ids, equippedArtifacts: c.gear, presetName: item.name })
    }
    data.artifactComparison = { history: [{ id: 'history-1', key: data.entries[0].key, time: '2026-09-11T12:00:00Z', label: '手动保存', items: data.entries[0].artifactIds.map(id => inventory.get(id)) }] }
    return { data, presets, inventory }
}
function destination() {
    const state = fixture('222222222')
    return { ...state, catalog, addArtifact(a) { const id = 1000 + state.inventory.size; state.inventory.set(id, { ...a, id }); return id },
        addPreset(name, item) { state.presets[name] = { name, item } } }
}
test('UID package carries only chosen roles, presets and history, survives ID remapping and repeated import', () => {
    const source = fixture(), pack = exportUidPackage('111111111', source.data, source.presets, source.inventory)
    assert.equal(pack.characters.length, 4)
    assert.equal(pack.history.length, 1)
    validateUidPackage(pack, catalog)
    const dest = destination(), before = JSON.stringify(dest.data.entries)
    const result = importUidPackage(JSON.parse(JSON.stringify(pack)), dest)
    assert.equal(JSON.stringify(result.data.entries.filter(e => e.uid === '222222222')), before)
    assert.equal(result.data.entries.length, 8)
    assert.ok(result.data.entries.every(e => e.artifactIds.every(id => dest.inventory.has(id))))
    const count = dest.inventory.size
    const repeat = importUidPackage(pack, { ...dest, data: result.data })
    assert.equal(repeat.added, 0); assert.equal(dest.inventory.size, count)
    assert.equal(repeat.data.artifactComparison.history.filter(h => h.key.startsWith('111111111:')).length, 1)
    assert.equal(repeat.data.entries.filter(e => e.uid === '111111111').length, 4)
})
test('invalid package fails before writes, rejects cross-UID data and credentials', () => {
    const source = fixture(), original = exportUidPackage('111111111', source.data, source.presets, source.inventory)
    for (const mutate of [p => { p.characters[0].entry.uid = '333333333' }, p => { p.characters[0].preset.character.skill2 = -1 }, p => { p.cookie = 'secret' }, p => { p.artifacts[0].mainTag.value = null }]) {
        const p = structuredClone(original); mutate(p)
        let writes = 0
        assert.throws(() => importUidPackage(p, { ...destination(), addArtifact: () => { writes++ }, addPreset: () => { writes++ } }), /UID 数据包/)
        assert.equal(writes, 0)
    }
})
test('mobile DS digest is identical to Node and random parameters have expected format', () => {
    const value = 'salt=xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs&t=123&r=456&b={"角色":"莫娜"}&q='
    assert.equal(createHash('md5').update(value).digest('hex'), nativeHash('md5').update(value).digest('hex'))
    assert.match(randomBytes(8).toString('hex'), /^[0-9a-f]{16}$/)
    for (let i = 0; i < 30; i++) { const n = randomInt(100001, 200000); assert.ok(n >= 100001 && n < 200000) }
})

test('deleted warehouse equipment does not prevent exporting a saved UID', () => {
    const source = fixture(), id = source.data.entries[0].artifactIds[0]
    source.inventory.delete(id)
    const pack = exportUidPackage('111111111', source.data, source.presets, source.inventory)
    validateUidPackage(pack, catalog)
    assert.equal(pack.characters[0].entry.artifactIds[0], -1)
    assert.equal(pack.characters[0].preset.artifactIds[0], -1)
    assert.ok(pack.characters[0].entry.equippedArtifacts[0])
    assert.ok(pack.history[0].items[0])
    assert.equal(source.data.entries[0].artifactIds[0], id)
})
import { captureImportState, appendImportRecord, undoImportRecord } from '../src/import/import-history.mjs'
import { selectUidInventory } from '../src/import/uid-inventory.mjs'
function applyRecorded(pack, dest) {
    const before = captureImportState(dest.data, dest.presets, dest.inventory)
    const result = importUidPackage(pack, dest)
    dest.data = appendImportRecord(result.data, before, dest.presets, dest.inventory, { source: 'test.json', uids: [pack.uid] })
    return dest.data.importRecords[0]
}
function undoRecorded(record, dest, options = {}) {
    const result = undoImportRecord(record.id, { ...dest, deletePreset: name => delete dest.presets[name], removeArtifact: id => dest.inventory.delete(id), ...options })
    dest.data = result.data
    return result
}
test('UID export includes owned unequipped pieces and optional unassigned items, excludes other UID', () => {
    const state = fixture(), uid = '111111111'
    const a = structuredClone([...state.inventory.values()][0])
    for (const id of [800,801,802]) state.inventory.set(id,{...a,id})
    state.data.uidArtifactIds = { [uid]: [800], '222222222': [801] }
    const pack = exportUidPackage(uid, state.data, state.presets, state.inventory)
    assert.ok(pack.artifacts.some(a=>a.id===800)); assert.ok(pack.artifacts.some(a=>a.id===802))
    assert.ok(!pack.artifacts.some(a=>a.id===801))
    const explicit = exportUidPackage(uid,state.data,state.presets,state.inventory,false)
    assert.ok(explicit.artifacts.some(a=>a.id===800)); assert.ok(!explicit.artifacts.some(a=>a.id===802))
})
test('repeat import then undo never removes the previously existing artifacts', () => {
    const source = fixture(), pack = exportUidPackage('111111111',source.data,source.presets,source.inventory)
    const dest = destination()
    const first = applyRecorded(pack,dest)
    const original = JSON.stringify([...dest.inventory])
    const repeat = applyRecorded(pack,dest)
    assert.equal(repeat.added,0)
    assert.throws(()=>undoRecorded(first,dest),/较新的导入/)
    dest.data = JSON.parse(JSON.stringify(dest.data)) // journal survives reload
    const result = undoRecorded(repeat,dest)
    assert.equal(result.removed,0); assert.equal(JSON.stringify([...dest.inventory]),original)
    assert.equal(dest.data.entries.filter(e=>e.uid==='111111111').length,4)
})
test('mixed duplicates and new items: undo removes only the actual new items', () => {
    const source = fixture(), pack = exportUidPackage('111111111',source.data,source.presets,source.inventory)
    const dest = destination()
    applyRecorded(pack,dest)
    const old = JSON.stringify([...dest.inventory])
    const added = structuredClone(pack.artifacts[0]); added.id = 9800; added.mainTag.value += 1
    pack.artifacts.push(added)
    const second = applyRecorded(pack,dest)
    assert.equal(second.added,1)
    assert.equal(undoRecorded(second,dest).removed,1)
    assert.equal(JSON.stringify([...dest.inventory]),old)
})
test('undo restores overwritten character and preset and leaves unrelated UID unchanged', () => {
    const source = fixture(), pack = exportUidPackage('111111111',source.data,source.presets,source.inventory), dest = destination()
    applyRecorded(pack,dest)
    const oldPresets = JSON.stringify(dest.presets), oldEntries = JSON.stringify(dest.data.entries)
    pack.characters[0].preset.character.constellation = 5
    pack.characters[0].entry.constellation = 5
    const record = applyRecorded(pack,dest)
    undoRecorded(record,dest)
    assert.equal(JSON.stringify(dest.presets),oldPresets); assert.equal(JSON.stringify(dest.data.entries),oldEntries)
})
test('undo retains subsequently edited records and referenced or modified new artifacts', () => {
    const source = fixture(), pack = exportUidPackage('111111111',source.data,source.presets,source.inventory), dest = destination()
    const record = applyRecorded(pack,dest), addedIds = record.changes.artifacts.map(c=>Number(c.key))
    assert.ok(addedIds.length>=3)
    dest.inventory.get(addedIds[0]).omit = true
    dest.presets.manual = { name: 'manual', item: { artifactIds: [addedIds[1]] } }
    const key = dest.data.entries.find(e=>e.uid===pack.uid).presetName
    dest.presets[key].item.character.level = 89
    const result = undoRecorded(record,dest,{extraArtifactIds:[addedIds[2]]})
    assert.ok(dest.inventory.has(addedIds[0])); assert.ok(dest.inventory.has(addedIds[1])); assert.ok(dest.inventory.has(addedIds[2]))
    assert.equal(dest.presets[key].item.character.level,89)
    assert.ok(result.retained>=3)
})
test('existing unassigned duplicate is reused, survives undo, and identical copies retain multiplicity', () => {
    const source = fixture(), pack = exportUidPackage('111111111',source.data,source.presets,source.inventory), dest = destination()
    const existing = structuredClone(pack.artifacts[0]); existing.id=7000
    dest.inventory.set(existing.id,existing)
    const copy = structuredClone(pack.artifacts[0]); copy.id=7001; pack.artifacts.push(copy)
    const record = applyRecorded(pack,dest)
    const owned = selectUidInventory(pack.uid,dest.data,dest.presets,dest.inventory,false)
    assert.ok(owned.some(a=>a.id===7000)); assert.equal(owned.length,pack.artifacts.length)
    undoRecorded(record,dest)
    assert.deepEqual(dest.inventory.get(7000),existing)
})
test('unrelated newer UID import does not block undo and retains its inventory', () => {
    const first = fixture('111111111'), second = fixture('333333333'), dest = destination()
    const record = applyRecorded(exportUidPackage('111111111',first.data,first.presets,first.inventory),dest)
    applyRecorded(exportUidPackage('333333333',second.data,second.presets,second.inventory),dest)
    const other = JSON.stringify(dest.data.entries.filter(e=>e.uid==='333333333'))
    undoRecorded(record,dest)
    assert.equal(JSON.stringify(dest.data.entries.filter(e=>e.uid==='333333333')),other)
    assert.ok(dest.data.entries.every(e=>e.artifactIds.every(id=>dest.inventory.has(id))))
})
