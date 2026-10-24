<template>
 <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" title="圣遗物搭配结果" width="94%" destroy-on-close>
  <div class="result-skill"><span>当前技能：{{ skillLabel }}</span><span>共 {{ results.length }} 套</span></div>
  <div class="result-sort">
   <el-select v-if="reactionOptions.length > 1" v-model="sortReaction" class="result-reaction" aria-label="排序伤害类型">
    <el-option v-for="key in reactionOptions" :key="key" :label="damageReactionLabel(key)" :value="key" />
   </el-select>
   <el-radio-group v-model="sortMetric" aria-label="伤害排序" class="result-sort-metric">
    <el-radio-button label="expectation">期望伤害</el-radio-button>
    <el-radio-button label="critical">暴击伤害</el-radio-button>
    <el-radio-button label="non_critical">非暴击伤害</el-radio-button>
   </el-radio-group>
   <el-radio-group v-model="sortDirection" aria-label="排序方向" class="result-sort-direction">
    <el-radio-button label="desc">从高到低</el-radio-button>
    <el-radio-button label="asc">从低到高</el-radio-button>
   </el-radio-group>
  </div>
  <el-scrollbar ref="scrollbar" height="70vh" @scroll="loadMore">
   <article v-for="row in rows" :key="row.originalIndex" class="build-result" :class="{'is-selected': selectedIndex === row.originalIndex + 1}" :data-result-index="row.originalIndex + 1" role="button" tabindex="0" :aria-label="`切换到第 ${row.originalIndex + 1} 套`" :aria-pressed="selectedIndex === row.originalIndex + 1" @click="selectBuild(row)" @keydown.enter.self.prevent="selectBuild(row)" @keydown.space.self.prevent="selectBuild(row)">
    <h3>第 {{ row.originalIndex + 1 }} 套 <span v-if="selectedIndex === row.originalIndex + 1" class="selected-label">当前使用</span></h3>
    <div class="result-artifacts"><template v-for="(item,slot) in row.items" :key="slot"><artifact-display v-if="item" :item="item" /><div v-else class="empty-slot">未装备</div></template></div>
    <el-alert v-if="row.error" :title="row.error" type="error" :closable="false" />
    <template v-else><damage-panel :analysis-from-wasm="row.analysis" /><div class="result-stats"><span v-for="stat in row.attributes" :key="stat.key">{{stat.label}} <b>{{stat.percent?(stat.value*100).toFixed(1)+'%':stat.value.toFixed(1)}}</b></span></div></template>
   </article>
  </el-scrollbar>
 </el-dialog>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import ArtifactDisplay from '@/components/display/ArtifactDisplay.vue'
import DamagePanel from './DamagePanel.vue'
import {convertArtifact} from '@/utils/converter'
import {resultDamagePreview} from '@/algorithms/optimization-results.mjs'
import {visibleDamageReactionKeys, defaultDamageReaction, damageReactionLabel} from '@/algorithms/reaction-labels.mjs'
import characters from '@/assets/_gen_character'
import {useI18n} from '@/i18n/i18n'

const props=defineProps({modelValue:Boolean,results:Array,input:Object,infusion:String,mona:Object,getArtifact:Function,selectedIndex:Number})
const emit=defineEmits(['update:modelValue','select'])
const {ta}=useI18n(),scrollbar=ref(),limit=ref(8)
const sortMetric=ref('expectation'),sortDirection=ref('desc'),requestedReaction=ref('')
const skillLabel=computed(()=>{
 const c=characters[props.input.character.name]
 const skill=[...c.skillMap1,...c.skillMap2,...c.skillMap3].find(s=>s.index===props.input.skill.index)
 return skill?ta(skill.text):''
})
// Compute every retained build before sorting; scrolling only limits rendering.
const allRows=computed(()=>!props.modelValue?[]:props.results.map((result,originalIndex)=>{
 const items=['flower','feather','sand','goblet','head'].map(k=>result[k]==null?null:props.getArtifact(result[k]))
 try{return {originalIndex,items,...resultDamagePreview(props.mona,props.input,items.filter(Boolean).map(convertArtifact),props.infusion)}}
 catch(error){return {originalIndex,items,error:error.message||String(error)}}
}))
const reactionOptions=computed(()=>[...new Set(allRows.value.flatMap(row=>visibleDamageReactionKeys(row.analysis)))])
const sortReaction=computed({
 get:()=>reactionOptions.value.includes(requestedReaction.value)?requestedReaction.value:defaultDamageReaction(allRows.value.find(row=>!row.error)?.analysis),
 set:value=>{requestedReaction.value=value}
})
const sortedRows=computed(()=>[...allRows.value].sort((a,b)=>{
 const av=a.analysis?.[sortReaction.value]?.[sortMetric.value],bv=b.analysis?.[sortReaction.value]?.[sortMetric.value]
 // Keep actual calculation errors visible, after the sortable results.
 if(!Number.isFinite(av))return Number.isFinite(bv)?1:a.originalIndex-b.originalIndex
 if(!Number.isFinite(bv))return -1
 return (sortDirection.value==='desc'?bv-av:av-bv)||a.originalIndex-b.originalIndex
}))
const rows=computed(()=>sortedRows.value.slice(0,limit.value))
function selectBuild(row){emit('select',row.originalIndex+1);emit('update:modelValue',false)}
function loadMore({scrollTop}){
 const wrap=scrollbar.value?.wrap$
 if(wrap&&scrollTop+wrap.clientHeight>=wrap.scrollHeight-500)limit.value=Math.min(props.results.length,limit.value+8)
}
watch(()=>[props.modelValue,props.results,props.input.skill,props.infusion,sortMetric.value,sortDirection.value,sortReaction.value],()=>{
 limit.value=8
 scrollbar.value?.setScrollTop(0)
})
</script>
<style scoped>
.result-skill{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}
.result-sort{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
.result-reaction{width:190px}
.build-result{border:1px solid var(--el-border-color-light);border-radius:8px;padding:14px;margin:0 10px 18px 0;cursor:pointer}
.build-result:hover,.build-result:focus-visible,.build-result.is-selected{border-color:var(--el-color-primary)}
.build-result:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:1px}
.build-result h3{margin:0 0 12px}
.selected-label{margin-left:12px;font-size:12px;font-weight:normal;color:var(--el-color-primary)}
.result-artifacts{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:10px;overflow-x:auto}
.result-stats{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px}
.result-stats b{margin-left:5px;color:var(--el-color-primary)}
.empty-slot{min-height:80px;display:grid;place-items:center;background:var(--el-fill-color-light)}
@media(max-width:700px){.result-artifacts{grid-template-columns:repeat(5,190px)}.build-result{padding:10px}.result-skill{flex-wrap:wrap}}
</style>
