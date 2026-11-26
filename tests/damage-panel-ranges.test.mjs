import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import {computed, ref} from 'vue'
import {api} from '../beta-tools/runtime.mjs'
import {fixture, gear, optimizer} from '../beta-tools/interface-audit-7108.mjs'
import {PANEL_STATS, readPanel} from '../beta-data/panel-search.mjs'

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
            assert.equal(progress.at(-1).percent, 100)
            assert.equal(progress.at(-1).remainingGroups, 0)
        }
    }
})
