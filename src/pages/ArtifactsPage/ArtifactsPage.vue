<template>
    <div class="art-page cx-scope">
        <artifact-score-dialog v-if="showScore" v-model="showScore" :item="scoreItem" :initial-character="scoreCharacter" />
        <!-- new artifact dialog -->
        <add-artifact-dialog
            v-model="newDialogVisible"
            @confirm="handleConfirmAddArtifact"
        ></add-artifact-dialog>

        <el-dialog custom-class="cx-scope"
            v-model="showOutputShareDialog"
            title="分享"
            :width="deviceIsPC ? '500px' : '90%'"
        >
            <p>{{ t("artPage.shareDesc") }}</p>
            <el-input v-model="shareLink"></el-input>

            <template #footer>
                <el-button type="primary" @click="handleCopyShareLink">{{ t("misc.copy") }}</el-button>
            </template>
        </el-dialog>

        <el-dialog custom-class="cx-scope" v-model="showImportDialog" :title="t('misc.import')" :width="deviceIsPC ? '60%' : '90%'">
            <import-block ref="fileUploader" accept="application/json"></import-block>
            <el-checkbox v-model="importDeleteUnseen" style="margin-top: 12px">{{ t("artPage.deleteUnseen") }}</el-checkbox>
            <el-checkbox v-model="importBackupKumiDir" style="margin-top: 12px">{{ t("artPage.backupKumiDir") }}</el-checkbox>

            <template #footer>
                <el-button @click="showImportDialog = false">{{ t("misc.cancel") }}</el-button>
                <el-button type="primary" @click="handleImportJson">{{ t("misc.confirm") }}</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="detailOpen" :title="detailMode === 'edit' ? t('artPage.edit') : '圣遗物详情'"
            width="min(640px, 94vw)" custom-class="cx-scope viewport-dialog condition-settings-dialog"
            modal-class="condition-settings-overlay" append-to-body>
            <artifact-detail v-if="openedArtifact && detailMode === 'view'" :item="openedArtifact" :score="openedScore" :highlight-tags="highlightTags"
                :score-label="scoreCharacter" :grade="openedScore === null ? undefined : getMarkClass(openedScore)"
                @edit="startEditArtifact" @toggle-lock="toggleArtifact(openedArtifact.id)"
                @delete="deleteOpenedArtifact" @score="showScore = true" />
            <edit-artifact
                v-show="detailMode === 'edit'"
                ref="editArtifactComponent"
                @confirm="handleConfirmEdit"
                @cancel="detailMode = 'view'"
            ></edit-artifact>
        </el-dialog>

        <header class="art-bar">
            <div class="art-row">
                <h2 class="art-title">{{ t("misc.artifact") }}</h2>
                <span class="art-count">共 {{ artifactStore.artifactsCount }} 件</span>
                <PageGuideButton guide-id="detail-artifacts" />
                <span class="art-spacer"></span>
                <button type="button" class="art-btn art-wide" data-tour="artifacts.import" @click="handleImportJsonClicked">{{ t("misc.import") }}</button>
                <el-dropdown class="art-wide" trigger="click" @command="handleOutputCommand">
                    <button type="button" class="art-btn">{{ t("misc.export") }} <icon-ep-arrow-down aria-hidden="true" /></button>
                    <template #dropdown><el-dropdown-menu>
                        <el-dropdown-item command="monaJson">{{ t("artPage.monaJSON") }}</el-dropdown-item>
                        <el-dropdown-item command="share">{{ isNative ? '保存分享文件' : t("artPage.shareLink") }}</el-dropdown-item>
                    </el-dropdown-menu></template>
                </el-dropdown>
                <el-dropdown trigger="click" @command="handleDropdownCommand">
                    <button type="button" class="art-btn" data-tour="artifacts.more">更多 <icon-ep-arrow-down aria-hidden="true" /></button>
                    <template #dropdown><el-dropdown-menu>
                        <template v-if="narrowArt">
                            <el-dropdown-item command="importJson">{{ t("misc.import") }}</el-dropdown-item>
                            <el-dropdown-item command="exportJson">{{ t("artPage.exportMona") }}</el-dropdown-item>
                            <el-dropdown-item command="exportShare">{{ isNative ? '保存分享文件' : t("artPage.shareLink") }}</el-dropdown-item>
                        </template>
                        <el-dropdown-item command="unlockAll" :divided="narrowArt">{{ t("artPage.unlockAll") }}</el-dropdown-item>
                        <el-dropdown-item command="deleteAll" divided class="art-danger">{{ t("misc.clear") }}</el-dropdown-item>
                    </el-dropdown-menu></template>
                </el-dropdown>
                <button type="button" class="art-add" data-tour="artifacts.add" @click="handleClickAddArtifact">＋ 新增圣遗物</button>
            </div>

            <nav data-tour="artifacts.slots" class="art-slots" aria-label="部位">
                <button v-for="tab in slotTabs" :key="tab.name" type="button" :aria-pressed="activeName === tab.name" @click="activeName = tab.name">
                    <img v-if="tab.icon" :src="tab.icon" alt="" />
                    <b>{{ tab.label }}</b>
                    <small>{{ tab.count }}</small>
                </button>
            </nav>

            <div class="art-filters">
                <div class="art-filter">
                    <select-artifact-set v-model="filterSet" :multiple="true" :multiple-limit="1000"
                        :placeholder="t('misc.artifactSet')"
                    ></select-artifact-set>
                </div>
                <div class="art-filter">
                    <select-artifact-main-stat
                        v-model="filterMainStat"
                        :include-any="false"
                        :multiple="true"
                        :placeholder="t('misc.mainStat')"
                    ></select-artifact-main-stat>
                </div>
                <div class="art-filter art-score-filter">
                    <CharacterAvatarPicker v-model="scoreCharacter" :options="scoreCharacterOptions"
                        title="评分角色" placeholder="评分角色" clearable />
                </div>
                <UiPopover v-model:open="displaySettingsOpen" label="显示设置">
                    <template #trigger><UiButton class="art-display-trigger">显示设置</UiButton></template>
                    <div class="art-display-settings">
                        <label class="art-display-option">
                            <CheckboxRoot v-model:checked="hideFixedMainStats" class="art-display-check">
                                <CheckboxIndicator><IconEpCheck aria-hidden="true" /></CheckboxIndicator>
                            </CheckboxRoot>
                            花和羽毛不显示主词条
                        </label>
                        <label class="art-display-option">
                            <CheckboxRoot v-model:checked="hideMiaoScore" class="art-display-check">
                                <CheckboxIndicator><IconEpCheck aria-hidden="true" /></CheckboxIndicator>
                            </CheckboxRoot>
                            不显示喵喵评分
                        </label>
                    </div>
                </UiPopover>
                <el-checkbox v-model="filterGe16">{{ t("artPage.show16") }}</el-checkbox>
            </div>
        </header>

        <div v-if="pagedArtifacts.length" class="art-grid" data-tour="artifacts.grid">
            <artifact-card v-for="{ item, score } in pagedArtifacts" :key="item.id" :item="item" :highlight-tags="highlightTags"
                :hide-fixed-main-stat="hideFixedMainStats" :score="hideMiaoScore ? null : score"
                :score-label="scoreCharacter" :grade="hideMiaoScore || score === null ? undefined : getMarkClass(score)"
                :selected="item.id === openedArtifactId" @open="openArtifact(item.id)" />
        </div>
        <el-empty v-else class="art-empty" data-tour="artifacts.grid"></el-empty>

        <div v-if="artifactToBeDisplayed.length > pageSize" class="art-pager">
            <el-pagination v-model:current-page="page" :page-size="pageSize" :total="artifactToBeDisplayed.length"
                layout="prev, pager, next" :pager-count="narrowArt ? 5 : 7" />
            <span>每页 {{ pageSize }} 件</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import ArtifactScoreDialog from '@/components/display/ArtifactScoreDialog.vue'
