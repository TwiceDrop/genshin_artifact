<template>
    <div class="kumi-page cx-scope cx-page-frame">
        <ArtifactPromptDialog ref="promptDialog" width="min(420px, calc(100vw - 32px))" />
        <UiDialog
            v-model="showSelectArtifactDialog"
            :title="t('kumiPage.selectArt')"
            :width="phoneLayout ? 'calc(100% - 16px)' : deviceIsPC ? '80%' : '90%'"
            :max-width="phoneLayout ? 'calc(100% - 16px)' : undefined"
            :max-height="phoneLayout ? 'calc(100dvh - 24px)' : undefined"
            :top="phoneLayout ? '8px' : '15vh'"
        >
            <select-artifact
                shadcn
                :position="artifactPositionToBeSelected"
                :state="pickerState"
                :highlight-tags="groupHighlights.get(underSelectionKumiId)"
                @select="handleSelectArtifact"
            ></select-artifact>
        </UiDialog>

        <div class="kumi-layout">
            <aside class="kumi-folders cx-panel" aria-labelledby="kumi-folders-title">
                <header class="cx-panel-heading"><h2 id="kumi-folders-title" class="cx-panel-title">收藏夹</h2></header>
                <div class="kumi-folder-body cx-panel-body">
                    <button type="button" class="kumi-new-folder" @click="handleNewDir">＋ 新建收藏夹</button>
                    <nav class="kumi-folder-list">
                        <button v-for="dir in dirItems" :key="dir.index" type="button" :aria-pressed="currentDirId === dir.index"
                                @click="currentDirId = dir.index">
                            <icon-ep-folder aria-hidden="true" />
                            <span>{{ dir.title }}</span>
                            <small>{{ kumiStore.kumisByDirId.value[dir.index]?.length ?? 0 }}</small>
                        </button>
                    </nav>
                </div>
            </aside>

            <section class="kumi-main">
                <header class="kumi-bar cx-panel" data-tour="kumi.header">
                    <div class="cx-panel-heading cx-panel-heading--page">
                        <h2 class="cx-panel-title">{{ currentDirTitle }}</h2>
                        <span class="kumi-count">{{ currentKumiList.length }} 组</span>
                        <PageGuideButton guide-id="detail-artifacts" />
                    </div>
                    <div class="kumi-actions cx-panel-body">
                        <UiSearchInput v-model="searchString" class="kumi-search" :placeholder="t('misc.search')" />
                        <UiDropdownMenu>
                            <template #trigger>
                                <button type="button" class="kumi-btn">更多 <icon-ep-arrow-down aria-hidden="true" /></button>
                            </template>
                            <UiDropdownMenuItem v-if="phoneLayout" @select="nextTick(handleNewDir)">新建收藏夹</UiDropdownMenuItem>
                            <UiDropdownMenuItem v-if="currentDirId !== 0 && currentDirId !== 1" @select="nextTick(() => handleRenameDir(currentDirId))">重命名</UiDropdownMenuItem>
                            <UiDropdownMenuItem @select="nextTick(() => handleClearDir(currentDirId))">清空</UiDropdownMenuItem>
                            <UiDropdownMenuItem v-if="currentDirId !== 0 && currentDirId !== 1" divided @select="nextTick(() => handleDeleteDir(currentDirId))">删除收藏夹</UiDropdownMenuItem>
                        </UiDropdownMenu>
                        <button type="button" class="kumi-add" @click="handleNewKumi">＋ 新建套装</button>
                    </div>
                </header>

                <div v-if="filteredKumiList.length > 0" class="kumi-grid">
                    <kumi-item
                        v-for="kumi in filteredKumiList"
                        :key="kumi.id"
                        :data="kumi"
                        :highlight-tags="groupHighlights.get(kumi.id)"
                        @delete="handleDeleteKumi(kumi.id)"
                        @edit="handleEditKumi(kumi.id)"
                        @click="handleClickPosition(kumi.id, $event)"
                        @deleteArtifact="handleDeleteArtifact(kumi.id, $event)"
                    ></kumi-item>
                </div>
                <UiEmpty v-else />
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import Fuse from "fuse.js"
import { nextTick, reactive } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import IconEpFolder from "~icons/ep/folder"
import IconEpArrowDown from "~icons/ep/arrow-down"
import ArtifactPromptDialog from '@/pages/ArtifactsPage/ArtifactPromptDialog.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiDropdownMenu from '@/components/ui/UiDropdownMenu.vue'
import UiDropdownMenuItem from '@/components/ui/UiDropdownMenuItem.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'

import KumiItem from "./KumiItem"
import SelectArtifact from "@/components/select/SelectArtifact"
import {useKumiStore} from "@/store/pinia/kumi"
import {artifactGroupHighlights} from "@/utils/character-artifact-highlights"
import type {KumiItem as TypeKumiItem} from "@/types/kumi"
import {deviceIsPC} from "@/utils/device"

import type {ArtifactMainStatName, ArtifactPosition, ArtifactSetName} from "@/types/artifact"
import {useI18n} from "@/i18n/i18n";


const kumiStore = useKumiStore()
const promptDialog = ref<InstanceType<typeof ArtifactPromptDialog> | null>(null)
const phoneLayout = useMediaQuery('(max-width: 767px)')


// i18n
const { t } = useI18n()


// dirs
interface DirItem {
    index: number,
    title: string
}

const currentDirId = ref(0)

const dirItems = computed((): DirItem[] => {
    let temp = []
    for (let dir of kumiStore.dirs.value) {
        temp.push({
            index: dir.id,
            title: dir.title
        })
    }
    // console.log(temp)
    return temp
})

