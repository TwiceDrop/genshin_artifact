<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'

defineProps<{ modelValue: string | number; label: string; percentage?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
</script>

<template>
    <div class="artifact-stat-field">
        <slot />
        <UiInput :model-value="modelValue" :aria-label="label" inputmode="decimal" @update:model-value="emit('update:modelValue', $event)" />
        <span v-if="percentage" class="stat-suffix">%</span>
    </div>
</template>

<style scoped>
.artifact-stat-field { display: grid; flex: 1; min-width: 0; grid-template-columns: minmax(0, 110px) minmax(0, 1fr) auto; align-items: stretch; }
.artifact-stat-field :deep([role="combobox"]) { min-width: 0; width: 100%; border-start-end-radius: 0; border-end-end-radius: 0; }
.artifact-stat-field :deep(.ui-input) { border-start-start-radius: 0; border-end-start-radius: 0; border-inline-start: 0; }
.artifact-stat-field:has(.stat-suffix) :deep(.ui-input) { border-radius: 0; }
.stat-suffix { display: grid; place-items: center; padding: 0 10px; border: 1px solid var(--cx-step-2); border-inline-start: 0; border-start-end-radius: 8px; border-end-end-radius: 8px; background: var(--cx-step); color: var(--cx-dim); }
</style>
