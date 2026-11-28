<template>
    <div>
        <div v-for="index in 4" :key="index" class="item">
            <ArtifactStatField :model-value="displayedValue[index - 1]" :label="t('misc.subStat')"
                :percentage="isPercentage[index - 1]" @update:model-value="handleValueChange(index - 1, $event)">
                <UiSelect :model-value="names[index - 1]" :label="t('misc.subStat')" :options="tagOptions"
                    @update:model-value="handleTagChange(index - 1, $event as ArtifactSubStatName)" />
            </ArtifactStatField>
            <UiButton size="small" class="del-button" :aria-label="t('misc.del')" @click="deleteItem(index - 1)">
                <IconEpDelete aria-hidden="true" />
            </UiButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import ArtifactStatField from '@/components/input/ArtifactStatField.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { deepCopy } from "@/utils/common"
import { subStats, artifactTags } from "@/constants/artifact"
import type {ArtifactSubStatName} from "@/types/artifact"
import IconEpDelete from "~icons/ep/delete"
import {useI18n} from "@/i18n/i18n"

const { t } = useI18n()

const tagOptions = computed(() => subStats.map(value => ({ value, label: t('stat', value) })))

interface StringStat {
    name: ArtifactSubStatName | null,
    value: string
}

type Entry = StringStat | null

interface Props {
    modelValue: Entry[]
}

const props = defineProps<Props>()

interface Emits {
    (e: "update:modelValue", v: Entry[]): void
}

const emits = defineEmits<Emits>()

function handleValueChange(index: number, value: string) {
    if (!props.modelValue[index]) {
        return
    }

    let temp = deepCopy(props.modelValue);
    temp[index].value = value;

    emits("update:modelValue", temp)
}

function handleTagChange(index: number, value: ArtifactSubStatName) {
    let temp = deepCopy(props.modelValue);
    if (props.modelValue[index] && (props.modelValue[index] as any).name) {
        temp[index].name = value;
    } else {
        temp.push({
            name: value,
            value: 0,
        });
    }

    emits("update:modelValue", temp)
}

function deleteItem(index: number) {
    let temp = []
    for (let i = 0; i < props.modelValue.length; i++) {
        if (i !== index) {
            temp.push(deepCopy(props.modelValue[i]))
        }
    }

    emits("update:modelValue", temp)
}

const isPercentage = computed(() => {
    let temp = [];

    for (let i = 0; i < 4; i++) {
        try {
            temp.push(artifactTags[props.modelValue[i]?.name as any].percentage);
        } catch(e) {
            temp.push(false);
        }
    }

    return temp;
})

const displayedValue = computed(() => {
    let temp = [];
    for (let i = 0; i < 4; i++) {
        try {
            // @ts-ignore
            let x = props.modelValue[i].value;
            temp.push(x);
        } catch(e) {
            temp.push("0");
        }
    }

    return temp;
})

const names = computed(() => {
    let temp = [];
    for (let i = 0; i < 4; i++) {
        try {
            // @ts-ignore
            let x = props.modelValue[i].name;
            temp.push(x);
        } catch(e) {
            temp.push("");
        }
    }

    return temp;
})
</script>

<style scoped>
.item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}

.del-button {
    min-width: 30px;
    padding: 0;
    margin-left: 8px;
}
</style>