<template>
    <div>
        <div class="section title">
            <img :src="image" class="title-image" alt="">
            <span class="title-name">{{ title }}</span>
        </div>

        <Separator class="edit-divider" />

        <div class="edit-config">
            <div class="edit-columns">
                <div>
                    <p class="config-title">{{ t('misc.artifactSet') }}</p>
                    <SelectArtifactSet v-model="setName" shadcn :placeholder="t('misc.artifactSet')" />
                </div>
                <div>
                    <p class="config-title">{{ t('misc.artSlot') }}</p>
                    <SelectArtifactSlot :model-value="position" @update:model-value="handleChangePosition" />
                </div>
            </div>
            <div class="edit-columns">
                <div>
                    <p class="config-title">{{ t('misc.quality') }}</p>
                    <ArtifactStarField v-model="star" />
                </div>
                <div>
                    <p class="config-title">{{ t('misc.lvl') }}</p>
                    <ArtifactLevelField v-model="level" :max="20" />
                </div>
            </div>
        </div>

        <Separator class="edit-divider" />

        <div class="section">
            <p class="config-title">{{ t('misc.stat') }}</p>
            <InputArtifactMainStat v-model="mainStat" style="margin-bottom: 24px" />
            <div class="sub-stat-div">
                <div v-for="(sub, index) in subStats" :key="index" class="sub-stat-item">
                    <InputArtifactSubStat v-model="subStats[index]" />
                    <UiButton variant="danger" :aria-label="t('misc.del')" @click="handleRemoveSubStat(index)">
                        <IconEpDelete aria-hidden="true" />
                    </UiButton>
                </div>
            </div>
        </div>

        <Separator class="edit-divider" />

        <div class="section edit-columns edit-actions">
            <UiButton variant="primary" class="button" @click="emits('confirm', artifactId)">{{ t('misc.confirm') }}</UiButton>
            <UiButton class="button" @click="emits('cancel')">{{ t('misc.cancel') }}</UiButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Separator } from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import ArtifactStarField from './ArtifactStarField.vue'
import ArtifactLevelField from './ArtifactLevelField.vue'

import {getArtifact, getArtifactImage, positionToIndex} from "@/utils/artifacts"
import { artifactsData } from "@artifact"
import { artifactTags, mainStatMap } from "@/constants/artifact"
import { positions } from "@/constants/artifact"

import InputArtifactSubStat from "@/components/input/InputArtifactSubStat.vue"
import InputArtifactMainStat from "@c/input/InputArtifactMainStat"
import SelectArtifactSet from "@c/select/SelectArtifactSet"
import SelectArtifactSlot from "@c/select/SelectArtifactSlot"
import type {
    ArtifactPosition,
    ArtifactSetName,
    IArtifactTag,
    ArtifactSubStatName,
    ArtifactMainStat
} from "@/types/artifact"
import type { ArtifactStatName } from "@/types/artifact"

import IconEpDelete from "~icons/ep/delete"
import {useI18n} from "@/i18n/i18n";


const { t, ta } = useI18n()

interface Emits {
    (e: "update:modelValue", v: any): void,
    (e: "confirm", id: number): void,
    (e: "cancel"): void
}

const emits = defineEmits<Emits>()


const artifactId = ref(-1)

const setName = ref<ArtifactSetName>("berserker")
const star = ref(5)
const level = ref(20)
const position = ref<ArtifactPosition>("flower")
const mainStat = ref<any>({ name: "attackStatic", value: 0 })

interface ArtifactStatNullable {
    name: null | ArtifactSubStatName,
    value: number
}
const subStats = ref<ArtifactStatNullable[]>([
    { name: null, value: 0 },
    { name: null, value: 0 },
    { name: null, value: 0 },
    { name: null, value: 0 },
])

function convertStat(stat: IArtifactTag) {
    const data = artifactTags[stat.name]
    if (data.percentage) {
        // return { name: stat.name, value: stat.value * 100 }
        return { name: stat.name, value: (stat.value * 100).toFixed(1) }
    } else {
        return { name: stat.name, value: stat.value }
    }
}

function handleChangePosition(p: ArtifactPosition) {
    position.value = p

    const mainStatList = mainStatMap[p]
    if (mainStatList.indexOf(mainStat.value.name) < 0) {
        const newMainStatName = mainStatList[0]
        const newMainStatValue = artifactTags[newMainStatName].max["5"]

        mainStat.value = convertStat({
            name: newMainStatName,
            value: newMainStatValue
        })
    }
}

function handleRemoveSubStat(index: number) {
    subStats.value[index] = { name: null, value: 0 }
}

function convertStatBack(stat: any) {
    if (!stat.name || !stat.value) {
        return null
    }

    const data = artifactTags[stat.name as ArtifactStatName]
    let value = parseFloat(stat.value)
    if (data.percentage) {
        value /= 100
    }
    if (isNaN(value)) {
        return null
    }

    return { name: stat.name, value }
}


const image = computed(() => {
    return getArtifactImage(setName.value, position.value)
})

const title = computed(() => {
    const data = artifactsData[setName.value]
    return ta(data[position.value]?.text)
})

watch(() => setName.value, (newValue, oldValue) => {
    if (newValue === oldValue) {
        return
    }

    const data = artifactsData[newValue]
    if (!data[position.value]) {
        for (let p of positions) {
            if (data[p]) {
                position.value = p
                break
            }
        }
    }
})


function setId(id: number) {
    const artifact = getArtifact(id)

    if (artifact) {
        artifactId.value = artifact.id
        setName.value = artifact.setName
        star.value = artifact.star
        level.value = artifact.level
        position.value = artifact.position
        mainStat.value = convertStat(artifact.mainTag)

        let ss: any = []
        for (let stat of artifact.normalTags) {
            ss.push(convertStat(stat))
        }
        while (ss.length < 4) {
            ss.push({ name: null, value: 0 })
        }
        subStats.value = ss
    }
}

function getNewArtifact() {
    const ms = convertStatBack(mainStat.value)
    let ss = []
    for (let stat of subStats.value) {
        const convertResult = convertStatBack(stat)
        if (convertResult) {
            ss.push(convertResult)
        }
    }

    return {
        setName: setName.value,
        star: star.value,
        level: level.value,
        position: position.value,
        mainTag: ms,
        normalTags: ss
    }
}

defineExpose({
    setId,
    getNewArtifact
})
</script>

<style scoped lang="scss">
.edit-divider { height: 1px; margin: 24px 0; background: var(--cx-step-2); }
.edit-config { padding: 0 20px; }
.edit-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.edit-columns :deep([role="combobox"]) { max-width: 100%; }
.edit-actions { gap: 12px; }

.sub-stat-item {
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 18px;

    &:last-of-type {
        margin-bottom: 0;
    }
}

.title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title-image {
        width: 64px;
        height: 64px;
    }

    .title-name {
        font-size: 14px;
    }
}

.config-title {
    font-size: 12px;
}

.section {
    padding: 0 24px;
}

.button {
    width: 100%;
}
</style>