const currentDirTitle = computed(() => {
    const item = kumiStore.itemById(currentDirId.value)
    if (item) {
        return item.title
    }

    return "title"
})

function handleNewDir() {
    promptDialog.value?.prompt(t("kumiPage.enterFolder"), t("kumiPage.newFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.createDir(value)
        }
    }, () => {})
}

function handleDeleteDir(id: number) {
    if (id === 0 || id === 1) {
        return
    }
    promptDialog.value?.confirm(t("kumiPage.confirmDelete"), t("kumiPage.deleteFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(() => {
        kumiStore.deleteDir(id)
        currentDirId.value = 0
    }, () => {})
}

function handleRenameDir(id: number) {
    promptDialog.value?.prompt(t("kumiPage.enterFolder"), t("kumiPage.renameFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.rename(id, value)
        }
    }, () => {})
}

function handleClearDir(id: number) {
    promptDialog.value?.confirm(t("kumiPage.confirmClear"), t("kumiPage.clearFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(() => {
        kumiStore.clearDir(id)
    }, () => {})
}

// kumis
const currentKumiList = computed((): TypeKumiItem[] => {
    return kumiStore.kumisByDirId.value[currentDirId.value]
})
const groupHighlights = computed(() => new Map(currentKumiList.value.map(group => [group.id, artifactGroupHighlights(group.title)] as const)))

function handleNewKumi() {
    promptDialog.value?.prompt(t("kumiPage.enterKumi"), t("kumiPage.newKumi"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.createKumi(currentDirId.value, value)
        }
    }, () => {})
}

function handleDeleteKumi(id: number) {
    promptDialog.value?.confirm(t("kumiPage.confirmDelete"), t("misc.hint"), {
        confirmButtonText: t("misc.del"),
        cancelButtonText: t("misc.cancel"),
        type: "warning"
    }).then(() => {
        kumiStore.deleteKumi(id)
    }, () => {})
}

function handleEditKumi(id: number) {
    promptDialog.value?.prompt(t("kumiPage.enterKumi"), t("kumiPage.renameKumi"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.rename(id, value)
        }
    }, () => {})
}


// search
const searchString = ref("")
const fuse = computed(() => {
    return new Fuse(currentKumiList.value, {
        keys: ["title"]
    })
})

const filteredKumiList = computed((): TypeKumiItem[] => {
    if (searchString.value === "") {
        return currentKumiList.value
    }
    const results = fuse.value.search(searchString.value)
    return results.map(x => x.item)
})


// artifact
const showSelectArtifactDialog = ref(false)
const pickerState = reactive<{ page: number; mainTag: ArtifactMainStatName | 'any'; setName: ArtifactSetName | 'any' }>({
    page: 1, mainTag: 'any', setName: 'any',
})
const artifactPositionToBeSelected = ref<ArtifactPosition>("flower")
const underSelectionKumiId = ref(0)

function handleSelectArtifact(id: number) {
    showSelectArtifactDialog.value = false
    kumiStore.addArtifact(underSelectionKumiId.value, id)
}

function handleDeleteArtifact(kumiId: number, artifactId: number) {
    kumiStore.deleteArtifact(kumiId, artifactId)
}

function handleClickPosition(kumiId: number, position: ArtifactPosition) {
    artifactPositionToBeSelected.value = position
    showSelectArtifactDialog.value = true
    underSelectionKumiId.value = kumiId
}


</script>

<style scoped lang="scss">
.kumi-layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
}

.kumi-folders {
    position: sticky;
    top: 16px;
}

.kumi-folder-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.kumi-new-folder {
    height: 42px;
    border: 0;
    border-radius: 12px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font: inherit;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }
}

.kumi-folder-list {
    display: flex;
    flex-direction: column;
    gap: 4px;

    button {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 42px;
        padding: 8px 12px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--cx-dim);
        font: inherit;
        text-align: left;
        cursor: pointer;

        span {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        small {
            font-variant-numeric: tabular-nums;
        }

        &:hover {
            background: var(--cx-step);
            color: var(--cx-letter);
        }

        &[aria-pressed=true] {
            background: var(--cx-step-2);
            color: var(--cx-letter);
            font-weight: 600;

            svg {
                color: var(--cx-gold);
            }
        }
    }
}

.kumi-bar {
    margin-bottom: 14px;
}

.kumi-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.kumi-count {
    color: var(--cx-dim);
}

.kumi-search {
    width: 220px;

    :deep([data-slot="input"]) {
        min-height: 32px;
    }
}

.kumi-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font: inherit;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }
}

.kumi-add {
    height: 42px;
    padding: 0 20px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-gold);
    color: var(--cx-gold-on);
    font: inherit;
    font-weight: 700;
    cursor: pointer;

    &:hover {
        filter: brightness(1.08);
    }
}

.kumi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr));
    gap: 14px;
}

.kumi-page button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

@media (max-width: 767px) {
    .kumi-layout {
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
    }

    // 收藏夹变成横向滑动的标签
    .kumi-folders {
        position: static;
    }

    .kumi-new-folder {
        display: none;
    }

    .kumi-folder-list {
        flex-direction: row;
        overflow-x: auto;
        scrollbar-width: none;

        button {
            flex: none;
            min-height: 38px;
            border-radius: 999px;
            background: var(--cx-step);

            &[aria-pressed=true] {
                background: var(--cx-gold);
                color: var(--cx-gold-on);

                svg {
                    color: var(--cx-gold-on);
                }
            }
        }
    }

    .kumi-search {
        order: 5;
        width: 100%;

        :deep([data-slot="input"]) {
            min-height: 40px;
        }
    }

    .kumi-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

</style>
