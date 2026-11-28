<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import { useI18n } from '@/i18n/i18n'


const props = withDefaults(defineProps<{
    modelValue: number | null | undefined
    min?: number
    max?: number
    step?: number
    precision?: number
    controls?: boolean
    disabled?: boolean
}>(), { min: -Infinity, max: Infinity, step: 1, controls: true })
const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>()
const { locale } = useI18n()

function commit(value: number | null) {
    if (value === null) {
        if (props.modelValue != null) emit('update:modelValue', null)
        return
    }
    const rounded = props.precision === undefined ? value : Number(value.toFixed(props.precision))
    const next = Math.min(props.max, Math.max(props.min, rounded))
    if (next !== props.modelValue) emit('update:modelValue', next)
}

function change(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.validity.badInput) {
        input.value = String(props.modelValue ?? '')
        return
    }
    commit(input.value === '' ? null : input.valueAsNumber)
    input.value = String(props.modelValue ?? input.value)
}

function move(direction: 1 | -1) {
    if (props.disabled || (direction < 0 ? props.modelValue! <= props.min : props.modelValue! >= props.max)) return
    const value = props.modelValue || 0
    const digits = Math.max(String(value).split('.')[1]?.length ?? 0, String(props.step).split('.')[1]?.length ?? 0)
    commit(Number((value + direction * props.step).toFixed(digits)))
}
</script>

<template>
    <div class="team-number" :class="{ 'has-controls': controls }">
        <UiButton v-if="controls" :aria-label="locale === 'en' ? 'Decrease number' : '减少数值'"
            :disabled="disabled || modelValue! <= min" @click="move(-1)">−</UiButton>
        <UiInput v-bind="$attrs" :model-value="modelValue ?? ''" type="number" :disabled="disabled"
            :min="isFinite(min) ? min : undefined" :max="isFinite(max) ? max : undefined" :step="step"
            @change="change" @keydown.up.prevent="move(1)" @keydown.down.prevent="move(-1)" />
        <UiButton v-if="controls" :aria-label="locale === 'en' ? 'Increase number' : '增加数值'"
            :disabled="disabled || modelValue! >= max" @click="move(1)">+</UiButton>
    </div>
</template>

<style scoped>
.team-number { display: inline-grid; grid-template-columns: minmax(0, 1fr); width: 150px; min-width: 0; max-width: 100%; vertical-align: middle; }
.team-number.has-controls { grid-template-columns: auto minmax(0, 1fr) auto; }
.team-number input { appearance: textfield; font-variant-numeric: tabular-nums; text-align: center; }
.team-number input::-webkit-inner-spin-button, .team-number input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.team-number.has-controls input { border-radius: 0; }
.team-number.has-controls button { padding-inline: 11px; }
.team-number.has-controls button:first-child { border-inline-end: 0; border-start-end-radius: 0; border-end-end-radius: 0; }
.team-number.has-controls button:last-child { border-inline-start: 0; border-start-start-radius: 0; border-end-start-radius: 0; }
</style>
