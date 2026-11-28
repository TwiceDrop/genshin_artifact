import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import {computed, ref} from 'vue'
import {api, named} from '../beta-tools/runtime.mjs'
import {fixture, gear, optimizer} from '../beta-tools/interface-audit-7108.mjs'
import {PANEL_STATS, readPanel} from '../beta-data/panel-search.mjs'
import {searchSegmentBuilds} from '../beta-data/dsl-segment-search.mjs'

test('damage range settings round-trip in presets and load older minimums', () => {
    const source = fs.readFileSync(new URL('../src/composables/constraint.ts', import.meta.url), 'utf8')
    const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}})
    const exports = {}
    vm.runInNewContext(outputText, {exports, ref, computed, require(name) {
        if (name === '@/utils/converter') return {convertArtifactName: x => x}
        assert.equal(name, '../../beta-data/panel-search.mjs')
        return {PANEL_STATS}
    }})
    const {panelBounds, presetConstraint, constraintInterface, restorePanelBounds} = exports.useComputeConstraint()
    panelBounds.value = {
        hp: {min: 16000, max: 30000}, atk: {min: 1500}, def: {min: 700},
        elemental_mastery: {max: 0}, recharge: {min: 1.25, max: 2.35},
    }
    const snapshot = value => JSON.parse(JSON.stringify(value))
    const saved = snapshot(presetConstraint.value)
    const expected = snapshot(constraintInterface.value)
    assert.equal(expected.hp_min, 16000)
    assert.equal(expected.atk_min, 1500)
    assert.equal(expected.def_min, 700)
    assert.equal(expected.recharge_min, 1.25)
    assert.deepEqual(expected.panel_max, {hp: 30000, elemental_mastery: 0, recharge: 2.35})

    restorePanelBounds({minRecharge: 1.8, minCritical: .6})
    assert.equal(constraintInterface.value.hp_min, 0)
    assert.equal(constraintInterface.value.recharge_min, 1.8)
    assert.equal(constraintInterface.value.crit_min, .6)
    assert.equal(constraintInterface.value.panel_max, undefined)
    restorePanelBounds(saved)
    assert.deepEqual(snapshot(constraintInterface.value), expected)
})

test('both damage algorithms find builds below the initial 100 when they exceed a panel maximum', () => {
    const [flowers, feathers] = gear.slice(0, 2).map((artifact, slot) => Array.from({length: 13}, (_, i) => ({
        ...artifact, id: 100 * slot + i + 1, sub_stats: [['ATKPercentage', i * .02]],
    })))
    const fixed = gear.slice(2).map((artifact, i) => ({...artifact, id: 200 + i}))
    const inventory = [...flowers, ...feathers, ...fixed]
    const candidatesById = new Map(inventory.map(a => [a.id, a]))
    for (const character of ['Kaeya', 'Vodyanitsa']) {
        const input = optimizer(fixture(character, 'MaxATK'))
        const panels = flowers.flatMap(flower => feathers.map(feather => readPanel(api, input, [flower, feather, ...fixed])))
        const limits = {
            hp_min: panels[0].hp - 1e-7, def_min: panels[0].def - 1e-7,
            atk_min: panels[0].atk + 1,
            panel_max: {atk: panels[6].atk + 1e-7, elemental_mastery: panels[0].elemental_mastery},
        }
        const rounded = value => Math.round(value * 1e4)
        const expected = panels.filter(p => p.atk >= limits.atk_min && p.atk <= limits.panel_max.atk)
            .map(p => rounded(p.atk)).sort((a,b) => b-a)
        assert.ok(expected.length > 0)
        for (const algorithm of ['AStar', 'Naive']) {
            const config = {...input, algorithm}
            const initial = api.OptimizeSingleWasm.optimize(config, inventory)
            assert.equal(initial.length, 100)
            assert.ok(initial.at(-1).value > limits.panel_max.atk)
            const progress = []
            const rows = api.OptimizeSingleWasm.optimize({...config, constraint: {set_mode: 'Any', ...limits}}, inventory, p => progress.push(p))
            assert.deepEqual(rows.map(row => rounded(readPanel(api, input, [
                candidatesById.get(row.flower), candidatesById.get(row.feather), ...fixed,
            ]).atk)), expected, character + ' ' + algorithm)
            assert.equal(rows[0].ratio, 1)
            assert.ok(progress.at(-1).evaluated <= panels.length)
            assert.equal(progress.at(-1).percent, 100)
            assert.equal(progress.at(-1).remainingGroups, 0)
        }
    }
})

