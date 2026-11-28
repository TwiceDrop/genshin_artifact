<script setup lang="ts">
import { computed } from 'vue'
import UiSelect from '@/components/ui/UiSelect.vue'

const props = defineProps<{
    modelValue?: string
    label: string
    useUiSelect?: boolean
    levelGroups: [string, (string | { value: string; label: string })[]][]
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const groups = computed(() => props.levelGroups.map(([label, levels]) => ({
    label,
    options: levels.map(level => typeof level === 'string' ? { value: level, label: level } : level),
})))
const options = computed(() => groups.value.flatMap(({ label, options }) => options.map(option => ({ ...option, group: label }))))
</script>

<template>
    <UiSelect v-if="useUiSelect" :model-value="modelValue" :label="label" :options="options"
        @update:model-value="emit('update:modelValue', $event)" />
    <el-select v-else :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
        <el-option-group v-for="group in groups" :key="group.label" :label="group.label">
            <el-option v-for="option in group.options" :key="option.value" :label="option.label" :value="option.value" />
        </el-option-group>
    </el-select>
</template>
