<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'radix-vue'

defineProps<{ modelValue: boolean | 'indeterminate'; disabled?: boolean; label?: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
</script>

<template>
    <label class="check-label">
        <CheckboxRoot class="check-box" data-slot="checkbox" :checked="modelValue" :disabled="disabled" :aria-label="label"
            @update:checked="emit('update:modelValue', $event === true)">
            <CheckboxIndicator class="check-indicator">
                <i-ep-minus v-if="modelValue === 'indeterminate'" aria-hidden="true" />
                <i-ep-check v-else aria-hidden="true" />
            </CheckboxIndicator>
        </CheckboxRoot>
        <slot />
    </label>
</template>

<style scoped>
.check-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.check-label :deep(.check-box) { display: grid; place-items: center; flex: 0 0 18px; width: 18px; height: 18px; box-sizing: border-box; padding: 0; border: 1px solid var(--cx-dim); border-radius: 4px; background: var(--cx-card); color: var(--cx-gold-on); cursor: pointer; }
.check-label :deep(.check-box:is([data-state="checked"], [data-state="indeterminate"])) { background: var(--cx-gold); border-color: var(--cx-gold); }
.check-label :deep(.check-box:focus-visible) { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.check-label :deep(.check-box:disabled) { opacity: .5; cursor: default; }
.check-label :deep(.check-indicator svg) { display: block; width: 12px; height: 12px; }
</style>