import CharacterAvatarPicker from '@/components/select/CharacterAvatarPicker.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPopover from '@/components/ui/UiPopover.vue'
import { scoreCharacterNames, rankingContext, scoreBuild, getMarkClass } from '@/algorithms/artifact-score/score.mjs'
import characters from '@/assets/_gen_character'
import scoreLocale from '@/i18n/generated/zh-cn.json'
import { scoreContextHighlights } from '@/utils/character-artifact-highlights'
import {importWarehouseFile} from '@/import/warehouse-file'
import {artifactImportContext} from '@/import/level-zero-match.cjs'
import {useKumiStore} from '@/store/pinia/kumi'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import {positions} from '@/constants/artifact'
import {downloadString} from '@/utils/common'
import {recordUsage, recordUsageUnlessCancelled} from '@/usage-stats/index.mjs'
import {deviceIsPC} from "@/utils/device"
import {createRepo} from "@/api/repo"
import {type Ref, onDeactivated, watch} from "vue"
import { CheckboxIndicator, CheckboxRoot } from 'radix-vue'
import {useRoute, useRouter} from "vue-router"
import {useArtifactStore} from "@/store/pinia/artifact"
import { isNative, saveText } from '@/platform/native.mjs'
import {usePresetStore} from "@/store/pinia/preset"
import IconEpArrowDown from "~icons/ep/arrow-down"
import IconEpCheck from "~icons/ep/check"

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
import {type ArtifactPosition, ArtifactSetName, ArtifactStatName, IArtifactContentOnly} from "@/types/artifact"
// import {ElLoading, ElMessage, ElMessageBox, ElNotification} from "element-plus"
// import {ElMessage} from "element-plus"

