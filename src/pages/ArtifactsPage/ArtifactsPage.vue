<template>
    <div class="art-page cx-scope">
        <artifact-score-dialog v-if="showScore" v-model="showScore" :item="scoreItem" :initial-character="scoreCharacter" />
        <!-- new artifact dialog -->
        <add-artifact-dialog
            v-model="newDialogVisible"
            @confirm="handleConfirmAddArtifact"
        ></add-artifact-dialog>

        <el-dialog
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

        <el-dialog v-model="showImportDialog" :title="t('misc.import')" :width="deviceIsPC ? '60%' : '90%'">
            <import-block ref="fileUploader" accept="application/json"></import-block>
            <el-checkbox v-model="importDeleteUnseen" style="margin-top: 12px">{{ t("artPage.deleteUnseen") }}</el-checkbox>
            <el-checkbox v-model="importBackupKumiDir" style="margin-top: 12px">{{ t("artPage.backupKumiDir") }}</el-checkbox>

            <template #footer>
                <el-button @click="showImportDialog = false">{{ t("misc.cancel") }}</el-button>
                <el-button type="primary" @click="handleImportJson">{{ t("misc.confirm") }}</el-button>
            </template>
        </el-dialog>

        <el-drawer :title="t('artPage.edit')" v-model="showEditArtifactDrawer" direction="rtl" :size="deviceIsPC ? '30%' : '100%'">
            <edit-artifact
                ref="editArtifactComponent"
                @confirm="handleConfirmEdit"
                @cancel="showEditArtifactDrawer = false"
            ></edit-artifact>
        </el-drawer>

        <el-drawer :title="t('artPage.recommend')" v-model="showArtifactRecommendationDrawer" :size="deviceIsPC ? '30%' : '100%'">
            <el-empty v-if="recommendationList.length === 0"></el-empty>
            <div v-else>
                <artifact-display
                    v-for="item in recommendationList"
                    :key="item[0]"
                    :item="artifactStore.artifacts.value.get(item[0])"
                    style="width: 100%; margin-bottom: 16px"
                    :show-back="true"
                    :back-value="item[1]"
                ></artifact-display>
            </div>
        </el-drawer>

        <header class="art-bar">
            <div class="art-row">
                <h2 class="art-title">{{ t("misc.artifact") }}</h2>
                <span class="art-count">共 {{ artifactStore.artifactsCount }} 件</span>
                <span class="art-spacer"></span>
                <button type="button" class="art-btn art-wide" @click="handleImportJsonClicked">{{ t("misc.import") }}</button>
                <el-dropdown class="art-wide" trigger="click" @command="handleOutputCommand">
                    <button type="button" class="art-btn">{{ t("misc.export") }} <icon-ep-arrow-down aria-hidden="true" /></button>
                    <template #dropdown><el-dropdown-menu>
                        <el-dropdown-item command="monaJson">{{ t("artPage.monaJSON") }}</el-dropdown-item>
                        <el-dropdown-item command="share">{{ isNative ? '保存分享文件' : t("artPage.shareLink") }}</el-dropdown-item>
                    </el-dropdown-menu></template>
                </el-dropdown>
                <el-dropdown trigger="click" @command="handleDropdownCommand">
                    <button type="button" class="art-btn">更多 <icon-ep-arrow-down aria-hidden="true" /></button>
                    <template #dropdown><el-dropdown-menu>
                        <template v-if="narrowArt">
                            <el-dropdown-item command="importJson">{{ t("misc.import") }}</el-dropdown-item>
                            <el-dropdown-item command="exportJson">{{ t("artPage.exportMona") }}</el-dropdown-item>
                            <el-dropdown-item command="exportShare">{{ isNative ? '保存分享文件' : t("artPage.shareLink") }}</el-dropdown-item>
                        </template>
                        <el-dropdown-item command="unlockAll" :divided="narrowArt">{{ t("artPage.unlockAll") }}</el-dropdown-item>
                        <el-dropdown-item command="recommend">{{ t("misc.recommend") }}</el-dropdown-item>
                        <el-dropdown-item command="deleteAll" divided class="art-danger">{{ t("misc.clear") }}</el-dropdown-item>
                    </el-dropdown-menu></template>
                </el-dropdown>
                <button type="button" class="art-add" @click="handleClickAddArtifact">＋ 新增圣遗物</button>
            </div>

            <nav class="art-slots" aria-label="部位">
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
                <div class="art-filter">
                    <el-select v-model="scoreCharacter" filterable clearable
                        placeholder="评分角色" aria-label="喵喵评分排序角色">
                        <el-option v-for="name in scoreCharacterOptions" :key="name" :label="name" :value="name" />
                    </el-select>
                </div>
                <el-checkbox v-model="filterGe16">{{ t("artPage.show16") }}</el-checkbox>
            </div>
        </header>

        <div v-if="pagedArtifacts.length" class="art-grid">
            <artifact-card v-for="{ item, score } in pagedArtifacts" :key="item.id" :item="item" :score="score"
                :score-label="scoreCharacter" :grade="score === null ? undefined : getMarkClass(score)"
                :selected="item.id === openedArtifactId" @open="openArtifact(item.id)" />
        </div>
        <el-empty v-else></el-empty>

        <div v-if="artifactToBeDisplayed.length > pageSize" class="art-pager">
            <el-pagination v-model:current-page="page" :page-size="pageSize" :total="artifactToBeDisplayed.length"
                layout="prev, pager, next" :pager-count="narrowArt ? 5 : 7" />
            <span>每页 {{ pageSize }} 件</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import ArtifactScoreDialog from '@/components/display/ArtifactScoreDialog.vue'
