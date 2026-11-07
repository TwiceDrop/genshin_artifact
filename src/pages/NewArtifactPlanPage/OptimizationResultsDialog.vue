<template>
 <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" title="比较候选" width="min(1060px,96vw)" destroy-on-close>
  <div class="candidate-review">
   <div class="result-skill"><strong>{{ characterLabel }} · {{ skillLabel }}</strong><span>共 {{ results.length }} 套</span></div>
   <p class="candidate-context">优化目标：{{ objectiveLabel }} <span> / </span> 单段：{{ reactionLabel }} <template v-if="baselineAnalysis"> / 基准：{{ baselineLabel }}</template></p>
   <div class="result-sort">
    <label v-if="reactionOptions.length>1">伤害类型 <select v-model="sortReaction" aria-label="排序伤害类型"><option v-for="key in reactionOptions" :key="key" :value="key">{{ labelReaction(key) }}</option></select></label>
    <label>排序 <select v-model="sortMetric" aria-label="候选排序指标"><option v-for="[v,l] in sortOptions" :key="v" :value="v">{{ l }}</option></select></label>
    <label><select v-model="sortDirection" aria-label="排序方向"><option value="desc">从高到低</option><option value="asc">从低到高</option></select></label>
   </div>
   <el-scrollbar ref="scrollbar" height="min(58vh,530px)" @scroll="loadMore">
    <table class="candidate-table">
     <thead><tr><th>套次</th><th>优化目标值</th><th>单段{{ metricName }}</th><th>充能效率<small v-if="chargeMin>1">要求 ≥ {{ percent(chargeMin) }}</small></th><th class="detail-col">明细</th></tr></thead>
     <tbody><template v-for="row in rows" :key="row.originalIndex">
      <tr class="build-result" :class="{'is-selected':selectedIndex===row.originalIndex+1}" :data-result-index="row.originalIndex+1" @click="selectBuild(row)">
       <th><button type="button" class="select-build" @click.stop="selectBuild(row)" :aria-label="'切换到第 '+(row.originalIndex+1)+' 套'">第 {{ row.originalIndex+1 }} 套</button><small>{{ selectedIndex===row.originalIndex+1?'当前':'' }}</small></th>
       <td class="objective"><span>{{ displayScore(row.value) }}</span><small v-if="percentChange(row.value,objectiveBefore)">{{percentChange(row.value,objectiveBefore)}}</small></td>
       <td class="hit"><template v-if="!row.error">{{ rounded(row.analysis?.[sortReaction]?.[hitMetric]) }}<small v-if="hitGain(row)">{{hitGain(row)}}</small></template><span v-else>—</span></td>
       <td class="charge">{{percent(row.recharge)}}<small v-if="chargeMin>1 && Number.isFinite(row.recharge)" :class="row.recharge+1e-10>=chargeMin?'met':'unmet'">{{row.recharge+1e-10>=chargeMin?'达标':'未达标'}}</small></td>
       <td class="detail-col"><button type="button" class="detail-button" :aria-expanded="detailIndex===row.originalIndex" @click.stop="detailIndex=detailIndex===row.originalIndex?null:row.originalIndex">详情</button></td>
      </tr>
      <tr v-if="row.error"><td colspan="5" class="error">{{row.error}}</td></tr>
      <tr v-if="detailIndex===row.originalIndex&&detail"><td colspan="5">
       <div class="result-artifacts"><template v-for="(a,i) in row.items" :key="i"><artifact-display v-if="a" :item="a"/><span v-else>未装备</span></template></div>
       <p v-if="detail.error" class="error">{{detail.error}}</p><template v-else><damage-panel :analysis-from-wasm="detail.analysis" /><div class="result-stats"><span v-for="s in detail.attributes" :key="s.key">{{s.label}} <b>{{s.percent?percent(s.value):s.value.toFixed(1)}}</b></span></div></template>
      </td></tr>
     </template></tbody>
    </table>
    <button class="more" v-if="limit<sortedRows.length" @click="limit+=8">显示更多候选</button>
   </el-scrollbar>
  </div>
 </el-dialog>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import ArtifactDisplay from '@/components/display/ArtifactDisplay.vue'