import {useI18n} from "@/i18n/i18n"

import "element-plus/es/components/message/style/css"

// i18n
const { t } = useI18n()


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
const pageSize = 60
const page = ref(1)

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
const filterMainStat: Ref<ArtifactStatName[]> = ref([])
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
const scoreCharacterOptions = [...scoreCharacterNames].sort((a, b) => a.localeCompare(b, 'zh-CN')).map(value => {
    const { name, options } = rankingContext(value)
    const role = (name === '旅行者' ? travelersByElement.get(options.elem) : scoreCharactersByName.get(name))!
    return { value, label: value, avatar: role.avatar, element: role.element, star: role.star }
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
const pagedArtifacts = computed(() => artifactToBeDisplayed.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([activeName, filterSet, filterMainStat, filterGe16, scoreCharacter], () => { page.value = 1 }, { deep: true })

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
    ElMessageBox.confirm(t("artPage.confirmDelete"), t("misc.hint"), {
        confirmButtonText: t("misc.del"),
        cancelButtonText: t("misc.cancel"),
        type: "warning"
    }).then(() => {
        deleteArtifact(id)
        detailOpen.value = false
    }).catch(() => {})
}
watch(detailOpen, open => { if (!open) openedArtifactId.value = -1 })


///////////////////////////////////////////////////////////////////
// new artifact
const newDialogVisible = ref(false)

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
// share
const showOutputShareDialog = ref(false)
const shareLink = ref("")

function handleCopyShareLink() {
    if (window.navigator) {
        navigator.clipboard.writeText(shareLink.value)
        ElMessage({
            message: t("artPage.copied"),
            type: "success"
        })
        showOutputShareDialog.value = false
    }
}

function shareArtifact() {
    if (isNative) { saveText(getArtifactString(), 'application/json', 'mona-artifacts.json').catch(e => ElMessage.error(e.message)); return }
    ElNotification({
        title: t("artPage.creating"),
        message: t("artPage.createDesc"),
        duration: 2000
    })

    const str = getArtifactString()
    createRepo(str).then(response => {
        // console.log(response)
        if (response.status === 200) {
            // console.log("success")
            const code = response.data.code
            // shareLink.value = `https://mona-uranai.com/artifacts?code=${code}`
            shareLink.value = `https://mona-uranai.com/import?type=artifact&code=${code}`
            showOutputShareDialog.value = true
        }
    })
}


///////////////////////////////////////////////////////////////////
// import/export artifacts
const showImportDialog = ref(false)
const fileUploader: Ref<InstanceType<typeof ImportBlock> | null> = ref(null)
const importDeleteUnseen = ref(false)
const importBackupKumiDir = ref(false)

function handleImportJsonClicked() {
    showImportDialog.value = true;
}

// 首次使用弹窗用 /artifacts?import=1 直接打开文件导入
const route = useRoute(), router = useRouter()
watch(() => route.query.import, value => {
    if (value !== undefined && route.path === "/artifacts") {
        handleImportJsonClicked()
        router.replace({path: "/artifacts"})
    }
}, {immediate: true})

async function importJson(text: string, deleteUnseen: boolean, backupKumiDir: boolean) {
    try {
        const rawObj = JSON.parse(text)
        await importWarehouseFile(rawObj, deleteUnseen, backupKumiDir, artifactImportContext(
            presetStore.presets.value, useKumiStore().kumi.value, useMiyousheStore().data.value))
        recordUsage('action.artifact-file-import')
    } catch (e) {
        if (e === 'close' || e === 'cancel') return
        console.error('圣遗物文件导入失败', e)
        ElMessage({
            message: e instanceof Error ? e.message : String(e),
            type: "error"
        })
    }
}

function handleImportJson() {
    const component = fileUploader.value;
    if (!component) {
        return;
    }

    const loading = ElLoading.service({
        lock: true,
        text: t("artPage.importing")
    })

    if (fileUploader.value) {
        fileUploader.value
            .getReadPromise()
            .then((text: string) => {
                return importJson(text, importDeleteUnseen.value, importBackupKumiDir.value)
            })
            .catch((e: any) => {
                ElMessage({
                    message: e,
                    type: "error"
                })
            })
            .finally(() => {
                loading.close()
                showImportDialog.value = false
            });
    }
}

function getArtifactString(): string {
    let temp = {
        version: '1',
        flower: [],
        sand: [],
        feather: [],
        cup: [],
        head: []
    } as any

    for (let position of positions) {
        temp[position] = artifactStore.artifactsByPosition.value[position]
    }

    return JSON.stringify(temp)
}

async function handleOutputJsonClicked() {
    try {
        recordUsageUnlessCancelled(await downloadString(getArtifactString(), 'application/json', 'artifacts_mona'), 'action.data-export')
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : String(e))
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


// commands
function handleDropdownCommand(command: string) {
    switch (command) {
        case "add":
            handleClickAddArtifact()
            break
        case "deleteAll":
            ElMessageBox.confirm(
                t("artPage.confirmClear"),
                t("misc.hint"),
                {
                    confirmButtonText: t("misc.confirm"),
                    cancelButtonText: t("misc.cancel"),
                    type: "warning"
                }
            ).then(() => {
                deleteAllArtifacts()
            }).catch(() => {})
            break
        case "unlockAll":
            unlockAllArtifacts()
            break
        case "importJson":
            handleImportJsonClicked()
            break
        case "exportJson":
            handleOutputJsonClicked()
            break
        case "exportShare":
            shareArtifact()
            break
    }
}

function handleOutputCommand(command: string) {
    switch (command) {
        case "monaJson": {
            handleOutputJsonClicked()
            break
        }
        case "share": {
            shareArtifact()
            break
        }
    }
}
</script>

<style scoped lang="scss">
// 圣遗物页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-* 和外框的 --sh-*
// 和计算器一样：整页是一块内容区底色的圆角区域
.art-page {
    min-height: calc(100vh - 48px);
    padding: 0 clamp(10px, 1.3vw, 18px) 18px;
    box-sizing: border-box;
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);
}

.art-bar {
    position: sticky;
    top: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 6px;
    padding: 16px 0 12px;
    background: var(--cx-ground);
}

.art-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.art-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
}

.art-count {
    color: var(--cx-dim);
}

.art-spacer {
    flex: 1;
}

.art-btn {
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
        background: var(--cx-card);
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

.art-filter :deep(.el-select) {
    width: 100%;
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

.art-display-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
}

.art-display-option :deep(.art-display-check) {
    display: grid;
    place-items: center;
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    padding: 0;
    border: 1px solid var(--cx-dim);
    border-radius: 4px;
    background: var(--cx-card);
    color: var(--cx-gold-on);
    cursor: pointer;
}

.art-display-option :deep(.art-display-check[data-state="checked"]) {
    background: var(--cx-gold);
    border-color: var(--cx-gold);
}

.art-display-option :deep(.art-display-check svg) {
    display: block;
    width: 12px;
    height: 12px;
}

.art-display-option :deep(.art-display-check:focus-visible) {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

.art-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
}

// 空状态和上方筛选栏拉开距离
.art-empty {
    margin-top: 28px;
}

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

    // 手机顶栏已显示页面标题
    .art-title {
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