test('HP caps prune impossible domains and preserve the top 100 eligible builds', () => {
    const input = optimizer(fixture('Kaeya', 'MaxATK'))
    const inventory = gear.flatMap((artifact, slot) => Array.from({length: 4}, (_, index) => ({
        ...artifact,
        id: 4 * slot + index + 1,
        main_stat: slot === 0 && index >= 2 ? ['HPFixed', 7780] : artifact.main_stat,
        sub_stats: [['ATKPercentage', index * 4 ** slot * .0001]],
    })))
    const eligibleInventory = inventory.filter(artifact => artifact.id !== 3 && artifact.id !== 4)
    const eligibleBuild = gear.map((_, slot) => inventory[4 * slot])
    const maxHp = readPanel(api, input, eligibleBuild).hp

    for (const algorithm of ['AStar', 'Naive']) {
        const config = {...input, algorithm}
        const optimizeWithCap = (hp, onProgress) => api.OptimizeSingleWasm.optimize({
            ...config, constraint: {...config.constraint, panel_max: {hp}},
        }, inventory, onProgress)

        const progress = []
        assert.deepEqual(optimizeWithCap(1, event => progress.push(event)), [])
        assert.equal(progress.at(-1).candidateSpace, 1024)
        assert.equal(progress.at(-1).evaluated, 0)
        assert.equal(progress.at(-1).percent, 100)

        const expected = api.OptimizeSingleWasm.optimize(config, eligibleInventory)
        assert.equal(expected.length, 100)
        assert.deepEqual(optimizeWithCap(maxHp), expected)
    }
})

test('Vesna applies main stat filters after the same inventory checks with or without a panel cap', () => {
    const input = {...optimizer(fixture('Vesna')), filter: {head_main_stat: ['CriticalRate']}}
    const withCap = {...input, constraint: {...input.constraint, panel_max: {hp: 100000}}}
    for (const algorithm of ['AStar', 'Naive']) {
        const expected = api.OptimizeSingleWasm.optimize({...input, algorithm}, gear)
        assert.equal(expected.length, 1)
        assert.equal(expected[0].head, undefined)
        assert.deepEqual(api.OptimizeSingleWasm.optimize({...withCap, algorithm}, gear), expected)
    }
    const incomplete = gear.filter(artifact => artifact.slot !== 'Head')
    assert.throws(() => api.OptimizeSingleWasm.optimize(input, incomplete), /候选不足五个部位/)
    assert.throws(() => api.OptimizeSingleWasm.optimize(withCap, incomplete), /候选不足五个部位/)
})

test('impossible attack and buffed HP caps skip all 1024 complete panels in both search paths', () => {
    const inventory = gear.flatMap((piece, slot) => Array.from({length: 4}, (_, i) => ({
        ...piece, id: slot * 4 + i + 1, sub_stats: [['ATKFixed', i + 1]],
    })))
    const inventoryPieces = new Set(inventory)
    for (const [panel_max, buffs, minimums] of [
        [{atk: 1}, [], {}],
        [{hp: 1}, [named('ATKFixed', {value: 500})], {}],
        [{hp: 30000}, [], {hp_min: 31000}],
    ]) {
        const input = {...optimizer(fixture('Kaeya', 'MaxATK')), buffs,
            constraint: {set_mode: 'Any', ...minimums, panel_max}}
        const progress = []
        assert.deepEqual(api.OptimizeSingleWasm.optimize(input, inventory, event => progress.push(event)), [])
        assert.equal(progress.at(-1).candidateSpace, 1024)
        assert.equal(progress.at(-1).evaluated, 0)
        assert.equal(progress.at(-1).percent, 100)

        let completePanels = 0
        const counted = {...api, CommonInterface: {get_attribute(config) {
            if (config.artifacts.some(a => inventoryPieces.has(a))) completePanels++
            return api.CommonInterface.get_attribute(config)
        }}}
        assert.deepEqual(searchSegmentBuilds(counted, input, inventory, () => 1), [])
        assert.equal(completePanels, 0)
    }
})

test('an impossible cap preserves errors for unsupported Vesna inventory', () => {
    const input = optimizer(fixture('Vesna'))
    const inventory = gear.map(piece => ({...piece, set_name: 'CelestialGift'}))
    assert.throws(() => api.OptimizeSingleWasm.optimize(input, inventory), /可成套圣遗物/)
    const capped = {...input, constraint: {...input.constraint, panel_max: {hp: 1}}}
    assert.throws(() => api.OptimizeSingleWasm.optimize(capped, inventory), /可成套圣遗物/)
})

test('Heuristic can omit a flower before testing the HP cap', () => {
    const inventory = gear.map(piece => ({...piece, sub_stats: piece.slot === 'Flower' ? [] :
        [['ATKPercentage', .1], ['CriticalRate', .1], ['CriticalDamage', .2]]}))
    const input = {...optimizer(fixture('Escoffier')), algorithm: 'Heuristic'}
    const expected = api.OptimizeSingleWasm.optimize(input, inventory)
    assert.equal(expected.length, 1)
    assert.equal(expected[0].flower, undefined)

    const hp = readPanel(api, input, inventory.slice(1)).hp
    assert.ok(readPanel(api, input, inventory).hp > hp)
    assert.deepEqual(api.OptimizeSingleWasm.optimize({
        ...input, constraint: {...input.constraint, panel_max: {hp}},
    }, inventory), expected)
})
