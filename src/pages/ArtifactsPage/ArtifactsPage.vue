<template>
    <div class="art-page cx-scope cx-page-frame">
        <ArtifactPromptDialog ref="artifactPrompt" />
        <artifact-score-dialog v-model="showScore" :item="scoreItem" :initial-character="scoreCharacter" />
        <add-artifact-dialog v-model="newDialogVisible" :return-focus="focusAddButton" @confirm="handleConfirmAddArtifact" />

        <UiDialog v-model="showImportDialog" :title="t('misc.import')" :width="deviceIsPC ? '60%' : '90%'" top="15vh"
            :prevent-outside="importing" @escape-key-down="importing && $event.preventDefault()">
            <ImportBlock ref="fileUploader" v-model:file="selectedImportFile" accept="application/json" :disabled="importing" />
            <div class="art-import-options">
                <UiCheckbox v-model="importDeleteUnseen" :disabled="importing">{{ t('artPage.deleteUnseen') }}</UiCheckbox>
                <UiCheckbox v-model="importBackupKumiDir" :disabled="importing">{{ t('artPage.backupKumiDir') }}</UiCheckbox>
            </div>
            <template #footer>
                <div class="art-dialog-actions">
                    <UiButton :disabled="importing" @click="showImportDialog = false">{{ t('misc.cancel') }}</UiButton>
                    <UiButton variant="primary" :loading="importing" @click="handleImportJson">
                        {{ importing ? t('artPage.importing') : t('misc.confirm') }}
                    </UiButton>
                </div>
            </template>
        </UiDialog>

        <UiDialog v-model="detailOpen" :title="detailMode === 'edit' ? t('artPage.edit') : '圣遗物详情'" width="min(640px, 94vw)">
            <artifact-detail v-if="openedArtifact && detailMode === 'view'" :item="openedArtifact" :score="openedScore" :highlight-tags="highlightTags"
                :score-label="scoreCharacter" :grade="openedScore === null ? undefined : getMarkClass(openedScore)"
                @edit="startEditArtifact" @toggle-lock="toggleArtifact(openedArtifact.id)" @delete="deleteOpenedArtifact" @score="showScore = true" />
            <edit-artifact v-show="detailMode === 'edit'" ref="editArtifactComponent"
                @confirm="handleConfirmEdit" @cancel="detailMode = 'view'" />
        </UiDialog>

        <header class="art-bar">
            <div class="cx-panel">
                <div class="cx-panel-heading cx-panel-heading--page">
                    <h2 class="cx-panel-title">{{ t('misc.artifact') }}</h2>
                    <span class="art-count">共 {{ artifactStore.artifactsCount }} 件</span>
                    <PageGuideButton guide-id="detail-artifacts" />
                </div>
                <div class="art-controls cx-panel-body">
                    <div class="art-actions">
                        <UiButton class="art-btn art-wide" data-tour="artifacts.import" @click="handleImportJsonClicked">{{ t('misc.import') }}</UiButton>
                        <UiButton class="art-btn" @click="handleOutputJsonClicked">{{ t('artPage.exportJson') }}</UiButton>
                        <UiDropdownMenu>
                            <template #trigger><UiButton class="art-btn" data-tour="artifacts.more">更多 <IconEpArrowDown aria-hidden="true" /></UiButton></template>
                            <UiDropdownMenuItem v-if="narrowArt" @select="handleImportJsonClicked">{{ t('misc.import') }}</UiDropdownMenuItem>
                            <UiDropdownMenuItem :divided="narrowArt" @select="unlockAllArtifacts">{{ t('artPage.unlockAll') }}</UiDropdownMenuItem>
                            <UiDropdownMenuItem divided class="art-danger" @select="confirmClearArtifacts">{{ t('misc.clear') }}</UiDropdownMenuItem>
                        </UiDropdownMenu>
                        <UiButton ref="addButton" variant="primary" class="art-add" data-tour="artifacts.add" @click="handleClickAddArtifact">＋ 新增圣遗物</UiButton>
                    </div>

                    <UiHoverPreview as="nav" target="button" data-tour="artifacts.slots" class="art-slots" aria-label="部位">
                        <UiButton v-for="tab in slotTabs" :key="tab.name" :aria-pressed="activeName === tab.name"
                            @click="activeName = tab.name">
                            <img v-if="tab.icon" :src="tab.icon" alt="" />
                            <b>{{ tab.label }}</b>
                            <small>{{ tab.count }}</small>
                        </UiButton>
                    </UiHoverPreview>

                    <div class="art-filters">
                        <div class="art-filter">
                            <SelectArtifactSet v-model="filterSet" shadcn multiple :multiple-limit="1000" :placeholder="t('misc.artifactSet')" />
                        </div>
                        <div class="art-filter">
                            <SelectArtifactMainStat v-model="filterMainStat" :position="activeName" shadcn :include-any="false"
                                multiple :placeholder="t('misc.mainStat')" />
                        </div>
                        <div class="art-filter art-score-filter">
                            <CharacterAvatarPicker v-model="scoreCharacter" :options="scoreCharacterOptions"
                                title="评分角色" placeholder="选择评分角色" clearable />
                        </div>
                        <UiPopover v-model:open="displaySettingsOpen" label="显示设置">
                            <template #trigger><UiButton class="art-display-trigger">显示设置</UiButton></template>
                            <div class="art-display-settings">
                                <UiCheckbox v-model="hideFixedMainStats">花和羽毛不显示主词条</UiCheckbox>
                                <UiCheckbox v-model="hideMiaoScore">不显示喵喵评分</UiCheckbox>
                            </div>
                        </UiPopover>
                        <UiCheckbox v-model="filterGe16">{{ t('artPage.show16') }}</UiCheckbox>
                    </div>
                </div>
            </div>
        </header>

        <Transition v-if="pagedArtifacts.length" name="artifact-page" @leave="removePreviousPage">
            <UiHoverPreview :key="page" target="button.art-card" class="art-grid art-hover-grid" data-tour="artifacts.grid">
                <artifact-card v-for="{ item, score } in pagedArtifacts" :key="item.id" :item="item" :highlight-tags="highlightTags"
                    short-recharge :hide-fixed-main-stat="hideFixedMainStats" :score="hideMiaoScore ? null : score"
                    :score-label="scoreCharacter" :grade="hideMiaoScore || score === null ? undefined : getMarkClass(score)"
                    :selected="item.id === openedArtifactId" @open="openArtifact(item.id)" />
            </UiHoverPreview>
        </Transition>
        <div v-else class="art-empty" data-slot="empty" data-tour="artifacts.grid" role="status">
            <i-ep-box aria-hidden="true" />
            <p>{{ locale === 'en' ? 'No Data' : '暂无数据' }}</p>
        </div>

        <div v-if="pageCount > 1" class="art-pager">
            <PaginationRoot v-model:page="page" :items-per-page="pageSize" :total="artifactToBeDisplayed.length"
                :sibling-count="narrowArt ? 0 : 1" show-edges>
                <PaginationList v-slot="{ items }" class="art-pager-list">
                    <PaginationPrev as-child><UiButton size="small" :aria-label="locale === 'en' ? 'Previous page' : '上一页'"><i-ep-arrow-left aria-hidden="true" /></UiButton></PaginationPrev>
                    <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : 'ellipsis-' + index">
                        <PaginationListItem v-if="item.type === 'page'" :value="item.value" as-child>
                            <UiButton size="small" :variant="item.value === page ? 'primary' : 'outline'">{{ item.value }}</UiButton>
                        </PaginationListItem>
                        <PaginationEllipsis v-else :index="index">…</PaginationEllipsis>
                    </template>
                    <PaginationNext as-child><UiButton size="small" :aria-label="locale === 'en' ? 'Next page' : '下一页'"><i-ep-arrow-right aria-hidden="true" /></UiButton></PaginationNext>
                </PaginationList>
            </PaginationRoot>
            <span>每页 {{ pageSize }} 件</span>
        </div>

        <ToastProvider :duration="3000">
            <ToastRoot v-for="notice in notices" :key="notice.id" class="art-notice" :data-tone="notice.tone"
                :duration="notice.duration" @update:open="!$event && dismissNotice(notice.id)">
                <ToastTitle v-if="notice.title">{{ notice.title }}</ToastTitle>
                <ToastDescription>{{ notice.message }}</ToastDescription>
                <ToastClose as-child><UiButton size="small" class="art-notice-close" :aria-label="locale === 'en' ? 'Close' : '关闭'"><i-ep-close aria-hidden="true" /></UiButton></ToastClose>
            </ToastRoot>
            <ToastViewport class="art-notices" />
        </ToastProvider>
    </div>
