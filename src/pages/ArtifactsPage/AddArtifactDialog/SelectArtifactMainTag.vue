<template>
    <ArtifactStatField :model-value="modelValue.value" :label="t('misc.mainStat')"
        :percentage="isPercentage" @update:model-value="handleValueChange">
        <UiSelect :model-value="modelValue.name" :label="t('misc.mainStat')" :options="tagOptions" @update:model-value="handleTagChange" />
    </ArtifactStatField>
</template>

<script>
import ArtifactStatField from '@/components/input/ArtifactStatField.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { artifactsTagMap } from "@asset/artifacts";
import { artifactTags } from "@const/artifact";
import {useI18n} from "@/i18n/i18n";
// import { convertDisplayTagValue } from "@util/utils";

const tagData = {
    flower: artifactsTagMap["flower"].map(item => artifactTags[item]),
    feather: artifactsTagMap["feather"].map(item => artifactTags[item]),
    sand: artifactsTagMap["sand"].map(item => artifactTags[item]),
    cup: artifactsTagMap["cup"].map(item => artifactTags[item]),
    head: artifactsTagMap["head"].map(item => artifactTags[item]),
}

export default {
    name: "SelectArtifactMainTag",
    props: {
        modelValue: {
            type: Object,
            required: true,
        },
        position: {
            type: String,
        },
    },
    components: { ArtifactStatField, UiSelect },
    emits: ["update:modelValue"],
    methods: {
        handleTagChange(event) {
            let temp = Object.assign({}, this.modelValue);
            temp.name = event;

            this.$emit("update:modelValue", temp);
        },

        handleValueChange(event) {
            let temp = Object.assign({}, this.modelValue);
            temp.value = event;

            this.$emit("update:modelValue", temp);
        }
    },
    computed: {
        // valid tags corespond to position
        validTags() {
            if (this.position === "") {
                return [];
            }

            return tagData[this.position];
        },

        tagOptions() {
            return this.validTags.map(tag => ({ value: tag.name, label: this.t('stat', tag.name) }))
        },

        isPercentage() {
            if (!this.modelValue.name) {
                return false;
            }
            return artifactTags[this.modelValue.name].percentage;
        },
    },
    watch: {
        position() {
            if (artifactsTagMap[this.position].indexOf(this.modelValue.name) === -1) {
                // the last selected tag does not exist on the new position
                let autoSelectedTagName = artifactsTagMap[this.position][0];
                let temp = Object.assign({}, this.modelValue);
                temp.name = autoSelectedTagName;
                this.$emit("update:modelValue", temp);
            }
        },
    },
    setup() {
        const { t } = useI18n()

        return {
            t
        }
    }
}
</script>
