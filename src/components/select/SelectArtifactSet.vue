<template>
    <UiMultiSelect v-if="shadcn && props.multiple" :model-value="props.modelValue as string[]" :options="uiOptions"
        :label="props.placeholder" :disabled="props.disabled" :limit="props.multipleLimit"
        @update:model-value="emits('update:modelValue', $event)" />
    <UiSelect v-else-if="shadcn" :model-value="props.modelValue as string" :options="uiOptions"
        :label="props.placeholder" :placeholder="props.placeholder" :disabled="props.disabled"
        @update:model-value="emits('update:modelValue', $event)" />
    <el-select v-else
        @update:modelValue="emits('update:modelValue', $event)"
        :model-value="props.modelValue"
        :disabled="props.disabled"
        :multiple="props.multiple"
        :multiple-limit="props.multipleLimit"
        :placeholder="props.placeholder"
    >
        <el-option
            v-if="props.anyOption"
            :label="t('misc.any')"
            value="any"
        >
        </el-option>
        <el-option
            v-for="item in allArtifactsName"
            :key="item.name"
            :label="ta(item.nameLocale)"
            :value="item.name"
        >
            <div class="item">
                <img :src="item.url" class="tn">
                <span>{{ ta(item.nameLocale) }}</span>
            </div>
        </el-option>
    </el-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiMultiSelect from '@/components/ui/UiMultiSelect.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { artifactsData } from "@asset/artifacts"
import { getArtifactThumbnailURL } from "@util/utils"
import {useI18n} from "@/i18n/i18n"

let allArtifacts = Object.values(artifactsData)
allArtifacts.sort((a: any, b: any) => {
    return b.maxStar - a.maxStar;
})
let allArtifactsName = allArtifacts.map((item: any) => {
    return {
        name: item.eng,
        // chs: item.chs,
        url: getArtifactThumbnailURL(item.eng),
        nameLocale: item.nameLocale,
    };
});
Object.freeze(allArtifactsName)


interface Emits {
    (e: "update:modelValue", value: string | string[]): void
}

const emits = defineEmits<Emits>()

interface Props {
    modelValue: string | string[],
    disabled?: boolean,
    shadcn?: boolean,
    anyOption?: boolean,
    multiple?: boolean,
    multipleLimit?: number,
    placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: "",
    disabled: false,
    anyOption: false,
    multiple: false,
    multipleLimit: 2,
    placeholder: "Select"
})

const { t, ta } = useI18n()
const uiOptions = computed(() => [
    ...(props.anyOption ? [{ value: 'any', label: t('misc.any') }] : []),
    ...allArtifactsName.map(item => ({ value: item.name, label: ta(item.nameLocale), icon: item.url })),
])
</script>

<style scoped>
.tn {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    object-fit: contain;
    border-radius: 50%;
    display: inline-block;
    margin-right: 8px;
}

.item {
    display: flex;
    align-items: center;
    min-height: 28px;
    min-width: 0;
}
</style>