</template>

<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import ArtifactScoreDialog from '@/components/display/ArtifactScoreDialog.vue'
import CharacterAvatarPicker from '@/components/select/CharacterAvatarPicker.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiHoverPreview from '@/components/ui/UiHoverPreview.vue'
import UiPopover from '@/components/ui/UiPopover.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiDropdownMenu from '@/components/ui/UiDropdownMenu.vue'
import UiDropdownMenuItem from '@/components/ui/UiDropdownMenuItem.vue'
import ArtifactPromptDialog from './ArtifactPromptDialog.vue'
import { scoreCharacterNames, rankingContext, scoreBuild, getMarkClass } from '@/algorithms/artifact-score/score.mjs'
import characters from '@/assets/_gen_character'
import scoreLocale from '@/i18n/generated/zh-cn.json'
import { scoreContextHighlights } from '@/utils/character-artifact-highlights'
import { isPickerCharacter } from '@/import/character-summary.mjs'
import {importWarehouseFile, pendingWarehouseImport} from '@/import/warehouse-file'
import {exportGoodWarehouse} from '@/import/good'
import {artifactImportContext} from '@/import/level-zero-match.cjs'
import {useKumiStore} from '@/store/pinia/kumi'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import {mainStatMap, positions} from '@/constants/artifact'
import {downloadString} from '@/utils/common'
import {recordUsage, recordUsageUnlessCancelled} from '@/usage-stats/index.mjs'
import {deviceIsPC} from "@/utils/device"
import {type Ref, onActivated, onBeforeUnmount, onDeactivated, onMounted, watch} from "vue"
import {
    PaginationRoot, PaginationList, PaginationListItem, PaginationPrev, PaginationNext, PaginationEllipsis,
    ToastProvider, ToastRoot, ToastTitle, ToastDescription, ToastClose, ToastViewport,
} from 'radix-vue'
import {useRoute, useRouter} from "vue-router"
import {useArtifactStore} from "@/store/pinia/artifact"
import {useAccountStore} from '@/store/pinia/account'
import {usePresetStore} from "@/store/pinia/preset"
import IconEpArrowDown from "~icons/ep/arrow-down"

