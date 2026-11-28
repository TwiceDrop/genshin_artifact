<template>
  <div class="artifact-score-mode">
    <UiSegmentedControl :model-value="modelValue ? 'dynamic' : 'miao'" :options="options" :disabled="disabled"
      label="圣遗物评分方式" @update:model-value="$emit('update:modelValue', $event === 'dynamic')" />
    <UiButton v-if="modelValue" size="small" :disabled="disabled" @click="$emit('settings')">评分设置</UiButton>
  </div>
</template>
<script setup>
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'

defineProps({ modelValue: Boolean, disabled: Boolean })
defineEmits(['update:modelValue', 'settings'])
const options = [
  { value: 'miao', label: '喵喵评分' },
  { value: 'dynamic', label: '新评分' },
]
</script>
<style scoped>
.artifact-score-mode{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.artifact-score-mode :deep(button:disabled) { opacity: .5; cursor: default; }
</style>
