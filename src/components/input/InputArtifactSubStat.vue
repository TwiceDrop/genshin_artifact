<template>
    <ArtifactStatField :model-value="modelValue.value" :label="label" :percentage="isPercent" @update:model-value="handleChangeValue">
        <SelectArtifactSubStat :model-value="modelValue.name" @update:model-value="handleChangeName" />
    </ArtifactStatField>
</template>

<script>
import ArtifactStatField from './ArtifactStatField.vue'
import { useI18n } from '@/i18n/i18n'
import { artifactTags } from "@const/artifact"

import SelectArtifactSubStat from "@c/select/SelectArtifactSubStat"

export default {
    name: "InputArtifactSubStat",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    components: {
        ArtifactStatField,
        SelectArtifactSubStat
    },
    setup() {
        const { t } = useI18n()
        return { label: t('misc.subStat') }
    },
    methods: {
        handleChangeName(name) {
            let temp = {
                name,
                value: this.modelValue.value
            }

            this.$emit("update:modelValue", temp)
        },

        handleChangeValue(value) {
            this.$emit("update:modelValue", { name: this.modelValue.name, value })
        }
    },
    computed: {
        isPercent() {
            if (!this.modelValue.name) {
                return false
            }
            return artifactTags[this.modelValue.name].percentage
        }
    }
}
</script>

<style scoped>

</style>