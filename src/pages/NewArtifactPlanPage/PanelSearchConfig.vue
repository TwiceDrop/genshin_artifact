<template>
 <div class="panel-search-config">
  <label>搜索目标
   <el-select :model-value="modelValue.metric" @update:model-value="set('metric',$event)" aria-label="面板搜索目标">
    <el-option v-for="stat in PANEL_STATS" :key="stat.key" :value="stat.key" :label="stat.label" />
   </el-select>
  </label>
  <label>目标方向
   <el-select :model-value="modelValue.direction" @update:model-value="set('direction',$event)">
    <el-option label="最高" value="desc" /><el-option label="最低" value="asc" />
   </el-select>
  </label>
  <label>保留套数<el-input-number :model-value="modelValue.resultLimit" :min="1" :step="1" :precision="0" @update:model-value="set('resultLimit',$event)" /></label>
  <label>圣遗物最低等级<el-input-number :model-value="modelValue.minArtifactLevel" :min="0" :max="20" :step="1" :precision="0" @update:model-value="set('minArtifactLevel',$event)" /></label>
  <div class="panel-bounds">
   <span>属性</span><span>下限</span><span>上限</span>
   <template v-for="stat in PANEL_STATS" :key="stat.key">
    <label :for="'panel-min-'+stat.key">{{ stat.label }}{{ stat.percent?'（%）':'' }}</label>
    <input :id="'panel-min-'+stat.key" type="number" step="0.1" :value="boundValue(stat,'min')" :aria-label="stat.label+'下限'" @change="setBound(stat,'min',$event.target)" />
    <input type="number" step="0.1" :value="boundValue(stat,'max')" :aria-label="stat.label+'上限'" @change="setBound(stat,'max',$event.target)" />
   </template>
  </div>
 </div>
</template>
<script setup>
import {PANEL_STATS} from '../../../beta-data/panel-search.mjs'
const props=defineProps({modelValue:Object}),emit=defineEmits(['update:modelValue'])
const set=(key,value)=>emit('update:modelValue',{...props.modelValue,[key]:value})
const boundValue=(stat,side)=>props.modelValue.bounds[stat.key]?.[side]==null?'':(props.modelValue.bounds[stat.key][side]*(stat.percent?100:1)).toFixed(1)
function setBound(stat,side,input){
 const range={...props.modelValue.bounds[stat.key]}
 if(input.value==='')delete range[side]
 else {
  // Commit on change so formatting does not interrupt typing a decimal.
  input.value=Number(input.value).toFixed(1)
  range[side]=Number(input.value)/(stat.percent?100:1)
 }
 set('bounds',{...props.modelValue.bounds,[stat.key]:range})
}
</script>
<style scoped>
.panel-search-config{display:grid;gap:12px;margin:16px 0}.panel-search-config>label{display:flex;align-items:center;justify-content:space-between;gap:12px}.panel-search-config .el-select{width:190px}.panel-bounds{display:grid;grid-template-columns:minmax(100px,1.5fr) 1fr 1fr;gap:8px;align-items:center}.panel-bounds input{width:100%;min-width:0;box-sizing:border-box;padding:8px;border:1px solid var(--el-border-color,#ddd);border-radius:5px;background:var(--el-bg-color,#fff);color:inherit}
</style>
