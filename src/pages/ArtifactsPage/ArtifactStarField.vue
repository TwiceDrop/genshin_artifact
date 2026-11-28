<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'radix-vue'
import { useI18n } from '@/i18n/i18n'

withDefaults(defineProps<{ modelValue: number; min?: number; max?: number }>(), { min: 1, max: 5 })
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
const { t } = useI18n()
</script>

<template>
    <RadioGroupRoot class="artifact-stars" :aria-label="t('misc.quality')" :model-value="String(modelValue)"
        @update:model-value="emit('update:modelValue', Number($event))">
        <RadioGroupItem v-for="star in max" :key="star" class="artifact-star" :class="{ filled: star <= modelValue }"
            :value="String(star)" :disabled="star < min" :aria-label="String(star)">
            <i-ep-star-filled aria-hidden="true" />
        </RadioGroupItem>
    </RadioGroupRoot>
</template>

<style scoped>
.artifact-stars { display: inline-flex; gap: 4px; }
.artifact-star { display: grid; place-items: center; width: 24px; height: 32px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--cx-step-2); cursor: pointer; }
.artifact-star.filled { color: var(--cx-gold); }
.artifact-star:disabled { opacity: .5; cursor: default; }
.artifact-star:focus-visible { outline: 2px solid var(--cx-gold); }
.artifact-star svg { width: 18px; height: 18px; }
</style>
