<template>
  <div class="artifact-score-mode">
    <el-radio-group :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" :disabled="disabled" size="small" aria-label="圣遗物评分方式">
      <el-radio-button :label="false">喵喵评分</el-radio-button><el-radio-button :label="true">新评分</el-radio-button>
    </el-radio-group>
    <el-button v-if="modelValue" size="small" :disabled="disabled" @click="$emit('settings')">评分设置</el-button>
  </div>
</template>
<script setup>
defineProps({modelValue:Boolean,disabled:Boolean})
defineEmits(['update:modelValue','settings'])
</script>
<style scoped>
.artifact-score-mode{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
</style>
