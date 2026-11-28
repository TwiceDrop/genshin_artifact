<template>
 <UiDialog :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" title="面板配装结果" width="94%">
  <div class="panel-toolbar">
   <span>全局目标：{{ targetLabel }} · {{ snapshot.options.direction==='desc'?'最高':'最低' }} · {{ results.length }} 套</span>
   <UiSelect v-model="sortMetric" label="面板结果排序" :options="sortOptions" />
   <UiSegmentedControl v-model="sortDirection" label="排序方向" :options="directionOptions" />
  </div>
  <div class="panel-table-wrap" tabindex="0" role="region" aria-label="面板配装结果">
   <table class="panel-table">
    <thead><tr><th>全局排名</th><th v-for="stat in PANEL_STATS" :key="stat.key">{{ stat.label }}</th><th>操作</th></tr></thead>
    <tbody>
     <tr class="panel-baseline"><th>计算前装备</th><td v-for="stat in PANEL_STATS" :key="stat.key">{{ format(snapshot.baseline[stat.key],stat) }}</td><td></td></tr>
     <tr v-for="row in visibleRows" :key="row.index" :class="{'is-selected':row.index===detailIndex}">
      <td>{{ row.index+1 }}</td><td v-for="stat in PANEL_STATS" :key="stat.key">{{ format(row.panel[stat.key],stat) }}</td>
      <td><div class="panel-row-actions"><UiButton size="small" :aria-pressed="detailIndex===row.index" @click="detailIndex=row.index">详情</UiButton><UiButton size="small" @click="apply(row.index)">应用</UiButton></div></td>
     </tr>
    </tbody>
   </table>
  </div>
  <UiButton v-if="limit<results.length" class="panel-load-more" @click="limit+=50">加载更多</UiButton>
  <div v-if="detail" class="panel-build-detail">
   <h3>第 {{ detailIndex+1 }} 套</h3>
   <div class="panel-difference">
    <span v-for="stat in detailStats" :key="stat.key">
     {{ stat.label }} <strong>{{ stat.total }}</strong> <small v-if="stat.delta">({{ stat.delta }})</small>
    </span>
   </div>
   <div class="panel-artifacts"><artifact-display v-for="item in detailArtifacts" :key="item.id" shadcn :item="item" /></div>
  </div>
 </UiDialog>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import ArtifactDisplay from '@/components/display/ArtifactDisplay.vue'
import {PANEL_STATS,PANEL_SLOTS,comparePanelBuilds} from '../../../beta-data/panel-search.mjs'
const props=defineProps({modelValue:Boolean,results:Array,snapshot:Object,selectedIndex:Number})
const emit=defineEmits(['update:modelValue','select'])
const sortMetric=ref('critical_damage'),sortDirection=ref('desc'),detailIndex=ref(0),limit=ref(50)
const sortOptions = PANEL_STATS.map(({ key: value, label }) => ({ value, label }))
const directionOptions = [{ value: 'desc', label: '从高到低' }, { value: 'asc', label: '从低到高' }]
const targetLabel=computed(()=>PANEL_STATS.find(s=>s.key===props.snapshot.options.metric).label)
const rows=computed(()=>props.results.map((r,index)=>({...r,index})).sort((a,b)=>comparePanelBuilds(a,b,sortMetric.value,sortDirection.value)))
const visibleRows=computed(()=>rows.value.slice(0,limit.value))
const detail=computed(()=>props.results[detailIndex.value])
const detailArtifacts=computed(()=>PANEL_SLOTS.map(slot=>props.snapshot.items[detail.value[slot.toLowerCase()]]))
const panelNumber=(value,stat)=>(stat.percent?value*100:value).toFixed(1)
const format=(value,stat)=>panelNumber(value,stat)+(stat.percent?'%':'')
const detailStats=computed(()=>PANEL_STATS.map(stat=>{
 const value=detail.value.panel[stat.key]
 const change=Number(panelNumber(value,stat))-Number(panelNumber(props.snapshot.baseline[stat.key],stat))
 return {key:stat.key,label:stat.label,total:format(value,stat),delta:change
  ? (change>0?'+':'')+change.toFixed(1)+(stat.percent?' 个百分点':'') : ''}
}))
function apply(index){emit('select',index+1);emit('update:modelValue',false)}
watch(()=>props.modelValue,open=>{if(open){sortMetric.value=props.snapshot.options.metric;sortDirection.value=props.snapshot.options.direction;detailIndex.value=Math.max(0,props.selectedIndex-1);limit.value=50}},{immediate:true})
watch([sortMetric,sortDirection],()=>{limit.value=50})
</script>
<style scoped>
.panel-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.panel-table-wrap{overflow:auto;max-height:50dvh;border:1px solid var(--cx-step-2);border-radius:10px}
.panel-table-wrap:focus-visible{outline:2px solid var(--cx-gold);outline-offset:2px}
.panel-table{width:100%;border-collapse:collapse;white-space:nowrap;font-variant-numeric:tabular-nums}
.panel-table th,.panel-table td{padding:10px;border-bottom:1px solid var(--cx-step-2);text-align:right}
.panel-table thead{position:sticky;top:0;background:var(--cx-step);z-index:1}
.panel-table tbody tr{--result-row-bg:var(--cx-card);background:var(--result-row-bg)}
.panel-table .panel-baseline{--result-row-bg:var(--cx-step)}
.panel-table .is-selected{--result-row-bg:color-mix(in srgb,var(--cx-gold) 12%,var(--cx-card))}
.is-selected td:first-child{box-shadow:inset 2px 0 var(--cx-gold);font-weight:700}
.panel-row-actions{display:flex;gap:6px;justify-content:flex-end}
.panel-row-actions [aria-pressed="true"]{border-color:var(--cx-gold)}
.panel-load-more{margin-top:8px}
.panel-artifacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:10px}
.panel-difference{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.panel-artifacts :deep(.artifact .up .name){color:var(--cx-letter)}
@media(max-width:600px){
 .panel-table tr > :last-child{position:sticky;inset-inline-end:0;background:var(--result-row-bg,var(--cx-step));box-shadow:-1px 0 var(--cx-step-2)}
}
</style>