import DamagePanel from './DamagePanel.vue'
import {convertArtifact} from '@/utils/converter'
import {resultDamagePreview} from '@/algorithms/optimization-results.mjs'
import {visibleDamageReactionKeys,defaultDamageReaction,damageReactionLabel} from '@/algorithms/reaction-labels.mjs'
import {sameHitBaseline,percentChange,displayScore} from '@/algorithms/single-result-comparison.mjs'
import characters from '@/assets/_gen_character'
import {useI18n} from '@/i18n/i18n'
const props=defineProps({modelValue:Boolean,results:Array,input:Object,infusion:String,mona:Object,getArtifact:Function,selectedIndex:Number,skillLabel:String,objectiveLabel:String,objectiveBefore:Number,chargeMin:Number,baselineAnalysis:Object,baselineLabel:String})
const emit=defineEmits(['update:modelValue','select'])
const {ta,t}=useI18n(),scrollbar=ref(),limit=ref(8),detailIndex=ref(null)
const sortMetric=ref('objective'),sortDirection=ref('desc'),requestedReaction=ref('')
const sortOptions=[['objective','优化目标值'],['expectation','期望伤害'],['critical','暴击伤害'],['non_critical','非暴击伤害'],['recharge','充能效率']]
const hitMetric=computed(()=>['objective','recharge'].includes(sortMetric.value)?'expectation':sortMetric.value)
const metricName=computed(()=>({expectation:'期望',critical:'暴击',non_critical:'非暴击'})[hitMetric.value])
const characterLabel=computed(()=>ta(characters[props.input.character.name].nameLocale))
function preview(items,details){try{return resultDamagePreview(props.mona,props.input,items.filter(Boolean).map(convertArtifact),props.infusion,{details})}catch(e){return {error:e.message||String(e)}}}
const allRows=computed(()=>!props.modelValue?[]:props.results.map((r,originalIndex)=>{
 const items=['flower','feather','sand','goblet','head'].map(k=>r[k]==null?null:props.getArtifact(r[k]))
 return {originalIndex,items,value:r.value,...preview(items,false)}
}))
const detail=computed(()=>detailIndex.value==null?null:preview(allRows.value[detailIndex.value].items,true))
const reactionOptions=computed(()=>[...new Set(allRows.value.flatMap(row=>visibleDamageReactionKeys(row.analysis)))])
const sortReaction=computed({get:()=>reactionOptions.value.includes(requestedReaction.value)?requestedReaction.value:defaultDamageReaction(allRows.value.find(row=>!row.error)?.analysis),set:key=>{requestedReaction.value=key}})
function labelReaction(k){const a=allRows.value.find(r=>r.analysis?.[k])?.analysis;return k==='normal'&&a?(a.is_heal?t('dmg.heal'):t('dmg',a.element)):damageReactionLabel(k)}
const reactionLabel=computed(()=>labelReaction(sortReaction.value))
const sortValue=r=>sortMetric.value==='objective'?r.value:sortMetric.value==='recharge'?r.recharge:r.analysis?.[sortReaction.value]?.[sortMetric.value]
const sortedRows=computed(()=>[...allRows.value].sort((a,b)=>{
 const av=sortValue(a),bv=sortValue(b)
 if(!Number.isFinite(av))return Number.isFinite(bv)?1:a.originalIndex-b.originalIndex
 if(!Number.isFinite(bv))return -1
 return (sortDirection.value==='desc'?bv-av:av-bv)||a.originalIndex-b.originalIndex
}))
const rows=computed(()=>sortedRows.value.slice(0,limit.value))
function hitGain(row){
 if(sameHitBaseline(row.analysis,props.baselineAnalysis,sortReaction.value)==null)return ''
 return percentChange(row.analysis[sortReaction.value][hitMetric.value],props.baselineAnalysis[sortReaction.value][hitMetric.value])
}
const percent=v=>Number.isFinite(v)?(v*100).toFixed(1)+'%':'—'
const rounded=v=>Number.isFinite(v)?Math.round(v).toLocaleString('zh-CN'):'—'
function selectBuild(row){emit('select',row.originalIndex+1);emit('update:modelValue',false)}
function loadMore({scrollTop}){const wrap=scrollbar.value?.wrap$;if(wrap&&scrollTop+wrap.clientHeight>=wrap.scrollHeight-80)limit.value=Math.min(props.results.length,limit.value+8)}
watch(()=>[props.modelValue,props.results,props.input.skill,props.infusion,sortMetric.value,sortDirection.value,sortReaction.value],()=>{limit.value=8;detailIndex.value=null;scrollbar.value?.setScrollTop(0)})
</script>
<style scoped>
.candidate-review{font:15px/1.45 system-ui,"Microsoft YaHei",sans-serif;color:#1b354a;font-variant-numeric:tabular-nums;min-width:0}.result-skill,.result-sort,.result-stats{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.result-skill{justify-content:space-between}.candidate-context{margin:8px 0 14px;color:#485e70}.result-sort{margin-bottom:14px}.result-sort select{font:inherit;border:1px solid #b6c8d6;border-radius:5px;background:white;padding:5px;color:inherit}.candidate-table{width:100%;border-collapse:collapse;table-layout:fixed}.candidate-table th,.candidate-table td{text-align:right;padding:10px 12px;border-bottom:1px solid #d4e2ed;overflow-wrap:anywhere}.candidate-table thead{position:sticky;top:0;z-index:1;background:#eaf3fa}.candidate-table th:first-child{text-align:left}.candidate-table td,.candidate-table th{vertical-align:middle}.candidate-table small{display:block;color:#496478;font-weight:400;font-size:12px}.build-result{cursor:pointer}.build-result:hover{background:#f3f8fc}.candidate-table .is-selected{background:#e9f4fc}.select-build,.detail-button,.more{border:0;background:none;color:#195b96;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.select-build{font-weight:650}.candidate-table .met{color:#246653}.candidate-table .unmet,.error{color:#90422d}.result-artifacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;text-align:left}.result-stats{font-size:14px;gap:12px}.more{width:100%;padding:11px}.detail-col{width:64px}.candidate-table .error{text-align:left}
@media(max-width:700px){.candidate-review{font-size:13px}.candidate-table th,.candidate-table td{padding:8px 3px}.result-sort{gap:5px}.result-sort select{font-size:13px}.candidate-context{font-size:12px}.candidate-table .detail-col{width:30px}.detail-button{padding:0;font-size:12px}.candidate-table small{font-size:11px}.select-build{padding:3px 0}.candidate-table thead th{font-size:12px}.candidate-table th:first-child{width:49px}}
</style>
