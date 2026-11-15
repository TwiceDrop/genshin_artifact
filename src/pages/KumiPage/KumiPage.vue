<template>
    <div class="kumi-page cx-scope">
        <el-dialog
            v-model="showSelectArtifactDialog"
            custom-class="cx-scope"
            :title="t('kumiPage.selectArt')"
            :width="deviceIsPC ? '80%' : '90%'"
        >
            <select-artifact
                :position="artifactPositionToBeSelected"
                @select="handleSelectArtifact"
            ></select-artifact>
        </el-dialog>

        <div class="kumi-layout">
            <aside class="kumi-folders" aria-label="收藏夹">
                <button type="button" class="kumi-new-folder" @click="handleNewDir">＋ 新建收藏夹</button>
                <nav class="kumi-folder-list">
                    <button v-for="dir in dirItems" :key="dir.index" type="button" :aria-pressed="currentDirId === dir.index"
                            @click="currentDirId = dir.index">
                        <icon-ep-folder aria-hidden="true" />
                        <span>{{ dir.title }}</span>
                        <small>{{ kumiStore.kumisByDirId.value[dir.index]?.length ?? 0 }}</small>
                    </button>
                </nav>
            </aside>

            <section class="kumi-main">
                <header class="kumi-bar">
                    <h2>{{ currentDirTitle }}</h2>
                    <span class="kumi-count">{{ currentKumiList.length }} 组</span>
                    <span class="kumi-spacer"></span>
                    <el-input v-model="searchString" class="kumi-search" :placeholder="t('misc.search')" clearable>
                        <template #prefix><icon-ep-search aria-hidden="true" /></template>
                    </el-input>
                    <el-dropdown trigger="click" @command="handleCommand">
                        <button type="button" class="kumi-btn">更多 <icon-ep-arrow-down aria-hidden="true" /></button>
                        <template #dropdown><el-dropdown-menu>
                            <el-dropdown-item command="add" class="kumi-narrow-only">新建收藏夹</el-dropdown-item>
                            <el-dropdown-item v-if="currentDirId !== 0 && currentDirId !== 1" command="rename">重命名</el-dropdown-item>
                            <el-dropdown-item command="clear">清空</el-dropdown-item>
                            <el-dropdown-item v-if="currentDirId !== 0 && currentDirId !== 1" command="delete" divided>删除收藏夹</el-dropdown-item>
                        </el-dropdown-menu></template>
                    </el-dropdown>
                    <button type="button" class="kumi-add" @click="handleNewKumi">＋ 新建套装</button>
                </header>

                <div v-if="filteredKumiList.length > 0" class="kumi-grid">
                    <kumi-item
                        v-for="kumi in filteredKumiList"
                        :key="kumi.id"
                        :data="kumi"
                        @delete="handleDeleteKumi(kumi.id)"
                        @edit="handleEditKumi(kumi.id)"
                        @click="handleClickPosition(kumi.id, $event)"
                        @deleteArtifact="handleDeleteArtifact(kumi.id, $event)"
                    ></kumi-item>
                </div>
                <el-empty v-else></el-empty>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import Fuse from "fuse.js"
import IconEpFolder from "~icons/ep/folder"
import IconEpSearch from "~icons/ep/search"
import IconEpArrowDown from "~icons/ep/arrow-down"

import KumiItem from "./KumiItem"
import SelectArtifact from "@/components/select/SelectArtifact"
import {useKumiStore} from "@/store/pinia/kumi"
import type {KumiItem as TypeKumiItem} from "@/types/kumi"
import {deviceIsPC} from "@/utils/device"

import type {ArtifactPosition} from "@/types/artifact"
import {useI18n} from "@/i18n/i18n";


const kumiStore = useKumiStore()


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
    ElMessageBox.prompt(t("kumiPage.enterFolder"), t("kumiPage.newFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.createDir(value)
        }
    }).catch(() => {})
}

