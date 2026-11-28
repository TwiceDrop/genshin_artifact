<script setup lang="ts">
import { computed } from 'vue'
import { positions } from '@/constants/artifact'
import { useI18n } from '@/i18n/i18n'
import type { ArtifactPosition } from '@/types/artifact'
import UiSelect from '@/components/ui/UiSelect.vue'

defineProps<{ modelValue: ArtifactPosition }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: ArtifactPosition): void }>()
const { t } = useI18n()
const options = computed(() => positions.map(value => ({ value, label: t('misc', value) })))
</script>

<template>
    <UiSelect :model-value="modelValue" :label="t('misc.artSlot')" :options="options"
        @update:model-value="emit('update:modelValue', $event as ArtifactPosition)" />
</template>
