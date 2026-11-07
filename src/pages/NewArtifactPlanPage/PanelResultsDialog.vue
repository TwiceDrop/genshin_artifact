<template>
 <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" title="面板配装结果" width="94%" destroy-on-close>
  <div class="panel-toolbar">
   <span>全局目标：{{ targetLabel }} · {{ snapshot.options.direction==='desc'?'最高':'最低' }} · {{ results.length }} 套</span>
   <el-select v-model="sortMetric" aria-label="面板结果排序"><el-option v-for="stat in PANEL_STATS" :key="stat.key" :value="stat.key" :label="stat.label" /></el-select>
   <el-radio-group v-model="sortDirection"><el-radio-button label="desc">从高到低</el-radio-button><el-radio-button label="asc">从低到高</el-radio-button></el-radio-group>
  </div>
  <div class="panel-table-wrap">
   <table class="panel-table">
    <thead><tr><th>全局排名</th><th v-for="stat in PANEL_STATS" :key="stat.key">{{ stat.label }}</th><th>操作</th></tr></thead>
    <tbody>
     <tr class="panel-baseline"><th>计算前装备</th><td v-for="stat in PANEL_STATS" :key="stat.key">{{ format(snapshot.baseline[stat.key],stat) }}</td><td></td></tr>
     <tr v-for="row in visibleRows" :key="row.index" :class="{'is-selected':row.index===detailIndex}">
      <td>{{ row.index+1 }}</td><td v-for="stat in PANEL_STATS" :key="stat.key">{{ format(row.panel[stat.key],stat) }}</td>
      <td><el-button @click="detailIndex=row.index">详情</el-button><el-button @click="apply(row.index)">应用</el-button></td>
     </tr>
    </tbody>
   </table>
  </div>
  <el-button v-if="limit<results.length" @click="limit+=50">加载更多</el-button>
  <div v-if="detail" class="panel-build-detail">
   <h3>第 {{ detailIndex+1 }} 套</h3>
   <div class="panel-difference"><span v-for="stat in PANEL_STATS" :key="stat.key">{{ stat.label }} {{ difference(detail.panel[stat.key]-snapshot.baseline[stat.key],stat) }}</span></div>
   <div class="panel-artifacts"><artifact-display v-for="item in detailArtifacts" :key="item.id" :item="item" /></div>
  </div>
 </el-dialog>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import ArtifactDisplay from '@/components/display/ArtifactDisplay.vue'
import {PANEL_STATS,PANEL_SLOTS,comparePanelBuilds} from '../../../beta-data/panel-search.mjs'
const props=defineProps({modelValue:Boolean,results:Array,snapshot:Object,selectedIndex:Number})
const emit=defineEmits(['update:modelValue','select'])
const sortMetric=ref('critical_damage'),sortDirection=ref('desc'),detailIndex=ref(0),limit=ref(50)
const targetLabel=computed(()=>PANEL_STATS.find(s=>s.key===props.snapshot.options.metric).label)
const rows=computed(()=>props.results.map((r,index)=>({...r,index})).sort((a,b)=>comparePanelBuilds(a,b,sortMetric.value,sortDirection.value)))
const visibleRows=computed(()=>rows.value.slice(0,limit.value))
const detail=computed(()=>props.results[detailIndex.value])
const detailArtifacts=computed(()=>PANEL_SLOTS.map(slot=>props.snapshot.items[detail.value[slot.toLowerCase()]]))
const format=(value,stat)=>stat.percent?(value*100).toFixed(1)+'%':value.toFixed(1)
const difference=(value,stat)=>(value>0?'+':'')+format(value,stat)
function apply(index){emit('select',index+1);emit('update:modelValue',false)}
watch(()=>props.modelValue,open=>{if(open){sortMetric.value=props.snapshot.options.metric;sortDirection.value=props.snapshot.options.direction;detailIndex.value=Math.max(0,props.selectedIndex-1);limit.value=50}},{immediate:true})
watch([sortMetric,sortDirection],()=>{limit.value=50})
</script>
<style scoped>
.panel-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}.panel-toolbar .el-select{width:160px}.panel-table-wrap{overflow:auto;max-height:50vh}.panel-table{width:100%;border-collapse:collapse;white-space:nowrap}.panel-table th,.panel-table td{padding:10px;border-bottom:1px solid var(--el-border-color,#ddd);text-align:right}.panel-table thead{position:sticky;top:0;background:var(--el-bg-color,#fff)}.panel-baseline,.is-selected{background:var(--el-fill-color-light,#f5f7fa)}.panel-artifacts{display:grid;grid-template-columns:repeat(5,minmax(180px,1fr));gap:10px;overflow:auto}.panel-difference{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
</style>
