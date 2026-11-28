<script setup lang="ts">
import { computed } from 'vue'
import { subStats } from '@/constants/artifact'
import { useI18n } from '@/i18n/i18n'
import UiSelect from '@/components/ui/UiSelect.vue'

defineProps<{ modelValue?: string | null }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const { t } = useI18n()
const options = computed(() => subStats.map(value => ({ value, label: t('stat', value) })))
</script>

<template>
    <UiSelect :model-value="modelValue ?? undefined" :label="t('misc.subStat')" :options="options"
        @update:model-value="emit('update:modelValue', $event)" />
</template>
