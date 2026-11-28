<template>
    <div>
        <div class="filters" :class="{ 'shadcn-filters': shadcn }">
<!--            <span>主词条：</span>-->
            <select-artifact-main-stat
                v-model="filterMainTag"
                :shadcn="shadcn"
                placeholder="主词条"
            ></select-artifact-main-stat>
<!--            <span>套装：</span>-->
            <select-artifact-set
                v-model="filterArtifactSetName"
                :shadcn="shadcn"
                any-option
                placeholder="套装"
            ></select-artifact-set>
        </div>

        <UiHoverPreview v-show="artifactListDisplayed.length > 0" target="button.art-card" class="artifacts art-hover-grid">
            <artifact-card
                v-for="artifact in artifactListDisplayed"
                :key="artifact.id"
                :item="artifact"
                :highlight-tags="highlightTags"
                @open="$emit('select', artifact.id)"
            ></artifact-card>
        </UiHoverPreview>
        <div v-show="artifactListDisplayed.length === 0" class="no-artifacts">
            <UiEmpty v-if="shadcn" />
            <el-empty v-else />
        </div>

        <PaginationRoot v-if="shadcn" v-model:page="currentPage" :items-per-page="PAGE_SIZE"
            :total="artifactListFiltered.length" :disabled="!artifactListFiltered.length" :sibling-count="1" show-edges>
            <PaginationList v-slot="{ items }" class="artifact-picker-pages">
                <PaginationPrev as-child><UiButton size="small" :aria-label="locale === 'en' ? 'Previous page' : '上一页'"><i-ep-arrow-left aria-hidden="true" /></UiButton></PaginationPrev>
                <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : `ellipsis-${index}`">
                    <PaginationListItem v-if="item.type === 'page'" :value="item.value" as-child>
                        <UiButton size="small">{{ item.value }}</UiButton>
                    </PaginationListItem>
                    <PaginationEllipsis v-else :index="index">…</PaginationEllipsis>
                </template>
                <PaginationNext as-child><UiButton size="small" :aria-label="locale === 'en' ? 'Next page' : '下一页'"><i-ep-arrow-right aria-hidden="true" /></UiButton></PaginationNext>
            </PaginationList>
        </PaginationRoot>
        <el-pagination
            v-else
            v-model:current-page="currentPage"
            :page-size="PAGE_SIZE"
            :total="artifactListFiltered.length"
            layout="prev, pager, next"
            :small="!deviceIsPC"
        ></el-pagination>
    </div>
</template>

<script setup lang="ts">
import { reactive, toRef } from 'vue'
import { deviceIsPC } from "@util/device"
import { PaginationEllipsis, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot } from 'radix-vue'

import SelectArtifactMainStat from "@c/select/SelectArtifactMainStat"
import SelectArtifactSet from "@c/select/SelectArtifactSet"
import ArtifactCard from "@/components/display/ArtifactCard.vue"
import UiHoverPreview from "@/components/ui/UiHoverPreview.vue"
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import type {ArtifactMainStatName, ArtifactPosition, ArtifactSetName, IArtifact} from "@/types/artifact"
import {useArtifactStore} from "@/store/pinia/artifact"
import {defaultArtifactSortFunction} from "@/utils/artifacts"
import {useI18n} from "@/i18n/i18n";

const PAGE_SIZE = 20

interface Props {
    position: ArtifactPosition | "any"
    highlightTags?: string[]
    shadcn?: boolean
    state?: { page: number; mainTag: ArtifactMainStatName | 'any'; setName: ArtifactSetName | 'any' }
}

const props = withDefaults(defineProps<Props>(), {
    position: "any"
})

interface Emits {
    (e: "select", artifactId: number): void
}

const emits = defineEmits<Emits>()

const artifactStore = useArtifactStore()

// all candidate artifacts
const artifactListUnfiltered = computed((): IArtifact[] => {
    if (props.position === "any") {
        return [...artifactStore.artifacts.value.values()]
    }
    let temp = artifactStore.artifactsByPosition.value[props.position]
    // console.log(props.position)
    return temp
})


// filter
const pickerState = props.state ?? reactive<NonNullable<Props['state']>>({ page: 1, mainTag: 'any', setName: 'any' })
const filterMainTag = toRef(pickerState, 'mainTag')
const filterArtifactSetName = toRef(pickerState, 'setName')

const artifactListFiltered = computed((): IArtifact[] => {
    let temp: IArtifact[] = []
    for (let item of artifactListUnfiltered.value) {
        if (!(filterMainTag.value === "any" || filterMainTag.value === item.mainTag.name)) {
            continue
        }
        if (!(filterArtifactSetName.value === "any" || filterArtifactSetName.value === item.setName)) {
            continue
        }

        temp.push(item)
    }

    temp.sort(defaultArtifactSortFunction)

    return temp
})

// pager
const currentPage = toRef(pickerState, 'page')
watch(() => artifactListFiltered.value.length, total => {
    if (props.shadcn) currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(total / PAGE_SIZE)))
}, { immediate: true })

const artifactListDisplayed = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE
    const end = Math.min(start + PAGE_SIZE, artifactListFiltered.value.length)

    return artifactListFiltered.value.slice(start, end)
})


// i18n
const { locale } = useI18n()
</script>

<style lang="scss" scoped>
// 候选圣遗物用圣遗物页的卡片；弹窗本身是卡片底色（cx-scope），卡片再深一层
.artifacts {
    --artifact-card-surface: var(--cx-step);
    margin: 14px 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    grid-auto-rows: max-content;
    gap: 10px;

    :deep(.art-card) {
        min-width: 0;
        background: var(--cx-step);
    }

    :deep(.art-subs span span),
    :deep(.art-name b) {
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
        overflow-wrap: anywhere;
    }

    :deep(.art-main) {
        background: var(--cx-step-2);
    }
}

.no-artifacts {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cx-dim);
}

.artifact-picker-pages { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.artifact-picker-pages :deep([data-selected]) { background: var(--cx-gold); border-color: var(--cx-gold); color: var(--cx-gold-on); }

.filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.shadcn-filters :deep(.select-trigger) { min-width: 0; max-width: 100%; }

@media only screen and (min-width: 992px) {
    .filters {
        align-items: center;
    }
}

@media only screen and (max-width: 992px) {
    .filters {
        .el-select {
            width: 100%;
        }
        :deep(.select-trigger) {
            width: 100%;
        }
    }
}

</style>
