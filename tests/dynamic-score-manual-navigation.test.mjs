import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {ref,computed,watch,reactive,nextTick,effectScope} from 'vue'
import {createScoreWorkerClient} from '../src/algorithms/artifact-score/worker-client.mjs'

const input = id => ({character:{name:'synthetic'},weapon:{name:'fixture',refine:1},artifacts:[{id}],buffs:[],skill:{index:0}})
function workerHarness() {
    const workers=[],sent=[]
    const makeWorker=()=>{
        const worker={
            postMessage(data){this.data=data;sent.push(data)},
            respond(){this.onmessage({data:{id:this.data.id,type:'result',result:{qualityTotal:this.data.request.input.artifacts[0].id,timing:{totalMs:10},rows:[]}}})},
            terminate(){this.terminated=true},
        }
        workers.push(worker)
        return worker
    }
    return {workers,sent,makeWorker}
}

test('reading cached scores never starts work and retains 100 candidate results',async()=>{
    const h=workerHarness(),client=createScoreWorkerClient(h.makeWorker)
    const request=id=>({input:input(id),basis:'A',objective:{kind:'skill',reaction:'normal'},constraints:{}})
    assert.equal(client.getCachedResult(request(1)),undefined)
    assert.equal(h.workers.length,0)
    for(let id=1;id<=100;id++){
        const task=client.run(request(id));h.workers[0].respond();await task
    }
    for(let id=1;id<=100;id++){
        const cached=client.getCachedResult(request(id))
        assert.equal(cached.qualityTotal,id)
        assert.equal(cached.timing.resultCacheHit,true)
    }
    assert.equal(h.sent.length,100)
    const changed=request(1);changed.input.weapon.refine=2
    assert.equal(client.getCachedResult(changed),undefined)
    const cached=client.getCachedResult(request(1));cached.qualityTotal=999
    assert.equal(client.getCachedResult(request(1)).qualityTotal,1)
    client.clear()
    assert.equal(client.getCachedResult(request(1)),undefined)
    assert.equal(h.sent.length,100)
})

test('score controller restores matching results on navigation, without computing misses',async()=>{
    const source=fs.readFileSync('src/components/display/DynamicArtifactScore.vue','utf8')
        .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'')
        .replace('import.meta.url',"'file:///synthetic/score.vue'")
    const props=reactive({input:input(11),analysis:{},infusion:'None',constraints:{},accountId:1})
    const h=workerHarness(),events=[],scope=effectScope();let exposed,unmount
    const env={ref,computed,watch,URL,defineProps:()=>props,defineEmits:()=>((name,value)=>events.push([name,value])),
        defineExpose:value=>{exposed=value},onBeforeUnmount:callback=>{unmount=callback},
        createScoreWorkerClient:()=>createScoreWorkerClient(h.makeWorker),
        defaultDamageReaction:()=> 'normal',damageReactionOptions:()=>[],sets:{},recordUsage:()=>{}}
    scope.run(()=>vm.runInNewContext(source,env))
    const latest=()=>events.filter(([name])=>name==='result').at(-1)?.[1]
    const run=()=>{const task=exposed.start();h.workers.at(-1).respond();return task}
    try {
        assert.equal(h.sent.length,0)
        await run();assert.equal(latest().qualityTotal,11)
        props.input=input(22);await nextTick()
        assert.equal(latest(),null);assert.equal(h.sent.length,1)
        props.input=input(11);await nextTick()
        assert.equal(latest().qualityTotal,11);assert.equal(latest().timing.resultCacheHit,true)
        assert.equal(h.sent.length,1)
        props.input=input(22);await nextTick();await run()
        props.input=input(11);await nextTick();assert.equal(latest().qualityTotal,11)
        props.input=input(22);await nextTick();assert.equal(latest().qualityTotal,22)
        assert.equal(h.sent.length,2)
        props.input.weapon.refine=2;await nextTick();assert.equal(latest(),null)
        props.input.weapon.refine=1;await nextTick();assert.equal(latest().qualityTotal,22)
        props.input=input(33);await nextTick()
        const pending=exposed.start(),oldWorker=h.workers.at(-1)
        props.input=input(11);await nextTick();oldWorker.respond();await pending
        assert.equal(oldWorker.terminated,true);assert.equal(latest().qualityTotal,11)
        props.accountId=2;await nextTick();assert.equal(latest(),null)
        props.input=input(22);await nextTick();assert.equal(latest(),null)
        assert.equal(h.sent.length,3)
    } finally {unmount();scope.stop()}
})

test('applying a candidate changes its equipment without requesting a new score',async()=>{
    const source=fs.readFileSync('src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue','utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    const parsed=ts.createSourceFile('calculator.ts',source,ts.ScriptTarget.Latest,true)
    const fn=parsed.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='handleUseNthOptimizationResult')
    let calls=0
    const env={optimizationResults:ref(Array.from({length:100},(_,i)=>({flower:i+1,feather:null,sand:null,goblet:null,head:null}))),
        artifactIds:ref([]),optimizationResultIndex:ref(0),panelResultSnapshot:ref(null),nextTick,
        recordComparisonHistory:()=>{},useNewScore:ref(true),dynamicScoreController:ref({start(){calls++}})}
    vm.runInNewContext(ts.transpileModule(fn.getText(parsed)+'\nglobalThis.select=handleUseNthOptimizationResult',{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,env)
    for(const index of [1,2,100,99,1]){await env.select(index);assert.equal(env.artifactIds.value[0],index);assert.equal(env.optimizationResultIndex.value,index)}
    assert.equal(calls,0)
})