import flowerIcon from '@image/misc/flower.png';
import featherIcon from '@image/misc/feather.png';
import sandIcon from '@image/misc/sand.png';
import gobletIcon from '@image/misc/goblet.png';
import headIcon from '@image/misc/head.png';

import AddArtifactDialog from './AddArtifactDialog';
import SelectArtifactSet from '@c/select/SelectArtifactSet';
import SelectArtifactMainStat from '@c/select/SelectArtifactMainStat';
import ArtifactCard from '@/components/display/ArtifactCard.vue';
import ArtifactDetail from './ArtifactDetail.vue';
import {useScreen} from '@/composables/screen';
import EditArtifact from './EditArtifact';
import ImportBlock from '@c/misc/ImportBlock';
import type {ArtifactMainStatName, ArtifactPosition, ArtifactSetName, IArtifactContentOnly} from "@/types/artifact"

import {useI18n} from "@/i18n/i18n"


// i18n
const { t, locale } = useI18n()
const artifactPrompt = ref<InstanceType<typeof ArtifactPromptDialog> | null>(null)

type Notice = { id: number; message: string; tone: 'success' | 'error' | 'info'; title?: string; duration?: number }
const notices = ref<Notice[]>([])
let noticeId = 0

function showNotice(message: string, tone: Notice['tone'], details?: Pick<Notice, 'title' | 'duration'>) {
    notices.value.push({ id: ++noticeId, message, tone, ...details })
}