import { scoreCharacterNames, rankingContext, scoreBuild, getMarkClass } from '@/algorithms/artifact-score/score.mjs'
import {importMonaJson} from '@/utils/artifacts'
import {artifactImportContext} from '@/import/level-zero-match.cjs'
import {useKumiStore} from '@/store/pinia/kumi'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import {positions} from '@/constants/artifact'
import {downloadString} from '@/utils/common'
import {recordUsage, recordUsageUnlessCancelled} from '@/usage-stats/index.mjs'
import {deviceIsPC} from "@/utils/device"
import {createRepo} from "@/api/repo"
import {type Ref} from "vue"
import {useArtifactStore} from "@/store/pinia/artifact"
import { isNative, saveText } from '@/platform/native.mjs'
import {usePresetStore} from "@/store/pinia/preset"
import {getArtifactsRecommendation} from "@/utils/artifactRecommendation"

import flowerIcon from '@image/misc/flower.png';
import featherIcon from '@image/misc/feather.png';
import sandIcon from '@image/misc/sand.png';
import gobletIcon from '@image/misc/goblet.png';
import headIcon from '@image/misc/head.png';

import AddArtifactDialog from './AddArtifactDialog';
import SelectArtifactSet from '@c/select/SelectArtifactSet';
import SelectArtifactMainStat from '@c/select/SelectArtifactMainStat';
import ArtifactDisplay from '@c/display/ArtifactDisplay';
import ArtifactCard from './ArtifactCard.vue';
import {useScreen} from '@/composables/screen';
import EditArtifact from './EditArtifact';
import ImportBlock from '@c/misc/ImportBlock';
import {type ArtifactPosition, ArtifactSetName, ArtifactStatName, IArtifactContentOnly} from "@/types/artifact"
// import {ElLoading, ElMessage, ElMessageBox, ElNotification} from "element-plus"
// import {ElMessage} from "element-plus"

import IconEpPlus from "~icons/ep/plus"
import IconEpUnlock from "~icons/ep/unlock"
import IconFa6Lightbulb from "~icons/fa6-regular/lightbulb"
import IconEpMore from "~icons/ep/more"
import IconEpDelete from "~icons/ep/delete"
import IconFa6PaperPlane from "~icons/fa6-regular/paper-plane"
import IconFa6SolidUpload from "~icons/fa6-solid/upload"
import IconFa6SolidShareNodes from "~icons/fa6-solid/share-nodes"
import IconFa6SolidDownload from "~icons/fa6-solid/download"
import {useI18n} from "@/i18n/i18n"

import "element-plus/es/components/message/style/css"

// i18n
const { t } = useI18n()
const mobileUI = process.env.MONA_MOBILE


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
const scoreCharacterOptions = [...scoreCharacterNames].sort((a, b) => a.localeCompare(b, 'zh-CN'))

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

