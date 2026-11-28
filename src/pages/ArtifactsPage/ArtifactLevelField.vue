<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import { useI18n } from '@/i18n/i18n'

const props = defineProps<{ modelValue: number; max: number; slider?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
const { t } = useI18n()

function changeLevel(value: number) {
    const level = Math.min(props.max, Math.max(0, Math.round(value)))
    emit('update:modelValue', level)
}

function updateLevel(value: string) {
    if (value !== '') changeLevel(Number(value))
}

function restoreLevel(event: FocusEvent) {
    (event.target as HTMLInputElement).value = String(props.modelValue)
}
</script>

<template>
    <div class="artifact-level">
        <SliderRoot v-if="slider" class="level-slider" :model-value="[modelValue]" :min="0" :max="max" :step="1"
            @update:model-value="changeLevel($event[0])">
            <SliderTrack class="level-track"><SliderRange class="level-range" /></SliderTrack>
            <SliderThumb class="level-thumb" :aria-label="t('misc.lvl')" />
        </SliderRoot>
        <div class="level-stepper">
            <UiButton size="small" :disabled="modelValue <= 0" aria-label="−" @click="changeLevel(modelValue - 1)">−</UiButton>
            <UiInput type="number" :model-value="modelValue" :min="0" :max="max" :aria-label="t('misc.lvl')"
                @update:model-value="updateLevel" @blur="restoreLevel" />
            <UiButton size="small" :disabled="modelValue >= max" aria-label="+" @click="changeLevel(modelValue + 1)">+</UiButton>
        </div>
    </div>
</template>

<style scoped>
.artifact-level { display: flex; align-items: center; gap: 16px; }
.level-slider { position: relative; display: flex; align-items: center; flex: 1; min-width: 0; height: 34px; touch-action: none; }
.level-track { position: relative; flex: 1; height: 5px; border-radius: 9px; background: var(--cx-step-2); }
.level-range { position: absolute; height: 100%; border-radius: inherit; background: var(--cx-gold); }
.level-thumb { display: block; width: 15px; height: 15px; border: 2px solid var(--cx-gold); border-radius: 50%; background: var(--cx-card); }
.level-thumb:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.level-stepper { display: grid; grid-template-columns: 30px minmax(34px, 64px) 30px; }
.level-stepper :deep(input) { border-radius: 0; text-align: center; appearance: textfield; }
.level-stepper :deep(input::-webkit-inner-spin-button) { appearance: none; }
.level-stepper :deep(button:first-child) { border-start-end-radius: 0; border-end-end-radius: 0; }
.level-stepper :deep(button:last-child) { border-start-start-radius: 0; border-end-start-radius: 0; }
</style>