function dismissNotice(id: number) {
    notices.value = notices.value.filter(notice => notice.id !== id)
}

function showError(error: unknown) {
    showNotice(error instanceof Error ? error.message : String(error), 'error')
}


const tabs = [
    { icon: flowerIcon, name: 'flower' },
    { icon: featherIcon, name: 'feather' },
    { icon: sandIcon, name: 'sand' },
    { icon: gobletIcon, name: 'cup' },
    { icon: headIcon, name: 'head' },
];
Object.freeze(tabs);
const activeName = ref<ArtifactPosition | 'all'>("flower")

// 每页件数；切换部位或改筛选后回到第 1 页
const pageSize = 20
const page = ref(1)

function removePreviousPage(_element: Element, done: () => void) {
    done()
}

const artifactStore = useArtifactStore()
const presetStore = usePresetStore()

///////////////////////////////////////////////////////////////////
// artifact crud
function unlockAllArtifacts() {
    artifactStore.unlockAll()
}

function deleteAllArtifacts() {
    artifactStore.deleteAll()
}

function removeArtifact(id: number) {
    artifactStore.removeArtifact(id)
}

function toggleArtifact(id: number) {
    artifactStore.toggleArtifact(id)
}

function deleteArtifact(id: number) {
    artifactStore.removeArtifact(id)
}


///////////////////////////////////////////////////////////////////
// artifacts filters and display
const filterSet: Ref<ArtifactSetName[]> = ref([])
const showScore = ref(false)
const scoreArtifactId = ref(-1)
const scoreItem = computed(() => artifactStore.artifacts.value.get(scoreArtifactId.value))
const filterMainStat = ref<ArtifactMainStatName[]>([])
watch(activeName, position => {
    if (position === 'all') return
    const compatible = filterMainStat.value.filter(stat => mainStatMap[position].includes(stat))
    if (compatible.length !== filterMainStat.value.length) filterMainStat.value = compatible
})
const filterGe16 = ref(true)
const scoreCharacter = ref('')
const displaySettingsOpen = ref(false)
const hideFixedMainStats = ref(false)
const hideMiaoScore = ref(false)
onDeactivated(() => { displaySettingsOpen.value = false })
const highlightTags = computed(() => scoreCharacter.value ? scoreContextHighlights(rankingContext(scoreCharacter.value)) : undefined)
const scoreCharacters = Object.values(characters)
const scoreCharactersByName = new Map(scoreCharacters.map(role => [scoreLocale[role.nameLocale], role]))
const travelersByElement = new Map(scoreCharacters.filter(role => role.name.startsWith('Aether'))
    .map(role => [role.element.toLowerCase(), role]))
const scoreCharacterOptions = [...scoreCharacterNames].sort((a, b) => a.localeCompare(b, 'zh-CN')).flatMap(value => {
    const { name, options } = rankingContext(value)
    const role = (name === '旅行者' ? travelersByElement.get(options.elem) : scoreCharactersByName.get(name))!
    return isPickerCharacter(role.name, value) ? [{ value, label: value, avatar: role.avatar, element: role.element, star: role.star }] : []
})

