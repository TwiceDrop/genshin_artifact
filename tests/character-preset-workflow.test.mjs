import test from 'node:test'
import assert from 'node:assert/strict'
import { presetSource, createCustomPreset, refreshGamePreset, readPresetConfiguration,
    snapshotPreset, applyPresetArtifacts } from '../src/utils/preset-workflow.mjs'

test('分类不改旧配置；游戏刷新保留手动条件，另存自定义不再随来源同步', () => {
    const old = {
        name: '测试游戏角色', miyousheKey: '111111111:10000021:Pyro', artifactIds: [1, 2, 3, 4, 5],
        character: {name: 'Amber', level: 80, params: {Amber: {aimed: true}}},
        weapon: {name: 'PolarStar', level: 80, params: {PolarStar: {stack: 3}}},
        buffs: [{name: 'fixture', lock: false, config: {value: 12}}],
        enemy: {level: 100}, infusion: 'Pyro', skill: {index: 2, config: 'NoConfig'},
        singleConfig: {test: {active: true}}, constraint: {minRecharge: 1.8},
    }
    const before = structuredClone(old)
    assert.equal(presetSource(old), 'game')
    const custom = createCustomPreset({}, '测试自定义', old)
    assert.equal(presetSource(custom), 'custom')
    const incoming = {name: '导入名称', character: {name: 'Amber', level: 90, params: 'NoConfig'},
        weapon: {name: 'PolarStar', level: 90, params: {PolarStar: {stack: 0}}}}
    const updated = refreshGamePreset(old, incoming, [6, 7, 8, 9, 10], old.miyousheKey, old.name)
    assert.equal(updated.character.level, 90)
    assert.equal(updated.weapon.params.PolarStar.stack, 3)
    assert.deepEqual(updated.artifactIds, [6, 7, 8, 9, 10])
    assert.deepEqual(updated.buffs, before.buffs)
    assert.deepEqual(updated.enemy, {level: 100})
    assert.deepEqual(updated.constraint, {minRecharge: 1.8})
    assert.deepEqual(custom.artifactIds, [1, 2, 3, 4, 5])
    assert.deepEqual(old, before)
    updated.buffs[0].config.value = 99
    assert.equal(old.buffs[0].config.value, 12)
    assert.throws(() => createCustomPreset({'测试自定义': {item: custom}}, '测试自定义', old), /已有同名预设/)
})

test('当前面板完整保存并恢复；旧字段使用约定初始值；应用结果只换装备且拒绝缺失/变更的历史装备', () => {
    const defaults = {enemy: {level: 90, pyro_res: 0.1}, infusion: 'None',
        skill: {index: 0, config: 'NoConfig'}, singleConfig: {fixture: {stack: 1}}}
    const state = {name: '测试', character: {name: 'Amber'}, weapon: {name: 'PolarStar'},
        buffs: [{id: 12, name: 'test', lock: true, config: 'NoConfig'}],
        enemy: {level: 110, pyro_res: -0.2}, infusion: 'Pyro',
        skill: {index: 3, config: {Amber: {aimed: true}}}, singleConfig: {fixture: {stack: 4}}}
    const saved = snapshotPreset(state)
    assert.equal('id' in saved.buffs[0], false)
    assert.deepEqual(readPresetConfiguration(saved, defaults), saved)
    assert.deepEqual(readPresetConfiguration({name: '旧预设'}, defaults), {name: '旧预设', ...defaults})
    const positions = ['flower', 'feather', 'sand', 'cup', 'head']
    const items = positions.map((position, id) => ({id, position, setName: 'GladiatorFinale', level: 20, star: 5,
        mainTag: {name: 'attackStatic', value: 311}, normalTags: [{name: 'critical', value: 0.031}]}))
    const inventory = new Map(items.map(item => [item.id, structuredClone(item)]))
    const target = {...state, miyousheKey: '111111111:10000021:Pyro', artifactIds: [10, 11, 12, 13, 14]}
    const result = applyPresetArtifacts(target, [0, 1, 2, 3, 4], items, inventory)
    assert.deepEqual(result, {...target, artifactIds: [0, 1, 2, 3, 4]})
    assert.deepEqual(target.artifactIds, [10, 11, 12, 13, 14])
    assert.throws(() => applyPresetArtifacts(target, [0, 1, -1, 3, 4], items, inventory), /不足五件/)
    inventory.get(1).level = 0
    assert.throws(() => applyPresetArtifacts(target, [0, 1, 2, 3, 4], items, inventory), /发生变化/)
    inventory.delete(1)
    assert.throws(() => applyPresetArtifacts(target, [0, 1, 2, 3, 4], items, inventory), /仓库移除/)
})
