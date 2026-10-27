import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import TreeStore from 'element-plus/es/components/tree/src/model/tree-store.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript'), vue = require('vue')

test('filter group avatars require five existing artifact IDs and react to warehouse deletion', () => {
    const source = fs.readFileSync(new URL('../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue', import.meta.url), 'utf8')
    const computedSource = source.slice(source.indexOf('const filterKumiTreeData ='), source.indexOf('function filterKumiNode'))
    const code = ts.transpileModule(computedSource + '\nexports.filterKumiTreeData = filterKumiTreeData', {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const groups = [
        { id: 1, artifactIds: [] },
        { id: 2, artifactIds: [1, 2, 3, 4] },
        { id: 3, artifactIds: [1, 2, 3, 4, 5] },
        { id: 4, artifactIds: [1, 2, 3, 4, null] },
        { id: 5, artifactIds: [1, 2, 3, 4, -1] },
        { id: 6, artifactIds: [1, 2, 3, 4, 5, 6] },
        { id: 7, artifactIds: [1, 2, 3, 4, 6] },
    ]
    const preset = (name, ids) => ({ item: { character: { name }, artifactIds: ids } })
    const artifacts = vue.ref(new Map([1, 2, 3, 4, 5].map(id => [id, { id }])))
    const page = {}
    vm.runInNewContext(code, {
        exports: page, computed: vue.computed, artifactStore: { artifacts },
        kumiTreeDataForElementUI: vue.ref([{ id: 100, label: '合成收藏夹', children: groups.map(group => ({ id: group.id, label: String(group.id) })) }]),
        kumiStore: { kumiById: vue.ref(new Map(groups.map(group => [group.id, group]))) },
        presetStore: { allFlat: vue.ref([
            preset('Mona', [1, 2, 3, 4, 5]), preset('Amber', [1, 2, 3, 4, 5]),
            preset('Mona', [1, 2, 3, 4, 5]), preset('Zhongli', [1, 2, 4, 3, 5]),
            preset('Zhongli', [1, 2, 3, 4]),
        ]) },
        scoreCharacters: Object.fromEntries(['Mona', 'Amber', 'Zhongli'].map(name => [name, { nameLocale: name, avatar: `${name}.png` }])),
        ta: value => value,
    })
    const names = id => Array.from(page.filterKumiTreeData.value[0].children.find(group => group.id === id).characters, character => character.name)
    for (const id of [1, 2, 4, 5, 6, 7]) assert.deepEqual(names(id), [], `invalid group ${id} has no avatar`)
    assert.deepEqual(names(3), ['Mona', 'Amber'])
    // Only the reactive warehouse changes: stale group/preset IDs must not retain avatars.
    artifacts.value.delete(5)
    assert.deepEqual(names(3), [])
    artifacts.value.set(5, { id: 5 })
    assert.deepEqual(names(3), ['Mona', 'Amber'])
})

test('filter tree search retains checks, sorts names, identifies exact preset gear and preserves current gear within other constraints', () => {
    const source = fs.readFileSync(new URL('../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue', import.meta.url), 'utf8')
        .match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1]
    const names = ['filterKumiSearch', 'filteredKumiIds', 'kumiTreeDataForElementUI', 'filterKumiTreeData',
        'filterKumiNode', 'handleFilterKumiCheck', 'getAllArtifactsFiltered']
    const ast = ts.createSourceFile('page.ts', source, ts.ScriptTarget.Latest, true)
    const picked = ast.statements.filter(statement => ts.isFunctionDeclaration(statement)
        ? names.includes(statement.name?.text) : ts.isVariableStatement(statement)
            && statement.declarationList.declarations.some(declaration => names.includes(declaration.name.getText(ast))))
        .map(statement => statement.getText(ast)).join('\n')
    const code = ts.transpileModule(picked + '\nObject.assign(exports, {' + names.join(',') + '})', {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const gear = start => Array.from({ length: 5 }, (_, index) => start + index)
    const kumis = [
        { id: 100, title: '收藏夹', dir: true, children: [103, 102, 101, 104, 105] },
        { id: 200, title: '备用', dir: true, children: [201] },
        { id: 101, title: '安柏', artifactIds: gear(11) },
        { id: 102, title: '莫娜', artifactIds: gear(1) },
        { id: 103, title: '钟离', artifactIds: gear(6) },
        // A title alone does not associate a group with a character.
        { id: 104, title: '莫娜备用', artifactIds: gear(16) },
        { id: 105, title: '空位组', artifactIds: [1, null, null, null, null] },
        { id: 201, title: '混用方案', artifactIds: gear(21) },
    ]
    const preset = (name, ids) => ({ item: { character: { name }, artifactIds: ids } })
    const artifactStore = { artifacts: vue.ref(new Map(Array.from({ length: 30 }, (_, index) => {
        const id = index + 1
        return [id, { id, omit: false, position: ['flower', 'feather', 'sand', 'cup', 'head'][index % 5],
            mainTag: { name: 'lifePercentage' } }]
    }))) }
    const globals = {
        ...vue, artifactStore,
        kumiStore: { dirs: vue.ref(kumis.filter(item => item.dir)), kumiById: vue.ref(new Map(kumis.map(item => [item.id, item]))) },
        presetStore: { allFlat: vue.ref([preset('Mona', gear(1)), preset('Zhongli', gear(6)), preset('Amber', gear(11)),
            preset('Amber', gear(21)), preset('Mona', gear(21))]) },
        scoreCharacters: { Mona: { nameLocale: '莫娜', avatar: 'mona.png' },
            Zhongli: { nameLocale: '钟离', avatar: 'zhongli.png' }, Amber: { nameLocale: '安柏', avatar: 'amber.png' } },
        ta: value => value,
        artifactIds: vue.ref(gear(1)),
        allowBorrowEquipped: vue.ref(false), reservedArtifactIds: vue.ref(gear(6)), selectedTeamArtifactIds: vue.ref([]),
        constraintSandMainStats: vue.ref([]), constraintGobletMainStats: vue.ref([]), constraintHeadMainStats: vue.ref([]),
    }
    const page = {}
    vm.runInNewContext(code, { exports: page, ...globals })
    const plain = value => JSON.parse(JSON.stringify(value))
    const original = plain(page.kumiTreeDataForElementUI.value)
    const tree = new TreeStore({ data: page.filterKumiTreeData.value, key: 'id',
        props: { label: 'label', children: 'children' }, checkStrictly: false, checkDescendants: false,
        filterNodeMethod: page.filterKumiNode })
    tree.initialize()
    assert.deepEqual(plain(page.filterKumiTreeData.value.map(dir => dir.label)), ['备用', '收藏夹'])
    assert.deepEqual(plain(page.filterKumiTreeData.value[1].children.map(node => node.label)), ['安柏', '空位组', '莫娜', '莫娜备用', '钟离'])
    assert.deepEqual(plain(tree.getNode(102).data.characters), [{ name: 'Mona', label: '莫娜', avatar: 'mona.png' }])
    assert.equal(tree.getNode(104).data.characters.length, 0)
    assert.equal(tree.getNode(105).data.characters.length, 0)
    assert.deepEqual(plain(tree.getNode(201).data.characters.map(character => character.name)), ['Amber', 'Mona'])
    assert.deepEqual(plain(page.kumiTreeDataForElementUI.value), original)

    function check(id) {
        tree.getNode(id).setChecked(true, true)
        page.handleFilterKumiCheck(tree.getNode(id).data, { checkedNodes: tree.getCheckedNodes() })
        tree.setDefaultCheckedKey(page.filteredKumiIds.value)
    }
    check(100)
    const checked = [...tree.getCheckedKeys(true)]
    tree.filter('莫娜')
    assert.equal(tree.getNode(102).visible, true)
    assert.equal(tree.getNode(103).visible, false)
    assert.equal(tree.getNode(201).visible, true)
    assert.deepEqual(tree.getCheckedKeys(true), checked)
    tree.filter('收藏夹')
    assert.equal(tree.getNode(103).visible, true)
    assert.equal(tree.getNode(201).visible, false)
    tree.filter('mona')
    assert.equal(tree.getNode(102).visible, true)
    tree.filter('')
    assert.equal(tree.getNode(103).visible, true)
    globals.presetStore.allFlat.value.push(preset('Zhongli', gear(16)))
    tree.setData(page.filterKumiTreeData.value)
    assert.deepEqual(tree.getCheckedKeys(true), checked)

    const candidateIds = () => plain(page.getAllArtifactsFiltered().map(artifact => artifact.id))
    assert.deepEqual(candidateIds(), [...gear(1), ...gear(21), ...gear(26)])
    globals.allowBorrowEquipped.value = true
    // Group exclusion still applies to other characters even when borrowing is enabled.
    assert.deepEqual(candidateIds(), [...gear(1), ...gear(21), ...gear(26)])
    globals.allowBorrowEquipped.value = false
    globals.selectedTeamArtifactIds.value = [1]
    globals.reservedArtifactIds.value.push(2)
    artifactStore.artifacts.value.get(4).omit = true
    globals.constraintSandMainStats.value = ['attackPercentage']
    // Current IDs are preserved only from group exclusion: occupation, locks and main stats retain priority.
    assert.deepEqual(candidateIds(), [5, 21, 22, 24, 25, 26, 27, 29, 30])
    globals.artifactIds.value = gear(11)
    globals.constraintSandMainStats.value = []
    assert.deepEqual(candidateIds(), [...gear(11), ...gear(21), ...gear(26)])
})
