<template>
  <template v-if="integrated">
    <el-dialog v-model="settingsOpen" title="评分设置" width="min(540px, 94vw)" class="score-settings-dialog">
      <div class="controls">
      <label>评价基准<select v-model="basis" aria-label="动态评分基准"><option value="A">A · 固定主词条与套装</option><option value="B">B · 主词条与套装可变</option></select></label>
      <label>伤害目标<select v-model="target" aria-label="动态评分目标"><option v-for="item in reactions" :key="item.key" :value="item.key">{{ item.label }} · 当前技能期望</option><option v-if="input.target_function?.use_dsl" value="dsl">MONA-DSL · result</option></select></label>
    </div>
      <template #footer><el-button type="primary" @click="settingsOpen=false">完成</el-button></template>
    </el-dialog>
    <el-dialog v-model="basisOpen" title="评分依据" width="min(1100px, 96vw)" top="5vh" class="score-basis-dialog">
      <dynamic-artifact-score-result v-if="result" :result="result" :character-label="characterLabel" :weapon-label="weaponLabel" :skill-label="skillLabel" :selected-slot="selectedSlot" @inspect="inspect" />
      <template #footer><el-button @click="basisOpen=false">关闭</el-button></template>
    </el-dialog>
  </template>
  <section v-else class="dynamic-score" aria-label="动态伤害评分">
    <header><h3>动态伤害评分</h3><button type="button" @click="emit('close')">返回喵喵评分</button></header>
    <div class="controls">
      <label>评价基准<select v-model="basis" aria-label="动态评分基准"><option value="A">A · 固定主词条与套装</option><option value="B">B · 主词条与套装可变</option></select></label>
      <label>伤害目标<select v-model="target" aria-label="动态评分目标"><option v-for="item in reactions" :key="item.key" :value="item.key">{{ item.label }} · 当前技能期望</option><option v-if="input.target_function?.use_dsl" value="dsl">MONA-DSL · result</option></select></label>
    </div>
    <div class="controls"><button v-if="!running" type="button" :disabled="!target" @click="start">{{ result ? '重新计算评分' : '计算动态评分' }}</button><button v-else type="button" @click="cancel">取消评分</button></div>
    <p class="status" role="status">{{ status }}</p><pre v-if="error" class="error" role="alert">{{ error }}</pre>
    <dynamic-artifact-score-result v-if="result" :result="result" :character-label="characterLabel" :weapon-label="weaponLabel" :skill-label="skillLabel" :selected-slot="selectedSlot" @inspect="emit('inspect',$event)" />
  </section>
</template>
<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {createScoreWorkerClient} from '@/algorithms/artifact-score/worker-client.mjs'
import {recordUsage} from '@/usage-stats/index.mjs'
import {damageReactionOptions,defaultDamageReaction} from '@/algorithms/reaction-labels.mjs'
import sets from '@/assets/_gen_artifact'
import DynamicArtifactScoreResult from './DynamicArtifactScoreResult.vue'
const props=defineProps({integrated:Boolean,input:Object,analysis:Object,infusion:String,constraints:Object,accountId:Number,characterLabel:String,weaponLabel:String,skillLabel:String,selectedSlot:Number})
const emit=defineEmits(['result','close','inspect','state'])
const basis=ref('A'),target=ref(props.input.target_function?.use_dsl?'dsl':defaultDamageReaction(props.analysis||{}))
const result=ref(null),running=ref(false),error=ref(''),status=ref('准备计算')
const reactions=computed(()=>damageReactionOptions(props.analysis||{}))
const client=createScoreWorkerClient(()=>new Worker(new URL('../../workers/dynamic_score.worker.js',import.meta.url)))
let generation=0
const settingsOpen=ref(false),basisOpen=ref(false)
watch([running,status,error],()=>emit('state',{running:running.value,status:status.value,error:error.value}),{flush:'sync',immediate:true})
function inspect(index){basisOpen.value=false;emit('inspect',index)}
defineExpose({start,cancel,openSettings:()=>{settingsOpen.value=true},openBasis:()=>{if(result.value)basisOpen.value=true}})
function invalidate(){basisOpen.value=false;generation++;client.cancel();running.value=false;result.value=null;error.value='';status.value='计算条件已变更';emit('result',null)}
watch(()=>[props.input,props.infusion,props.constraints,props.accountId,basis.value,target.value],invalidate,{deep:true,flush:'sync'})
watch(()=>JSON.stringify([props.input.character.name,props.input.skill,props.input.target_function,props.analysis?.is_heal]),()=>{target.value=props.input.target_function?.use_dsl?'dsl':defaultDamageReaction(props.analysis||{})})
watch(()=>props.accountId,()=>client.clear())
async function start(){
  error.value='';running.value=true;status.value='载入评分核心…';const token=++generation
  const request=JSON.parse(JSON.stringify({input:props.input,basis:basis.value,objective:target.value==='dsl'?{kind:'dsl'}:{kind:'skill',reaction:target.value,infusion:props.infusion},constraints:props.constraints,
    sets:Object.values(sets).filter(s=>s.maxStar===5&&['flower','feather','sand','cup','head'].every(k=>s[k])).map(s=>s.name2)}))
  try {const value=await client.run(request,p=>{if(token===generation)status.value=p.stage==='reference'?`求解参照 · 起点 ${p.start}/${p.starts} · 第 ${p.pass} 轮`:`计算单件替换 · ${p.slot}/5`})
    if(token!==generation)return;result.value=value;emit('result',value);status.value='计算完成';recordUsage('action.dynamic-artifact-score');return value
  }catch(e){if(token!==generation||e.name==='AbortError')return;error.value=e.message;status.value='计算失败'}
  finally{if(token===generation)running.value=false}
}
function cancel(){invalidate();status.value='已取消评分'}
onBeforeUnmount(()=>{generation++;client.clear();emit('result',null);emit('state',{running:false,status:'准备计算',error:''})})
</script>
<style scoped>
.dynamic-score{scroll-margin-top:100px;margin:20px 0;padding:20px;background:var(--el-bg-color);border:1px solid var(--el-border-color);border-radius:8px;color:var(--el-text-color-primary)}
header{display:flex;align-items:center;justify-content:space-between;gap:16px}h3{margin:0;font-size:18px}
.controls{display:flex;align-items:end;flex-wrap:wrap;gap:16px;margin-top:18px}label{display:grid;gap:6px;font-size:13px}
select,button{font:inherit;color:inherit;border:1px solid var(--el-border-color);background:var(--el-bg-color);border-radius:4px;padding:8px 12px}
button{cursor:pointer}button:hover{color:var(--el-color-primary);border-color:var(--el-color-primary)}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
.status{font-size:13px;color:var(--el-text-color-secondary)}.error{color:var(--el-color-danger);white-space:pre-wrap}
@media(max-width:600px){.dynamic-score{padding:14px}.controls{display:grid;grid-template-columns:1fr}select{width:100%}}
</style>