const artifactsCurrentSlot = computed(() => {
    if (activeName.value === 'all') return positions.flatMap(p => artifactStore.artifactsByPosition.value[p])
    return artifactStore.artifactsByPosition.value[activeName.value];
})
// 部位按钮：全部 + 五个部位，带件数
const slotTabs = computed(() => [
    { name: 'all' as const, label: '全部', icon: '', count: artifactStore.artifactsCount.value },
    ...tabs.map(tab => ({ name: tab.name as ArtifactPosition, label: t('misc', tab.name), icon: tab.icon,
        count: artifactStore.artifactsByPosition.value[tab.name as ArtifactPosition].length })),
])
const { width: screenWidth } = useScreen()
const narrowArt = computed(() => screenWidth.value <= 820)

const filteredArtifacts = computed(() => {
    let results = [];

    for (let artifact of artifactsCurrentSlot.value) {
        const setName = artifact.setName;
        const mainStatName = artifact.mainTag.name;
        const level = artifact.level;

        if (filterSet.value.length > 0 && filterSet.value.indexOf(setName) === -1) {
            continue;
        }
        if (filterMainStat.value.length > 0 && filterMainStat.value.indexOf(mainStatName) === -1) {
            continue;
        }
        if (filterGe16.value && level < 16) {
            continue;
        }

        results.push(artifact);
    }

    return results;
})

const artifactToBeDisplayed = computed(() => {
    const context = scoreCharacter.value ? rankingContext(scoreCharacter.value) : null
    const rows = filteredArtifacts.value.map(item => ({
        item,
        score: context ? scoreBuild([item], context).artifacts[0].score : null
    }))
    return context ? rows.sort((a, b) => b.score! - a.score!) : rows
})
const pageCount = computed(() => Math.max(1, Math.ceil(artifactToBeDisplayed.value.length / pageSize)))
const pagedArtifacts = computed(() => artifactToBeDisplayed.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([activeName, filterSet, filterMainStat, filterGe16, scoreCharacter], () => { page.value = 1 }, { deep: true })
watch(pageCount, count => {
    page.value = Math.min(page.value, count)
})

function handlePageKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (event.defaultPrevented || event.repeat || event.isComposing
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target
    if (target instanceof Element && target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"]',
    )) return

    const nextPage = page.value + (event.key === 'ArrowLeft' ? -1 : 1)
    if (nextPage < 1 || nextPage > pageCount.value) return
    event.preventDefault()
    page.value = nextPage
}

function bindPageKeyboard() { window.addEventListener('keydown', handlePageKeydown) }
function unbindPageKeyboard() { window.removeEventListener('keydown', handlePageKeydown) }
onMounted(bindPageKeyboard)
onActivated(bindPageKeyboard)
onDeactivated(unbindPageKeyboard)
onBeforeUnmount(unbindPageKeyboard)

// 点卡片打开详情，在同一窗口切换编辑。
const openedArtifactId = ref(-1)
const detailOpen = ref(false)
const detailMode = ref<'view' | 'edit'>('view')
const openedArtifact = computed(() => artifactStore.artifacts.value.get(openedArtifactId.value))
const openedScore = computed(() => openedArtifact.value && scoreCharacter.value
    ? scoreBuild([openedArtifact.value], rankingContext(scoreCharacter.value)).artifacts[0].score : null)
function openArtifact(id: number) {
    openedArtifactId.value = id
    scoreArtifactId.value = id
    detailMode.value = 'view'
    detailOpen.value = true
}
function startEditArtifact() {
    detailMode.value = 'edit'
    nextTick(() => editArtifactComponent.value?.setId(openedArtifactId.value))
}
function deleteOpenedArtifact() {
    const id = openedArtifactId.value
    artifactPrompt.value?.confirm(t('artPage.confirmDelete'), t('misc.hint'), {
        confirmButtonText: t('misc.del'),
        cancelButtonText: t('misc.cancel'),
    }).then(() => {
        deleteArtifact(id)
        detailOpen.value = false
    }, () => {})
}
watch(detailOpen, open => { if (!open) openedArtifactId.value = -1 })


