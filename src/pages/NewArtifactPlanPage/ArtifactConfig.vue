<template>
    <div>
        <UiSearchInput v-if="search === undefined" v-model="searchString" class="standalone-search" :placeholder="t('misc.search')" />
        <div class="config-items" :class="{ 'standalone-list mona-scroll': search === undefined }">
            <article
                v-for="item in dataSearched"
                :key="item.name"
                class="item"
            >
                <div class="top">
                    <img :src="item.thumbnail" class="image" alt="" >
                    <div>
                        <h3 class="artifact-title">{{ item.title }}</h3>
                        <div>
                            <p v-if="hasConfig2(item)">
                                <span class="effect-title">{{ t("misc.art2") }}</span>
                                <span class="effect-body">{{ item.effect2 }}</span>
                            </p>
                            <p v-if="hasConfig4(item)">
                                <span class="effect-title">{{ t("misc.art4") }}</span>
                                <span class="effect-body">{{ item.effect4 }}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <DslParamFields
                    v-if="hasConfig2(item)"
                    :model-value="modelValue[item.snake]"
                    :configs="item.config2"
                    stacked class="artifact-effect-fields"
                    @update:modelValue="handleChangeValue(item.snake, $event)"
                />
                <DslParamFields
                    v-if="hasConfig4(item)"
                    :model-value="modelValue[item.snake]"
                    :configs="item.config4"
                    stacked class="artifact-effect-fields"
                    @update:modelValue="handleChangeValue(item.snake, $event)"
                />
            </article>
        </div>
    </div>
</template>

<script>
import Fuse from "fuse.js"

import { artifactsData } from "@artifact"

import { toSnakeCase, deepCopy } from "@util/common"
import { getArtifactThumbnail } from "@util/artifacts"

import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import DslParamFields from './DslParamFields.vue'
import {useI18n} from "@/i18n/i18n";

export default {
    name: "ArtifactConfig",
    components: {DslParamFields, UiSearchInput},
    props: ["modelValue", "excludeSets", "search"],
    emits: ["update:modelValue"],
    data() {
        return {
            searchString: ""
        }
    },
    computed: {
        data() {
            let results = []
            for (let name in artifactsData) {
                const d = artifactsData[name]
                const config4 = d.config4 ?? []
                const config2 = d.config2 ?? []
                const name2 = d.name2
                if (this.excludeSets?.includes(name2)) continue
                if (config4.length > 0 || config2.length > 0) {
                    results.push({
                        name: name2,
                        title: this.ta(d.nameLocale),
                        eng: d.eng,
                        snake: "config_" + toSnakeCase(name2),
                        config4: config4,
                        config2: config2,
                        effect4: this.ta(d.effect4),
                        effect2: this.ta(d.effect2),
                        thumbnail: getArtifactThumbnail(name),
                        // chs: d.chs,
                    })
                }
            }
            return results
        },

        dataSearched() {
            const query = this.search === undefined ? this.searchString : this.search
            if (query === "") {
                return this.data
            } else {
                const fuse = new Fuse(this.data, {
                    keys: ["title", "effect4", "effect2"]
                })
                const results = fuse.search(query)
                return results.map(x => x.item)
            }
        },
    },
    methods: {
        handleChangeValue(snake, value) {
            // console.log(snake, value)
            let temp = deepCopy(this.modelValue)
            temp[snake] = value
            this.$emit("update:modelValue", temp)
        },

        hasConfig2(item) {
            return item.config2 && item.config2.length > 0
        },

        hasConfig4(item) {
            return item.config4 && item.config4.length > 0
        }
    },
    setup() {
        const { t, ta } = useI18n()

        return {
            t, ta
        }
    }
}
</script>

<style scoped>
.standalone-search { margin-bottom: 12px; }
.config-items { display: grid; gap: 10px; padding-bottom: 12px; }
.standalone-list { max-height: 60vh; overflow: auto; }
.item { display: grid; gap: 10px; min-width: 0; padding: 12px; border: 1px solid var(--cx-step-2); border-radius: 12px; background: var(--cx-step); }
.top { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.image { flex: none; width: 40px; height: 40px; object-fit: contain; }
.artifact-title { margin: 0 0 4px; font-size: 14px; }
.top p { margin: 3px 0 0; color: var(--cx-dim); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
.effect-title { color: var(--cx-gold); }
.artifact-effect-fields { padding-top: 10px; border-top: 1px solid var(--cx-step-2); }
</style>
