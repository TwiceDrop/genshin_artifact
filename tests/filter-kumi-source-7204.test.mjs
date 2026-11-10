import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import {artifactGroupCharacterNames} from '../src/algorithms/artifact-ownership.mjs'
const require=createRequire(import.meta.url),ts=require('typescript'),vue=require('vue')
const pageUrl=new URL('../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue',import.meta.url)
function functions(url,names,globals){
    const source=fs.readFileSync(url,'utf8'),ast=ts.createSourceFile('source.ts',source.includes('<script setup')?source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1]:source,ts.ScriptTarget.Latest,true)
    const picked=[]
    function visit(node){if(ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))picked.push(node.getText(ast));else ts.forEachChild(node,visit)}
    visit(ast)
    assert.equal(picked.length,names.length)
    const code=ts.transpileModule(picked.join('\n')+'\nObject.assign(exports,{'+names.join(',')+'})',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
    const exports={};vm.runInNewContext(code,{exports,...globals});return exports
}
const plain=value=>JSON.parse(JSON.stringify(value))
test('selected groups honor known sources, legacy exact matches, ambiguity and overlapping exclusions',()=>{
    const ids=[1,2,3,4,5],inventory=new Map(ids.map((id,i)=>[id,{id,omit:false,position:['flower','feather','sand','cup','head'][i],mainTag:{name:'lifePercentage'}}]))
    const group={id:10,title:'任意名字',artifactIds:ids,sourceCharacter:'Klee'}
    const groups=new Map([[10,group]])
    const presets=[{item:{character:{name:'Klee'},artifactIds:ids}}]
    const state={artifactGroupCharacterNames,artifactStore:{artifacts:vue.ref(inventory)},kumiStore:{kumiById:vue.ref(groups)},presetStore:{allFlat:vue.ref(presets)},characterName:vue.ref('Klee'),artifactIds:vue.ref(ids),filteredKumiIds:vue.ref([10]),allowBorrowEquipped:vue.ref(true),reservedArtifactIds:vue.ref([]),selectedTeamArtifactIds:vue.ref([]),constraintSandMainStats:vue.ref([]),constraintGobletMainStats:vue.ref([]),constraintHeadMainStats:vue.ref([])}
    const page=functions(pageUrl,['getAllArtifactsFiltered'],state),candidateIds=()=>plain(page.getAllArtifactsFiltered().map(a=>a.id))
    assert.deepEqual(candidateIds(),ids)
    state.characterName.value='Mona'
    assert.deepEqual(candidateIds(),[],'switching character must exclude the unchanged five slots')
    assert.deepEqual(plain(state.artifactIds.value),ids)
    state.characterName.value='Klee'
    assert.deepEqual(candidateIds(),ids,'switching back restores only the source character exemption')
    delete state.kumiStore.kumiById.value.get(10).sourceCharacter
    assert.deepEqual(candidateIds(),ids,'legacy complete exact preset identifies source')
    state.presetStore.allFlat.value.push({item:{character:{name:'Mona'},artifactIds:ids}})
    assert.deepEqual(candidateIds(),[],'ambiguous legacy source does not bypass exclusion')
    state.presetStore.allFlat.value=[]
    state.kumiStore.kumiById.value.get(10).title='可莉'
    assert.deepEqual(candidateIds(),[],'title is not role provenance')
    state.kumiStore.kumiById.value.get(10).sourceCharacter='Klee'
    assert.deepEqual(candidateIds(),ids,'new saved group needs no matching preset')
    state.kumiStore.kumiById.value.set(11,{id:11,artifactIds:[1,null,null,null,null],sourceCharacter:'Mona'})
    state.filteredKumiIds.value=[10,11]
    assert.deepEqual(candidateIds(),[2,3,4,5],'another filtered source wins on shared equipment')
    state.filteredKumiIds.value=[]
    assert.deepEqual(candidateIds(),ids,'unchecking actually restores candidates')
})
test('clear selected removes snapshot equipment without altering inventory, groups or settings',()=>{
    const inventory=new Map([[1,{id:1,omit:true}]]),groups=[{id:10,sourceCharacter:'Klee',artifactIds:[1,2,3,4,5]}]
    const before=plain([...inventory]),groupBefore=plain(groups)
    const {use5Artifacts}=functions(new URL('../src/composables/artifact.ts',import.meta.url),['use5Artifacts'],{...vue,useI18n:()=>({t:x=>x,ta:x=>x}),useArtifactStore:()=>({artifacts:vue.ref(inventory)}),newDefaultArtifactConfigForWasm:()=>({example:{value:3}})})
    const gear=use5Artifacts()
    gear.artifactIds.value=[1,2,3,4,5];gear.artifactSnapshot.value={1:{id:1}}
    gear.clearArtifacts()
    assert.deepEqual(plain(gear.artifactIds.value),[-1,-1,-1,-1,-1])
    assert.equal(gear.artifactSnapshot.value,null);assert.equal(gear.artifactCount.value,0)
    assert.deepEqual(plain(gear.artifactSingleConfig.value),{example:{value:3}})
    assert.deepEqual(plain([...inventory]),before);assert.deepEqual(plain(groups),groupBefore)
})
test('saving a calculator group records source without requiring or changing a preset',()=>{
    const dir={id:0,dir:true,children:[]},kumi=vue.ref([dir]),kumiById=vue.ref(new Map([[0,dir]]))
    const {createKumi}=functions(new URL('../src/store/pinia/kumi.ts',import.meta.url),['createKumi'],{kumi,kumiById,idGenerator:{generateId:()=>10}})
    const ids=[1,2,3,4,5],state={showSaveKumiDialog:vue.ref(true),characterName:vue.ref('Klee'),artifactIds:vue.ref(ids),kumiStore:{createKumi,addArtifact:(id,artifact)=>{kumiById.value.get(id).artifactIds[artifact-1]=artifact}}}
    functions(pageUrl,['handleSaveAsKumi'],state).handleSaveAsKumi({dirIds:[0],name:'随意名字'})
    const saved=plain(kumi.value).find(group=>group.id===10)
    assert.equal(saved.sourceCharacter,'Klee');assert.deepEqual(saved.artifactIds,ids)
    assert.deepEqual(artifactGroupCharacterNames(saved,[],new Map()),['Klee'])
    assert.equal(state.showSaveKumiDialog.value,false)
})
