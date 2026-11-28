<script setup lang="ts">
import UiButton from './UiButton.vue'
import UiNumberInput from './UiNumberInput.vue'

const props = defineProps<{
    modelValue?: number | null
    label: string
    min: number
    max?: number
    disabled?: boolean
    allowEmpty?: boolean
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number | null): void }>()

function step(direction: -1 | 1) {
    const value = (props.modelValue ?? 0) + direction
    emit('update:modelValue', Math.max(props.min, Math.min(props.max ?? Infinity, value)))
}
</script>

<template>
    <div class="ui-number-field" role="group" :aria-label="label">
        <UiButton :aria-label="`− ${label}`" :disabled="disabled || (modelValue != null && modelValue <= min)" @click="step(-1)">
            <i-ep-minus aria-hidden="true" />
        </UiButton>
        <UiNumberInput :model-value="modelValue" :aria-label="label" :min="min" :max="max" :step="1" :precision="0"
            :allow-empty="allowEmpty" :disabled="disabled" @update:model-value="emit('update:modelValue', $event)"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()" />
        <UiButton :aria-label="`+ ${label}`" :disabled="disabled || (max !== undefined && modelValue != null && modelValue >= max)" @click="step(1)">
            <i-ep-plus aria-hidden="true" />
        </UiButton>
    </div>
</template>

<style scoped>
.ui-number-field { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; width: 130px; max-width: 100%; color: var(--cx-letter); }
.ui-number-field [data-slot="button"] { width: 34px; min-width: 0; padding: 0; }
.ui-number-field [data-slot="button"]:first-child { border-start-end-radius: 0; border-end-end-radius: 0; }
.ui-number-field [data-slot="button"]:last-child { border-start-start-radius: 0; border-end-start-radius: 0; }
.ui-number-field [data-slot="input"] { width: 100%; padding-inline: 4px; border-inline: 0; border-radius: 0; text-align: center; font-variant-numeric: tabular-nums; appearance: textfield; }
.ui-number-field [data-slot="input"]:disabled { opacity: .5; }
.ui-number-field [data-slot="input"]::-webkit-inner-spin-button, .ui-number-field [data-slot="input"]::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; }
</style>
