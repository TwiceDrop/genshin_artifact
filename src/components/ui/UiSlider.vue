<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue'

defineProps<{ modelValue: number; label: string; min: number; max: number; step: number }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
</script>

<template>
    <div class="ui-slider-field">
        <SliderRoot class="ui-slider" :model-value="[modelValue]" :min="min" :max="max" :step="step"
            @update:model-value="emit('update:modelValue', $event[0])">
            <SliderTrack class="ui-slider-track"><SliderRange class="ui-slider-range" /></SliderTrack>
            <SliderThumb class="ui-slider-thumb" :aria-label="label" />
        </SliderRoot>
    </div>
</template>

<style scoped>
.ui-slider-field { display: flex; flex: 1; min-width: 48px; }
.ui-slider-field :deep(.ui-slider) { position: relative; display: flex; flex: 1; min-width: 0; align-items: center; height: 32px; touch-action: none; }
.ui-slider-field :deep(.ui-slider-track) { position: relative; flex: 1; height: 5px; border-radius: 999px; background: var(--cx-step-2); }
.ui-slider-field :deep(.ui-slider-range) { position: absolute; height: 100%; border-radius: inherit; background: var(--cx-gold); }
.ui-slider-field :deep(.ui-slider-thumb) { display: block; box-sizing: border-box; width: 18px; height: 18px; border: 1px solid var(--cx-gold); border-radius: 50%; background: var(--cx-card); cursor: grab; }
.ui-slider-field :deep(.ui-slider-thumb:focus-visible) { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
</style>
