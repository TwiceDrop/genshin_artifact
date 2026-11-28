<template>
    <ArtifactStatField :model-value="modelValue.value" :label="label" :percentage="isPercent" @update:model-value="handleChangeValue">
        <SelectArtifactMainStat shadcn :include-any="false" :position="position" :model-value="name"
            :placeholder="label" @update:model-value="handleChangeName" />
    </ArtifactStatField>
</template>

<script>
import ArtifactStatField from './ArtifactStatField.vue'
import { useI18n } from '@/i18n/i18n'
import { artifactTags } from "@const/artifact"

import SelectArtifactMainStat from "@c/select/SelectArtifactMainStat"

export default {
    name: "InputArtifactMainStat",
    props: ["modelValue", "position"],
    emits: ["update:modelValue"],
    components: {
        ArtifactStatField,
        SelectArtifactMainStat
    },
    setup() {
        const { t } = useI18n()
        return { label: t('misc.mainStat') }
    },
    methods: {
        handleChangeName(name) {
            if (name !== this.modelValue.name) {
                let value = artifactTags[name].max[5]
                const isPercent = artifactTags[name].percentage
                if (isPercent) {
                    value *= 100
                }

                this.$emit("update:modelValue", { name, value })
            }
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
        },

        name() {
            return this.modelValue.name
        },

        // displayedValue() {
        //     if (this.isPercent) {
        //         return (this.value.value * 100)
        //     } else {
        //         return this.value.value
        //     }
        // }
    }
}
</script>

<style scoped>

</style>