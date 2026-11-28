<template>
    <UiMultiSelect v-if="shadcn && props.multiple" :model-value="props.modelValue as ArtifactMainStatName[]"
        :options="uiOptions" :label="props.placeholder" @update:model-value="emits('update:modelValue', $event as ArtifactMainStatName[])" />
    <UiSelect v-else-if="shadcn" :model-value="(props.modelValue as ArtifactMainStatName | null) ?? undefined"
        :options="uiOptions" :label="props.placeholder" :placeholder="props.placeholder"
        @update:model-value="emits('update:modelValue', $event as ArtifactMainStatName | 'any')" />
    <el-select v-else
        :model-value="props.modelValue"
        @update:modelValue="emits('update:modelValue', $event)"
        :multiple="props.multiple"
        :placeholder="props.placeholder"
    >
        <el-option
            v-if="props.includeAny"
            :label="t('misc.any')"
            value="any"
        ></el-option>
        <el-option
            v-for="item in tagList"
            :key="item.name"
            :label="item.title"
            :value="item.name"
        ></el-option>
    </el-select>
</template>

<script setup lang="ts">
import UiMultiSelect from '@/components/ui/UiMultiSelect.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { computed } from "vue"
import { artifactTags, mainStatMap } from "@const/artifact"
import type {ArtifactMainStatName, ArtifactPosition} from "@/types/artifact"
import {useI18n} from "@/i18n/i18n";

interface Emits {
    (e: "update:modelValue", v: ModelValue): void
}

const emits = defineEmits<Emits>()

type ModelValue = "any" | ArtifactMainStatName | ArtifactMainStatName[] | null

interface Props {
    modelValue: ModelValue,
    includeAny?: boolean,
    multiple?: boolean,
    shadcn?: boolean,
    position?: ArtifactPosition | 'all' | null,
    placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: null,
    includeAny: true,
    multiple: false,
    position: null,
    placeholder: "Select"
})

const { t } = useI18n()
const statNames = Object.keys(artifactTags)
const allMainStats = new Set<string>(Object.values(mainStatMap).flat())
const tagList = computed(() => {
    const { position } = props
    const names = position === 'all'
        ? statNames.filter(name => allMainStats.has(name))
        : position ? mainStatMap[position] : statNames
    return names.map(name => ({ name, title: t('stat', name) }))
})
const uiOptions = computed(() => [
    ...(props.includeAny ? [{ value: 'any', label: t('misc.any') }] : []),
    ...tagList.value.map(item => ({ value: item.name, label: item.title })),
])
</script>
