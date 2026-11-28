<script setup lang="ts">
import UiInput from './UiInput.vue'

const props = defineProps<{
    modelValue?: number | null
    min?: number
    max?: number
    step?: number | 'any'
    precision?: number
    allowEmpty?: boolean
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number | null): void }>()

function commit(event: Event) {
    const input = event.target as HTMLInputElement
    if (props.allowEmpty && !input.value && !input.validity.badInput) {
        if (props.modelValue !== null) emit('update:modelValue', null)
        return
    }
    let value = input.valueAsNumber
    if (!Number.isFinite(value) || (props.precision === undefined && props.step === 1 && !Number.isInteger(value))) {
        input.value = props.modelValue == null ? '' : String(props.modelValue)
        return
    }
    if (props.precision !== undefined) value = Number(value.toFixed(props.precision))
    if (props.min !== undefined) value = Math.max(props.min, value)
    if (props.max !== undefined) value = Math.min(props.max, value)
    input.value = String(value)
    if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>

<template>
    <UiInput type="number" class="ui-number-input" :model-value="modelValue ?? ''"
        :min="min" :max="max" :step="step" @change="commit" />
</template>

<style scoped>
.ui-number-input { width: 82px; max-width: 100%; font-variant-numeric: tabular-nums; }
</style>
