<template>
 <UiDialog :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" title="比较候选" width="min(1060px,96vw)">
  <div class="candidate-review">
   <div class="result-skill"><strong>{{ characterLabel }} · {{ skillLabel }}</strong><span>共 {{ results.length }} 套</span></div>
   <p class="candidate-context">优化目标：{{ objectiveLabel }} <span> / </span> 单段：{{ reactionLabel }} <template v-if="baselineAnalysis"> / 基准：{{ baselineLabel }}</template></p>
   <div class="result-sort">
    <div v-if="reactionOptions.length>1" class="sort-field"><span>伤害类型</span><UiSelect v-model="sortReaction" label="排序伤害类型" :options="reactionSortOptions" /></div>
    <div class="sort-field"><span>排序</span><UiSelect v-model="sortMetric" label="候选排序指标" :options="sortOptions" /></div>
    <UiSegmentedControl v-model="sortDirection" label="排序方向" :options="directionOptions" />
   </div>
   <div ref="scrollbar" class="candidate-scroll" tabindex="0" role="region" aria-label="比较候选" @scroll.passive="loadMore">
    <table class="candidate-table">
     <thead><tr><th>套次</th><th>优化目标值</th><th>单段{{ metricName }}</th><th>充能效率<small v-if="chargeMin>1">要求 ≥ {{ percent(chargeMin) }}</small></th><th class="detail-col">明细</th></tr></thead>
     <tbody><template v-for="row in rows" :key="row.originalIndex">
      <tr class="build-result" :class="{'is-selected':selectedIndex===row.originalIndex+1}" :data-result-index="row.originalIndex+1" @click="selectBuild(row)">
       <th scope="row"><UiButton size="small" @click.stop="selectBuild(row)" :aria-label="'切换到第 '+(row.originalIndex+1)+' 套'" :aria-current="selectedIndex===row.originalIndex+1 || undefined">第 {{ row.originalIndex+1 }} 套</UiButton><small>{{ selectedIndex===row.originalIndex+1?'当前':'' }}</small></th>
       <td class="objective"><span>{{ displayScore(row.value) }}</span><small v-if="percentChange(row.value,objectiveBefore)">{{percentChange(row.value,objectiveBefore)}}</small></td>
       <td class="hit"><template v-if="!row.error">{{ rounded(row.analysis?.[sortReaction]?.[hitMetric]) }}<small v-if="hitGain(row)">{{hitGain(row)}}</small></template><span v-else>—</span></td>
       <td class="charge">{{percent(row.recharge)}}<small v-if="chargeMin>1 && Number.isFinite(row.recharge)" :class="row.recharge+1e-10>=chargeMin?'met':'unmet'">{{row.recharge+1e-10>=chargeMin?'达标':'未达标'}}</small></td>
       <td class="detail-col"><UiButton size="small" :aria-expanded="detailIndex===row.originalIndex" @click.stop="detailIndex=detailIndex===row.originalIndex?null:row.originalIndex">详情</UiButton></td>
      </tr>
      <tr v-if="row.error"><td colspan="5" class="error">{{row.error}}</td></tr>
      <tr v-if="detailIndex===row.originalIndex&&detail"><td colspan="5">
       <div class="result-artifacts"><template v-for="(a,i) in row.items" :key="i"><artifact-display v-if="a" shadcn :item="a"/><span v-else>未装备</span></template></div>
       <p v-if="detail.error" class="error">{{detail.error}}</p><template v-else><damage-panel :analysis-from-wasm="detail.analysis" /><div class="result-stats"><span v-for="s in detail.attributes" :key="s.key">{{s.label}} <b>{{s.percent?percent(s.value):s.value.toFixed(1)}}</b></span></div></template>
      </td></tr>
     </template></tbody>
    </table>
    <UiButton v-if="limit<sortedRows.length" class="more" @click="limit+=8">显示更多候选</UiButton>
   </div>
  </div>
 </UiDialog>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
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
const sortOptions = [
 { value: 'objective', label: '优化目标值' },
 { value: 'expectation', label: '期望伤害' },
 { value: 'critical', label: '暴击伤害' },
 { value: 'non_critical', label: '非暴击伤害' },
 { value: 'recharge', label: '充能效率' },
]
const directionOptions = [{ value: 'desc', label: '从高到低' }, { value: 'asc', label: '从低到高' }]
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
const reactionSortOptions = computed(() => reactionOptions.value.map(value => ({ value, label: labelReaction(value) })))
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
function loadMore({ currentTarget: wrap }) {
 if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 80) {
  limit.value = Math.min(props.results.length, limit.value + 8)
 }
}
watch(()=>[props.modelValue,props.results,props.input.skill,props.infusion,sortMetric.value,sortDirection.value,sortReaction.value],()=>{
 limit.value=8;detailIndex.value=null;scrollbar.value?.scrollTo(0, 0)
})
</script>
<style scoped>
.candidate-review{color:var(--cx-letter);font-variant-numeric:tabular-nums;min-width:0}
.result-skill,.result-sort,.result-stats,.sort-field{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.result-skill{justify-content:space-between}
.candidate-context{margin:8px 0 14px;color:var(--cx-dim)}
.result-sort{margin-bottom:14px}
.sort-field > span{font-size:13px;color:var(--cx-dim)}
.candidate-scroll{max-height:min(58dvh,530px);overflow:auto;border:1px solid var(--cx-step-2);border-radius:10px}
.candidate-scroll:focus-visible{outline:2px solid var(--cx-gold);outline-offset:2px}
.candidate-table{width:100%;min-width:510px;border-collapse:collapse;table-layout:fixed}
.candidate-table th,.candidate-table td{text-align:right;padding:10px 12px;border-bottom:1px solid var(--cx-step-2);vertical-align:middle}
.candidate-table thead{position:sticky;top:0;z-index:1;background:var(--cx-step)}
.candidate-table th:first-child{text-align:left}
.candidate-table small{display:block;color:var(--cx-dim);font-weight:400;font-size:12px}
.build-result{--result-row-bg:var(--cx-card);background:var(--result-row-bg);cursor:pointer}
.build-result:hover{--result-row-bg:var(--cx-step)}
.candidate-table .is-selected{--result-row-bg:color-mix(in srgb,var(--cx-gold) 12%,var(--cx-card))}
.candidate-table .is-selected th{box-shadow:inset 2px 0 var(--cx-gold)}
.candidate-table [aria-current="true"]{border-color:var(--cx-gold)}
.candidate-table .met{color:var(--cx-down)}
.candidate-table .unmet,.error{color:var(--cx-up)}
.result-artifacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;text-align:left}
.result-stats{font-size:14px}
.more{margin:8px}
.detail-col{width:64px;white-space:nowrap}
.candidate-table .error{text-align:left}
.result-artifacts :deep(.artifact .up .name){color:var(--cx-letter)}
.candidate-review :deep(.damage-values.expected){color:var(--cx-gold)}
@media(max-width:700px){.candidate-review{font-size:13px}.candidate-table th,.candidate-table td{padding:8px}}
@media(max-width:600px){
 .candidate-table thead th:nth-child(1){width:78px}
 .candidate-table thead th:nth-child(2){width:116px}
 .candidate-table .detail-col{position:sticky;inset-inline-end:0;background:var(--result-row-bg,var(--cx-step));box-shadow:-1px 0 var(--cx-step-2)}
}
</style>
