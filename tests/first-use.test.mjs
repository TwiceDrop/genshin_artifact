import test from 'node:test'
import assert from 'node:assert/strict'
import { isDataEmpty, needsFirstUse } from '../src/platform/first-use.mjs'

const emptyArtifacts = { flower: [], feather: [], sand: [], cup: [], head: [] }
const someArtifacts = { ...emptyArtifacts, flower: [{ id: 1 }] }
const somePresets = { 合成预设: { name: '合成预设', item: {}, version: 3 } }

test('空值判断：不存在、空数组、空对象和各部位全空都算没有数据', () => {
    for (const v of [null, undefined, [], {}, emptyArtifacts]) assert.equal(isDataEmpty(v), true)
    for (const v of [someArtifacts, somePresets]) assert.equal(isDataEmpty(v), false)
})

test('所有账号都没有数据且没记过完成：弹出', () => {
    assert.equal(needsFirstUse({ done: false, accountData: [{ artifacts: null, presets: null }, { artifacts: emptyArtifacts, presets: {} }] }), true)
})

test('任一账号有圣遗物或预设：不弹', () => {
    assert.equal(needsFirstUse({ done: false, accountData: [{ artifacts: null, presets: null }, { artifacts: someArtifacts, presets: null }] }), false)
    assert.equal(needsFirstUse({ done: false, accountData: [{ artifacts: emptyArtifacts, presets: somePresets }] }), false)
})

test('记过已完成：即使没有数据也不弹', () => {
    assert.equal(needsFirstUse({ done: true, accountData: [{ artifacts: null, presets: null }] }), false)
})
