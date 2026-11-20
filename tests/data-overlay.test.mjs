import test from 'node:test'
import assert from 'node:assert/strict'
import {composeKernelApi} from '../beta-data/compose-kernel-api.mjs'
import {applyDataOverlay, PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {api, rawOriginal, core, extension, data} from '../beta-tools/runtime.mjs'

// 签名武器「无尽的蛹」的副词条（暴击伤害）90 级数值，补丁把它加 0.1，核对暴击伤害恰好多 0.1。
const SUBSTAT_DELTA = 0.1
// 凯亚不是内核自带实现专武的角色，专武数值走限定武器门面里的行数据（limited-weapon-facade.mjs）
const kaeyaWith = (name, params) => ({character: {name: 'Kaeya', level: 90, ascend: false, constellation: 0, skill1: 9, skill2: 9, skill3: 9, params: 'NoConfig'},
    weapon: {name, level: 90, ascend: false, refine: 1, params: {[name]: params}}, artifacts: [], artifact_config: null, buffs: []})
const chrysalis = () => kaeyaWith('BeyondTheChrysalis', {loyal_wind: false, rebel_wind: false, on_field: true})
const hymn = () => kaeyaWith('HymnOfTheMaelstrom', {stacks: 0, boosted: false, on_field: true})
const attribute = (kernel, input) => kernel.CommonInterface.get_attribute(input)
const critDamage = kernel => Object.values(attribute(kernel, chrysalis()).critical_damage).reduce((a, b) => a + b, 0)
function patchedSignatureWeapons(delta) {
    const patched = structuredClone(data.signatureWeapons)
    const row = patched.weapons.find(w => w.name === 'BeyondTheChrysalis').levels.find(r => r.level === 90 && !r.ascend)
    row.subStat += delta
    return patched
}
const compose = overlay => composeKernelApi({rawOriginal, core, extension, data, overlay}).api

test('applyDataOverlay returns the packaged data object itself when there is no overlay', () => {
    assert.equal(applyDataOverlay(data, undefined), data)
    assert.equal(applyDataOverlay(data, null), data)
})

test('applyDataOverlay replaces whole entries and keeps the rest', () => {
    const replacement = {weapons: []}
    const merged = applyDataOverlay(data, {weapons: replacement})
    assert.equal(merged.weapons, replacement)
    for (const key of Object.keys(data).filter(key => key !== 'weapons')) assert.equal(merged[key], data[key])
    assert.notEqual(merged, data)
})

test('applyDataOverlay rejects entries that are not registered or not data', () => {
    assert.throws(() => applyDataOverlay(data, {equipmentRules: {}}), error => error.code === 'DATA_OVERLAY_INVALID' && error.stage === 'overlay' && /equipmentRules/.test(error.message))
    assert.throws(() => applyDataOverlay(data, {weapons: 'text'}), {code: 'DATA_OVERLAY_INVALID'})
    assert.throws(() => applyDataOverlay(data, {weapons: null}), {code: 'DATA_OVERLAY_INVALID'})
    assert.throws(() => applyDataOverlay(data, [data]), {code: 'DATA_OVERLAY_INVALID'})
})

test('every registered key is an entry of the data the entries pass in', () => {
    assert.deepEqual(Object.keys(PATCHABLE_DATA).sort(), Object.keys(data).sort())
})

test('composeKernelApi without an overlay gives the same results as the entry', () => {
    assert.equal(critDamage(compose(undefined)), critDamage(api))
})

test('an overlay changes only the weapon it replaces', () => {
    const before = critDamage(api)
    const patched = compose({signatureWeapons: patchedSignatureWeapons(SUBSTAT_DELTA)})
    assert.ok(Math.abs(critDamage(patched) - (before + SUBSTAT_DELTA)) < 1e-9, critDamage(patched) + ' vs ' + (before + SUBSTAT_DELTA))
    // 没被补丁覆盖的武器不变：另一把专武的全部属性与未打补丁时逐项一致
    assert.deepEqual(attribute(patched, hymn()), attribute(api, hymn()))
    assert.equal(critDamage(api), before, 'the overlay must not leak into the unpatched API')
})