///////////////////////////////////////////////////////////////////
// new artifact
const newDialogVisible = ref(false)
const addButton = ref<InstanceType<typeof UiButton> | null>(null)

function focusAddButton() {
    addButton.value?.$el.focus()
}

function handleClickAddArtifact() {
    newDialogVisible.value = true
}

function handleConfirmAddArtifact(a: IArtifactContentOnly) {
    const position = a.position
    newDialogVisible.value = false
    artifactStore.addArtifact(a)
    activeName.value = position
}


///////////////////////////////////////////////////////////////////
// import/export artifacts
const showImportDialog = ref(false)
const importing = ref(false)
const selectedImportFile = ref<File | null>(null)
const fileUploader: Ref<InstanceType<typeof ImportBlock> | null> = ref(null)
const importDeleteUnseen = ref(false)
const importBackupKumiDir = ref(false)

function handleImportJsonClicked() {
    showImportDialog.value = true;
}

// 首次使用弹窗用 /artifacts?import=1 直接打开文件导入
const route = useRoute(), router = useRouter()
const accounts = useAccountStore()
watch(() => route.query.import, value => {
    if (value !== undefined && route.path === "/artifacts") {
        handleImportJsonClicked()
        router.replace({path: "/artifacts"})
    }
}, {immediate: true})

async function importArtifactData(file: unknown, deleteUnseen: boolean, backupKumiDir: boolean) {
    const result = await importWarehouseFile(file, deleteUnseen, backupKumiDir, artifactImportContext(
        presetStore.presets.value, useKumiStore().kumi.value, useMiyousheStore().data.value), artifactPrompt.value ?? undefined)
    if ('warning' in result && result.warning) showNotice(result.warning, 'info')
    recordUsage('action.artifact-file-import')
}

function reportImportError(error: unknown) {
    if (error === 'close' || error === 'cancel') return
    console.error('圣遗物文件导入失败', error)
    showError(error)
}

async function importFromCharacterPage() {
    const request = pendingWarehouseImport.value
    if (!request || route.path !== '/artifacts') return
    pendingWarehouseImport.value = null
    if (importing.value) {
        showNotice(t('artPage.importing'), 'info')
        return
    }
    importing.value = true
    try {
        if (request.accountId !== accounts.currentAccountId.value || request.reloadGeneration !== accounts.reloadGeneration.value) {
            throw new Error('账号已切换，请重新导入')
        }
        await importArtifactData(request.file, false, false)
    } catch (error) {
        reportImportError(error)
    } finally {
        importing.value = false
    }
}
onMounted(importFromCharacterPage)
onActivated(importFromCharacterPage)

async function handleImportJson() {
    const component = fileUploader.value
    if (!component || importing.value) return

    importing.value = true
    try {
        const file = JSON.parse(await component.getReadPromise())
        await importArtifactData(file, importDeleteUnseen.value, importBackupKumiDir.value)
    } catch (error) {
        reportImportError(error)
    } finally {
        importing.value = false
        showImportDialog.value = false
    }
}

function getArtifactString(): string {
    const items = positions.flatMap(position => artifactStore.artifactsByPosition.value[position])
    return JSON.stringify(exportGoodWarehouse(items))
}

async function handleOutputJsonClicked() {
    try {
        recordUsageUnlessCancelled(await downloadString(getArtifactString(), 'application/json', 'mona-artifacts.good.json'), 'action.data-export')
    } catch (e) {
        showError(e)
    }
}


///////////////////////////////////////////////////////////////////
// edit artifacts
const editArtifactComponent: Ref<InstanceType<typeof EditArtifact> | null> = ref(null)


function handleConfirmEdit(id: number) {
    if (editArtifactComponent.value) {
        const newArtifact: IArtifactContentOnly = editArtifactComponent.value.getNewArtifact() as IArtifactContentOnly
        artifactStore.updateArtifact(id, newArtifact)
    }

    detailMode.value = 'view'
}


