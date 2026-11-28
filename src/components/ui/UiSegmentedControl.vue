<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'radix-vue'

defineProps<{ modelValue: string; label: string; disabled?: boolean; options: { value: string; label: string }[] }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
</script>

<template>
    <RadioGroupRoot class="ui-segmented" :model-value="modelValue" :aria-label="label" :disabled="disabled" orientation="horizontal"
        @update:model-value="emit('update:modelValue', $event)">
        <RadioGroupItem v-for="option in options" :key="option.value" class="ui-segment" :value="option.value">
            {{ option.label }}
        </RadioGroupItem>
    </RadioGroupRoot>
</template>

<style scoped>
.ui-segmented { display: inline-flex; flex-wrap: wrap; gap: 3px; padding: 3px; border: 1px solid var(--cx-step-2); border-radius: 10px; background: var(--cx-step); }
.ui-segment { min-height: 30px; min-width: 0; padding: 4px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--cx-dim); font: inherit; font-size: 13px; font-weight: 600; text-align: center; cursor: pointer; }
.ui-segment:disabled { opacity: .5; cursor: default; }
.ui-segment:hover:enabled { color: var(--cx-letter); background: var(--cx-step-2); }
.ui-segment[data-state="checked"] { color: var(--cx-gold-on); background: var(--cx-gold); }
.ui-segment:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
</style>
