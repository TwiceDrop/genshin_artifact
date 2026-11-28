<template>
 <div class="panel-search-config">
  <label>搜索目标
   <UiSelect :model-value="modelValue.metric" label="面板搜索目标" :options="metricOptions" @update:model-value="set('metric',$event)" />
  </label>
  <label>目标方向
   <UiSelect :model-value="modelValue.direction" label="目标方向" :options="directionOptions" @update:model-value="set('direction',$event)" />
  </label>
  <div class="panel-search-field"><span>保留套数</span><UiNumberField :model-value="modelValue.resultLimit" label="保留套数" :min="1" allow-empty @update:model-value="set('resultLimit',$event)" /></div>
  <div class="panel-search-field"><span>圣遗物最低等级</span><UiNumberField :model-value="modelValue.minArtifactLevel" label="圣遗物最低等级" :min="0" :max="20" allow-empty @update:model-value="set('minArtifactLevel',$event)" /></div>
  <PanelRangeFields :model-value="modelValue.bounds" @update:model-value="set('bounds',$event)" />
 </div>
</template>
<script setup>
import UiNumberField from '@/components/ui/UiNumberField.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import {PANEL_STATS} from '../../../beta-data/panel-search.mjs'
import PanelRangeFields from './PanelRangeFields.vue'
const props=defineProps({modelValue:Object}),emit=defineEmits(['update:modelValue'])
const metricOptions=PANEL_STATS.map(stat=>({value:stat.key,label:stat.label}))
const directionOptions=[{value:'desc',label:'最高'},{value:'asc',label:'最低'}]
const set=(key,value)=>emit('update:modelValue',{...props.modelValue,[key]:value})
</script>
<style scoped>
.panel-search-config { display: grid; gap: 12px; margin: 16px 0; }
.panel-search-config > label, .panel-search-field { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.panel-search-config :deep(.select-trigger) { width: min(190px, 100%); }
</style>