function confirmClearArtifacts() {
    artifactPrompt.value?.confirm(t('artPage.confirmClear'), t('misc.hint'), {
        confirmButtonText: t('misc.confirm'),
        cancelButtonText: t('misc.cancel'),
    }).then(deleteAllArtifacts, () => {})
}
</script>

<style scoped lang="scss">
.art-page {
    padding-top: 0;
}

.art-bar {
    position: sticky;
    top: 0;
    z-index: 6;
    margin-bottom: 6px;
    padding: 16px 0 12px;
    background: var(--cx-ground);
}

.art-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
}

.art-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.art-count {
    color: var(--cx-dim);
}

.art-btn {
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

.art-add {
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

.art-slots {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;

    button {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 14px;
        border: 0;
        border-radius: 999px;
        background: var(--cx-step);
        color: var(--cx-dim);
        font: inherit;
        cursor: pointer;

        img {
            width: 20px;
            height: 20px;
            opacity: .7;
        }

        b {
            color: var(--cx-letter);
            font-weight: 600;
        }

        small {
            font-size: 12px;
            font-variant-numeric: tabular-nums;
        }

        &[aria-pressed=true] {
            background: var(--cx-gold);
            color: var(--cx-gold-on);

            b {
                color: var(--cx-gold-on);
            }

            img {
                opacity: 1;
            }
        }
    }
}

// 部位图标是深色线条，深色模式下反色
html[data-color-mode="dark"] .art-slots button:not([aria-pressed=true]) img {
    filter: invert(1);
}

.art-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.art-filter {
    width: 200px;
}

.art-score-filter :deep(.character-picker-controls) {
    width: 100%;
}

.art-score-filter :deep(.character-picker-controls > .ui-button),
.art-filters :deep(.art-display-trigger) {
    min-height: 40px;
}

.art-display-settings {
    display: grid;
    gap: 10px;
}

.art-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
}

@media (prefers-reduced-motion: no-preference) {
    .artifact-page-enter-active { transition: opacity 160ms ease-out, transform 160ms ease-out; }
    .artifact-page-enter-from { opacity: 0; transform: translateY(6px); }
}

// 空状态和上方筛选栏拉开距离
.art-empty {
    display: grid;
    justify-items: center;
    margin-top: 28px;
    padding: 40px 0;
    color: var(--cx-dim);
}
.art-empty svg { width: 78px; height: 78px; color: var(--cx-step-2); }
.art-import-options { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.art-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.art-danger { color: var(--cx-up); }
.art-pager-list { display: flex; align-items: center; gap: 4px; }
.art-pager-list button { min-width: 32px; }
.art-notices { position: fixed; z-index: 9999; top: 14px; right: 14px; width: min(360px, calc(100vw - 28px)); display: grid; gap: 8px; padding: 0; margin: 0; list-style: none; }
.art-notice { position: relative; padding: 12px 48px 12px 14px; border: 1px solid var(--cx-step-2); border-radius: 10px; background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 6px 20px rgb(0 0 0 / 16%); }
.art-notice[data-tone="error"] { border-inline-start: 3px solid var(--cx-up); }
.art-notice[data-tone="success"] { border-inline-start: 3px solid var(--cx-green, var(--cx-gold)); }
.art-notice-close { position: absolute; top: 6px; right: 6px; }


.art-pager {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-top: 22px;
    color: var(--cx-dim);
    font-size: 13px;
}

.art-btn:focus-visible,
.art-add:focus-visible,
.art-slots button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

@media (max-width: 767px) {
    .art-bar {
        top: 48px;
        padding: 12px 0 10px;
    }

    .art-wide {
        display: none;
    }

    .art-filter {
        width: calc(50% - 5px);
    }

    .art-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

</style>

<style scoped src="../../styles/artifact-score.css"></style>
