import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { api, read } from './runtime-7106.mjs'
import { fixture } from './interface-audit-7108.mjs'
import { panelScoreAttributes, scoreBuild, scoreSetNames } from '../src/algorithms/artifact-score/score.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript'), vue = require('vue')
const artifactsData = read('src/assets/_gen_artifact.js')
function load(source, modules = {}, globals = {}) {
    const exports = {}
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    vm.runInNewContext(code, { exports, require: name => modules[name], ...vue, ...globals })
    return exports
}
function pick(source, names) {
    const ast = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true)
    return ast.statements.filter(s => ts.isFunctionDeclaration(s) ? names.includes(s.name?.text)
        : ts.isVariableStatement(s) && s.declarationList.declarations.some(d => names.includes(d.name.getText(ast))))
        .map(s => s.getText(ast)).join('\n')
}
const common = load(fs.readFileSync('src/utils/common.js', 'utf8'))
const converter = load(fs.readFileSync('src/utils/converter.ts', 'utf8'), { '@/assets/_gen_artifact': { default: artifactsData } })
const idProvider = load(fs.readFileSync('src/utils/idProvider.ts', 'utf8'))
const storeModule = load(fs.readFileSync('src/store/pinia/artifact.ts', 'utf8'), {
    vue, pinia: require('pinia'), '@/utils/idProvider': idProvider,
    '@/assets/artifacts': { artifactsData }, '@/utils/common': common
})
const defaults = load(pick(fs.readFileSync('src/utils/artifacts.ts', 'utf8'), ['newDefaultArtifactConfigForWasm']), {}, { artifactsData, ...common })
const composition = load(fs.readFileSync(process.argv.includes('--baseline')
    ? '../../v7.1.08/source-publish/src/composables/artifact.ts' : 'src/composables/artifact.ts', 'utf8'), {
    '@/store/pinia/artifact': storeModule, '@artifact': { artifactsData }, '@/utils/converter': converter,
    '@/utils/common': common, '@/utils/artifacts': defaults, '@/i18n/i18n': { useI18n: () => ({ t: x => x, ta: x => x }) }
})
const artifactStore = storeModule.useArtifactStore()
const syntheticArtifacts = ['flower', 'feather', 'sand', 'cup', 'head'].map((position, i) => ({
    id: i + 1, contentHash: `synthetic-lock-${i}`, position, setName: 'gladiatorFinale', level: 20, star: 5, omit: false,
    mainTag: i === 0 ? { name: 'lifeStatic', value: 4780 } : i === 1 ? { name: 'attackStatic', value: 311 }
        : i === 2 ? { name: 'elementalMastery', value: 187 } : i === 3 ? { name: 'fireBonus', value: .466 } : { name: 'critical', value: .311 },
    normalTags: [{ name: 'criticalDamage', value: .14 }, { name: 'attackPercentage', value: .058 },
        { name: 'recharge', value: .065 }, { name: 'elementalMastery', value: 23 }]
}))
const current = composition.use5Artifacts()
artifactStore.init(Object.fromEntries(syntheticArtifacts.map(a => [a.position, [structuredClone(a)]])))
current.artifactIds.value = [1, 2, 3, 4, 5]
const input = fixture('Klee')
const names = ['handleLockAll', 'handleUnlockAll', 'isAllLocked', 'getAllArtifactsFiltered',
    'getAttributeWasmInterface', 'attributeCalculation', 'attributeFromWasm', 'artifactScoreContext', 'artifactBuildScore',
    'damageAnalysisWasmInterface', 'damageCalculation', 'characterDamageAnalysis', 'bonusPerStatWasmInterface']
const pageSource = fs.readFileSync('src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue', 'utf8').match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1]
const page = load(pick(pageSource, names) + '\nObject.assign(exports, {' + names.join(',') + '})', {}, {
    ...current, artifactStore, mona: api, artifactsData, panelScoreAttributes, scoreBuild, scoreSetNames,
    scoreCharacters: read('src/assets/_gen_character.js'), scoreWeapons: read('src/assets/_gen_weapon.js'),
    scoreLocale: JSON.parse(fs.readFileSync('src/i18n/generated/zh-cn.json', 'utf8')),
    characterInterface: vue.ref(input.character), weaponInterface: vue.ref(input.weapon), characterSkillInterface: vue.ref(input.skill),
    characterName: vue.ref('Klee'), characterConstellation: vue.ref(0), characterConfig: vue.ref(input.character.params),
    weaponName: vue.ref(input.weapon.name), weaponRefine: vue.ref(1), effectiveBuffs: vue.ref([]), enemyInterface: vue.ref(null),
    targetFunctionInterface: vue.ref(input.target_function), teamContextSources: vue.ref([]), fumo: vue.ref('None'),
    filterKumiRef: vue.ref(null), allowBorrowEquipped: vue.ref(true), reservedArtifactIds: vue.ref([]), selectedTeamArtifactIds: vue.ref([]),
    constraintSandMainStats: vue.ref([]), constraintGobletMainStats: vue.ref([]), constraintHeadMainStats: vue.ref([])
})
const plain = value => JSON.parse(JSON.stringify(value))
function snapshot() {
    assert.equal(page.attributeCalculation.value.error, '')
    assert.equal(page.damageCalculation.value.error, '')
    return plain({ equipped: current.artifactWasmFormat.value.length, panel: page.attributeFromWasm.value,
        score: page.artifactBuildScore.value, damage: page.characterDamageAnalysis.value,
        bonus: api.BonusPerStat.bonus_per_stat(page.bonusPerStatWasmInterface.value) })
}
const before = snapshot()
page.handleLockAll()
const locked = snapshot()
assert.equal(page.isAllLocked.value, true)
assert.equal(page.getAllArtifactsFiltered().length, 0)
if (process.argv.includes('--baseline')) {
    assert.equal(locked.equipped, 0)
    assert.notEqual(before.score.total, locked.score.total)
} else {
    assert.deepEqual(locked, before)
}
page.handleUnlockAll()
assert.deepEqual(snapshot(), before)
assert.equal(page.getAllArtifactsFiltered().length, 5)
current.toggleArtifact(2)
if (!process.argv.includes('--baseline')) assert.deepEqual(snapshot(), before)
assert.equal(page.getAllArtifactsFiltered().length, 4)
current.toggleArtifact(2)
assert.deepEqual(snapshot(), before)
console.log('锁定／解锁全部及单件、候选排除：通过')
console.log(JSON.stringify({ before: { mastery: panelScoreAttributes(before.panel).mastery, total: before.score.total, title: before.score.title, pieces: before.score.artifacts },
    locked: { mastery: panelScoreAttributes(locked.panel).mastery, total: locked.score.total, title: locked.score.title, pieces: locked.score.artifacts } }))
if (!process.argv.includes('--baseline')) {
    for (const a of artifactStore.artifacts.value.values()) {
        a.normalTags = a.normalTags.filter(t => t.name !== 'elementalMastery')
        if (a.position === 'sand') a.mainTag = { name: 'attackPercentage', value: .466 }
    }
    const changed = snapshot()
    assert.equal(panelScoreAttributes(changed.panel).mastery, 0)
    assert.notEqual(changed.score.total, before.score.total)
    assert.match(changed.score.title, /纯火/)
    console.log('实际词条变化仍重算面板与条件评分：通过；得分 ' + changed.score.total)
}
