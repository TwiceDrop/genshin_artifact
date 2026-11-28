<script setup lang="ts">
import UiSwitch from '@/components/ui/UiSwitch.vue'

defineProps<{ modelValue?: boolean; label: string; shadcn?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
</script>

<template>
    <label v-if="shadcn" class="team-trigger-switch">
        <UiSwitch :model-value="modelValue === true" :aria-label="label" @update:model-value="emit('update:modelValue', $event)" />
        <span>{{ label }}</span>
    </label>
    <el-switch v-else :model-value="modelValue" :active-text="label" @update:model-value="emit('update:modelValue', $event)" />
</template>

<style scoped>
.team-trigger-switch { display: inline-flex; align-items: center; gap: 8px; min-width: 0; color: var(--cx-letter); font-size: 13px; }
.team-trigger-switch > span { overflow-wrap: anywhere; }
</style>
