<template>
    <ArtifactPromptDialog ref="prompt" />
    <UiDialog :title="t('artPage.newArt')" :model-value="props.modelValue" :return-focus="returnFocus" top="15vh"
        @update:model-value="emits('update:modelValue', $event)" :width="deviceIsPC ? '80%' : '90%'">
        <h3 class="item-title">{{ t('misc.artSet') }}</h3>
        <div class="wide-picker"><ChooseArtifactSet :model-value="setName" @update:model-value="handleSetNameChange" /></div>
        <div class="narrow-picker">
            <SelectArtifactSet shadcn :model-value="setName" :placeholder="t('misc.artifactSet')"
                @update:model-value="handleSetNameChange($event as ArtifactSetName)" />
        </div>

        <h3 class="item-title">{{ t('misc.artSlot') }}</h3>
        <div class="wide-picker"><ChooseArtifactPosition v-model="position" :set-name="setName" /></div>
        <div class="narrow-picker"><SelectArtifactSlot v-model="position" /></div>

        <div class="add-columns">
            <div>
                <h3 class="item-title">{{ t('misc.quality') }}</h3>
                <ArtifactStarField :model-value="star" :min="artifactData.minStar" :max="artifactData.maxStar"
                    @update:model-value="handleStarChange" />
            </div>
            <div>
                <h3 class="item-title">{{ t('misc.lvl') }}</h3>
                <ArtifactLevelField v-model="level" :max="star * 4" slider />
            </div>
        </div>

        <div class="add-columns">
            <div>
                <h3 class="item-title">{{ t('misc.mainStat') }}</h3>
                <SelectArtifactMainTag :model-value="mainTag" :position="position" @update:model-value="handleMainTagChange" />
            </div>
            <div>
                <div class="sub-stat-heading">
                    <h3 class="item-title">{{ t('misc.subStat') }}</h3>
                    <UiButton size="small" :title="t('misc.random')" :aria-label="t('misc.random')" @click="shuffleNormalTags">
                        <IconEpRefresh aria-hidden="true" />
                    </UiButton>
                </div>
                <SelectArtifactNormalTag v-model="normalTags" />
            </div>
        </div>

        <template #footer>
            <div class="add-actions">
                <UiButton @click="emits('update:modelValue', false)">{{ t('misc.cancel') }}</UiButton>
                <UiButton variant="primary" @click="onConfirm">{{ t('misc.confirm') }}</UiButton>
            </div>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { ref, type Ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import ArtifactStarField from '../ArtifactStarField.vue'
import ArtifactLevelField from '../ArtifactLevelField.vue'
import ArtifactPromptDialog from '../ArtifactPromptDialog.vue'

import ChooseArtifactSet from "./ChooseArtifactSet"
import ChooseArtifactPosition from "./ChooseArtifactPosition"
import SelectArtifactNormalTag from "./SelectArtifactNormalTag"
import SelectArtifactMainTag from "./SelectArtifactMainTag"
import SelectArtifactSet from "@c/select/SelectArtifactSet"
import SelectArtifactSlot from "@c/select/SelectArtifactSlot"

import { getDetailName, getArtifactRealValue } from "@util/utils"
import randomNormalTag from "@/artifacts_numeric/random_normal_tag"
import { convertDisplayTagValue } from '@util/utils'
import { artifactsData } from "@asset/artifacts"
import { artifactTags } from "@const/artifact"
import type {ArtifactPosition, ArtifactSetName, IArtifactContentOnly, IArtifactTag} from "@/types/artifact"
import { isArtifactExists } from "@/utils/artifacts"
import {deviceIsPC} from "@/utils/device"

import IconEpRefresh from "~icons/ep/refresh"
import {useI18n} from "@/i18n/i18n";

const prompt = ref<InstanceType<typeof ArtifactPromptDialog> | null>(null)

const { t } = useI18n()


interface Props {
    modelValue: boolean
    returnFocus?: () => void
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: false
})


interface Emits {
    (e: "update:modelValue", v: boolean): void,
    (e: "confirm", v: IArtifactContentOnly): void
}
const emits = defineEmits<Emits>()

function convertPercentage(item: IArtifactTag) {
    item.value = getArtifactRealValue(item.name, item.value);

    return item;
}

const setName: Ref<ArtifactSetName> = ref("archaicPetra")
const position: Ref<ArtifactPosition> = ref("flower")

interface IArtifactTagString {
    name: string,
    value: string
}

const mainTag: Ref<IArtifactTagString> = ref({
    name: "lifeStatic",
    value: "4780"
})
const normalTags: Ref<IArtifactTagString[]> = ref([])

const star = ref(5)
const level = ref(20)

const artifactData = computed((): any => {
    return artifactsData[setName.value];
})

function handleStarChange(e: number) {
    if (e >= artifactData.value.minStar && e <= artifactData.value.maxStar) {
        star.value = e;
        level.value = star.value * 4;
    }
}

function handleMainTagChange(e: IArtifactTagString) {
    if (e.name !== mainTag.value.name) {
        // let maxValue = secondaryTags[e.name].max[5];
        const maxValue = artifactTags[e.name].max[5]

        mainTag.value.value = convertDisplayTagValue(e.name, maxValue);
        mainTag.value.name = e.name;
    } else {
        mainTag.value = e;
    }
}

function handleSetNameChange(e: ArtifactSetName) {
    setName.value = e;
    star.value = artifactData.value.maxStar;
    level.value = star.value * 4;
}

function getArtifact(): IArtifactContentOnly {
    return {
        setName: setName.value,
        position: position.value,
        mainTag: getArtifactMainTag(),
        normalTags: getArtifactNormalTags(),
        star: star.value,
        level: level.value,
    }
}

function getArtifactMainTag(): IArtifactTag {
    let temp: IArtifactTag = {
        name: mainTag.value.name,
        value: parseFloat(mainTag.value.value)
    }

    if (isNaN(temp.value)) {
        temp.value = 0;
    }

    convertPercentage(temp);
    return temp
}

function getArtifactNormalTags(): IArtifactTag[] {
    let temp = [];
    for (let item of normalTags.value) {
        if (item.value === "" || item.value === "0") {
            continue;
        }

        let tag = {
            name: item.name,
            value: parseFloat(item.value)
        } as IArtifactTag
        convertPercentage(tag)
        temp.push(tag);
    }

    return temp;
}

function shuffleNormalTags() {
    let temp = randomNormalTag(5, 20, [mainTag.value.name]);
    for (let i = 0, l = temp.length; i < l; i++) {
        temp[i].value = convertDisplayTagValue(temp[i].name, temp[i].value);
    }

    normalTags.value = temp;
}

function onConfirm() {
    let result = getArtifact()

    if (isArtifactExists(result)) {
        prompt.value?.confirm(t('artPage.dup'), t('misc.hint'), {
            confirmButtonText: t('misc.cont'),
            cancelButtonText: t('misc.cancel'),
        }).then(() => emits('confirm', result), () => {})
    } else {
        emits("confirm", result)
    }
}


</script>

<style scoped>
.item-title { font-size: 14px; }
.add-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.sub-stat-heading { display: flex; align-items: center; gap: 8px; }
.add-actions { display: flex; justify-content: flex-end; gap: 8px; }
.narrow-picker { display: none; }
.narrow-picker :deep([role="combobox"]) { width: 100%; }
@media (max-width: 991px) {
    .add-columns { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .wide-picker { display: none; }
    .narrow-picker { display: block; }
}
</style>