function handleDeleteDir(id: number) {
    if (id === 0 || id === 1) {
        return
    }
    ElMessageBox.confirm(t("kumiPage.confirmDelete"), t("kumiPage.deleteFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(() => {
        kumiStore.deleteDir(id)
        currentDirId.value = 0
    })
}

function handleRenameDir(id: number) {
    ElMessageBox.prompt(t("kumiPage.enterFolder"), t("kumiPage.renameFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.rename(id, value)
        }
    }).catch(() => {})
}

function handleClearDir(id: number) {
    ElMessageBox.confirm(t("kumiPage.confirmClear"), t("kumiPage.clearFolder"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(() => {
        kumiStore.clearDir(id)
    })
}

// kumis
const currentKumiList = computed((): TypeKumiItem[] => {
    return kumiStore.kumisByDirId.value[currentDirId.value]
})

function handleNewKumi() {
    ElMessageBox.prompt(t("kumiPage.enterKumi"), t("kumiPage.newKumi"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.createKumi(currentDirId.value, value)
        }
    }).catch(() => {})
}

function handleDeleteKumi(id: number) {
    ElMessageBox.confirm(t("kumiPage.confirmDelete"), t("misc.hint"), {
        confirmButtonText: t("misc.del"),
        cancelButtonText: t("misc.cancel"),
        type: "warning"
    }).then(() => {
        kumiStore.deleteKumi(id)
    }).catch(() => {})
}

function handleEditKumi(id: number) {
    ElMessageBox.prompt(t("kumiPage.enterKumi"), t("kumiPage.renameKumi"), {
        confirmButtonText: t("misc.confirm"),
        cancelButtonText: t("misc.cancel")
    }).then(({ value }) => {
        if (value) {
            kumiStore.rename(id, value)
        }
    }).catch(() => {})
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


// command
function handleCommand(command: string) {
    if (command === "add") {
        handleNewDir()
    } else if (command.startsWith("use")) {
        currentDirId.value = parseInt(command.split(" ")[1])
    } else if (command === "delete") {
        handleDeleteDir(currentDirId.value)
    } else if (command === "rename") {
        handleRenameDir(currentDirId.value)
    } else if (command === "clear") {
        handleClearDir(currentDirId.value)
    } else if (command === "addKumi") {
        handleNewKumi()
    }
}

</script>

<style scoped lang="scss">
// 圣遗物套装页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-*
.kumi-page {
    min-height: calc(100vh - 48px);
    padding: 16px clamp(10px, 1.3vw, 18px) 18px;
    box-sizing: border-box;
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);
}

.kumi-layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
}

.kumi-folders {
    position: sticky;
    top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.kumi-new-folder {
    height: 42px;
    border: 0;
    border-radius: 12px;
    background: var(--cx-card);
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
            background: var(--cx-card);
            color: var(--cx-letter);
            font-weight: 600;

            svg {
                color: var(--cx-gold);
            }
        }
    }
}

.kumi-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;

    h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
    }
}

.kumi-count {
    color: var(--cx-dim);
}

.kumi-spacer {
    flex: 1;
}

.kumi-search {
    width: 220px;
}

.kumi-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: var(--cx-card);
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
    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
    gap: 14px;
}

.kumi-page button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

// 「新建收藏夹」菜单项只在手机上出现（宽屏有左栏按钮）；菜单挂在 body 上，用全局选择器
:global(.kumi-narrow-only) {
    display: none !important;
}

@media (max-width: 767px) {
    :global(.kumi-narrow-only) {
        display: flex !important;
    }

    .kumi-page {
        padding-top: 12px;
    }

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
            background: var(--cx-card);

            &[aria-pressed=true] {
                background: var(--cx-gold);
                color: var(--cx-gold-on);

                svg {
                    color: var(--cx-gold-on);
                }
            }
        }
    }

    .kumi-bar h2 {
        display: none;
    }

    .kumi-search {
        order: 5;
        width: 100%;
    }

    .kumi-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

</style>