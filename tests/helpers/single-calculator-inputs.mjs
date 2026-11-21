import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {computed, ref} from 'vue'
import {singleSearchArtifactConfig} from '../../src/algorithms/single-artifact-effects.mjs'

// Run the page's input builders with the same Vue refs the controls edit.
export function singleCalculatorInputs(input, artifacts, artifactConfig, artifactEffectMode = ref('custom')) {
    const page = fs.readFileSync(new URL('../../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue', import.meta.url), 'utf8')
    const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    const ast = ts.createSourceFile('calculator.ts', script, ts.ScriptTarget.Latest, true)
    const builders = ast.statements.filter(node => ts.isFunctionDeclaration(node)
        ? ['getOptimizeArtifactWasmInterface','getPanelOptimizeInterface'].includes(node.name?.text)
        : ts.isVariableStatement(node) && node.declarationList.declarations.some(d =>
            ['searchArtifactConfig','damageAnalysisWasmInterface'].includes(d.name.getText(ast))))
    const body = builders.map(node => node.getText(ast)).join('\n') +
        '\n;({preview: damageAnalysisWasmInterface, optimize: getOptimizeArtifactWasmInterface, panel: getPanelOptimizeInterface})'
    const js = ts.transpileModule(body, {compilerOptions: {target: ts.ScriptTarget.ESNext}}).outputText
    return vm.runInNewContext(js, {
        computed, artifactConfig, artifactEffectMode, singleSearchArtifactConfig, characterName: ref(input.character?.name),
        constraintSetMode: ref({}), panelSearchOptions: ref({}), artifactWasmFormat: ref(artifacts), deepCopy: x => JSON.parse(JSON.stringify(x)),
        characterInterface: ref(input.character), characterSkillInterface: ref(input.skill),
        weaponInterface: ref(input.weapon), effectiveBuffs: ref(input.buffs), enemyInterface: ref(input.enemy),
        targetFunctionInterface: ref(input.target_function), constraintInterface: ref(input.constraint),
        algorithm: ref(input.algorithm), restoredTeamContext: ref(input.team_context), teamContextSources: ref([]),
        teamContextResult: ref({sources: input.sources || []}),
    })
}
