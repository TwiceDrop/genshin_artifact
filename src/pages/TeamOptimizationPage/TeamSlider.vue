<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue'

defineProps<{ modelValue: number; min: number; max: number; step?: number; disabled?: boolean; label: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>()
</script>

<template>
    <div class="team-slider">
        <SliderRoot class="team-slider-root" :model-value="[modelValue]" :min="min" :max="max" :step="step" :disabled="disabled"
            @update:model-value="emit('update:modelValue', $event[0])">
            <SliderTrack class="team-slider-track"><SliderRange class="team-slider-fill" /></SliderTrack>
            <SliderThumb class="team-slider-thumb" :aria-label="label" />
        </SliderRoot>
    </div>
</template>

<style scoped>
.team-slider { display: flex; height: 22px; min-width: 0; }
.team-slider :deep(.team-slider-root) { display: flex; flex: 1; position: relative; align-items: center; touch-action: none; }
.team-slider :deep(.team-slider-root[data-disabled]) { opacity: .5; }
.team-slider :deep(.team-slider-track) { height: 5px; position: relative; flex: 1; border-radius: 999px; background: var(--cx-step-2); }
.team-slider :deep(.team-slider-fill) { position: absolute; height: 100%; border-radius: inherit; background: var(--cx-gold); }
.team-slider :deep(.team-slider-thumb) { display: block; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--cx-gold); background: var(--cx-step); }
.team-slider :deep(.team-slider-thumb:focus-visible) { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
</style>