// 点卡片：打开详情（详情抽屉见 03，暂时打开评分弹窗）
const openedArtifactId = ref(-1)
function openArtifact(id: number) {
    openedArtifactId.value = id
    scoreArtifactId.value = id
    showScore.value = true
}


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

async function importJson(text: string, deleteUnseen: boolean, backupKumiDir: boolean) {
    try {
        const rawObj = JSON.parse(text)
        await importMonaJson(rawObj, deleteUnseen, backupKumiDir, artifactImportContext(
            presetStore.presets.value, useKumiStore().kumi.value, useMiyousheStore().data.value))
        recordUsage('action.artifact-file-import')
    } catch (e) {
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
const showEditArtifactDrawer = ref(false)
const editArtifactComponent: Ref<InstanceType<typeof EditArtifact> | null> = ref(null)

function handleClickEditArtifact(id: number) {
    showEditArtifactDrawer.value = true;

    nextTick(() => {
        if (editArtifactComponent.value) {
            editArtifactComponent.value.setId(id)
        }
    });
}

function handleConfirmEdit(id: number) {
    if (editArtifactComponent.value) {
        const newArtifact: IArtifactContentOnly = editArtifactComponent.value.getNewArtifact() as IArtifactContentOnly
        artifactStore.updateArtifact(id, newArtifact)
    }

    showEditArtifactDrawer.value = false
}


///////////////////////////////////////////////////////////////////
// artifacts recommendation
const showArtifactRecommendationDrawer = ref(false)
const recommendationList: Ref<[number, number][]> = ref([])
const recommendationInCalculation = ref(false)


function handleClickRecommendation() {
    if (presetStore.allFlat.value.length === 0) {
        ElMessage.error({
            message: t("artPage.msg1")
        })
        return
    }

    recommendationList.value = [];
    showArtifactRecommendationDrawer.value = true;

    getArtifactsRecommendation().then(({ scores, skipped }) => {
        if (skipped.length) ElMessage.warning(`有 ${skipped.length} 个预设不支持静态推荐评分，已跳过；可在计算器使用实际配装。${skipped.join('；')}`)
        let temp = scores.slice(0, 50);
        const maxValue = temp.map((item) => item[1]).reduce((p, c) => Math.max(p, c), 0);

        for (let i = 0; i < temp.length; i++) {
            temp[i][1] = maxValue > 0 ? temp[i][1] / maxValue : 0;
        }

        recommendationList.value = temp as [number, number][];
    }).catch((error: any) => ElMessage.error(error.message || String(error)));
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
        case "recommend":
            handleClickRecommendation()
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

.art-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 14px;
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

    .art-filter {
        width: calc(50% - 5px);
    }

    .art-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

.score-sort {
    width: 240px;

    .el-select {
        width: 100%;
    }
}

.artifact-score {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    border-top: 1px solid var(--el-border-color-lighter);
    font-size: 12px;
    color: var(--el-text-color-secondary);

    strong {
        color: var(--el-color-primary);
    }
}

@media only screen and (min-width: 992px) {
    .filter {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;

        .filter-item {
            display: inline-block;
            vertical-align: top;
        }

        .show-only-16 {
            margin-left: 16px;
        }
    }
}

@media only screen and (max-width: 992px) {
    .filter {
        margin-bottom: 12px;

        .score-sort {
            width: 100%;
            margin-top: 4px;
        }

        .filter-item {
            .el-select {
                width: 100%;
            }
        }

        .show-only-16 {
            margin-top: 4px;
        }
    }


}

.toolbar-mobile {
    position: relative;
    .m-center {
        position: absolute;
        left: 50%;
        transform: translateX(-50%) translateY(-50%);
        top: 50%;
        //top: 0;
        font-size: 12px;
        color: #606166;
    }
}

.icon {
    padding: 0 12px;
}

.artifacts-div {
    box-sizing: border-box;
    //height: 100vh;
    display: grid;
    gap: 4px;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    grid-auto-columns: 1fr;
    grid-auto-rows: min-content;

    .artifact-item {
        width: 100%;
        box-sizing: border-box;
        //width: 20%;
        //width: 200px;
    }
}

.tool-bar {
    margin-bottom: 16px;
    margin-top: 16px;
}

.tool-bar .tool-right {
    float: right;
}
</style>

<style scoped src="../../styles/artifact-score.css"></style>
