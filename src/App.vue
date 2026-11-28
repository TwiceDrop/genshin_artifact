<template>
    <!-- Element 组件自带的默认文字（暂无数据、无匹配数据等）跟随界面语言，原来没设置时一律是英文 -->
    <el-config-provider :locale="elementLocale">
    <ContentShareDialog />
    <CalculationToaster />
    <ArtifactPromptDialog :controller="legacyArtifactShareDialogs" width="min(420px, calc(100vw - 32px))" />
    <main-page></main-page>
    <usage-stats-notice v-if="!migrationNoticePending" />
    <OnboardingHubDialog />
    <OnboardingOverlay />
    <web-version-notice v-if="migrationNoticePending" @closed="migrationNoticePending = false" />
    <UiDialog v-model="updateVisible" title="发现新版本" width="var(--app-dialog-width, 600px)" top="var(--app-dialog-top)"
        content-class="app-dialog release-update-dialog" focus-container hide-close prevent-outside
        @escape-key-down="$event.preventDefault()">
        <template v-if="availableRelease">
            <p>当前版本 {{ availableRelease.currentVersion }}，最新版本 {{ availableRelease.version }}。</p>
            <p>版本更新日志</p>
            <pre class="release-notes">{{ availableRelease.notes }}</pre>
            <template v-if="platform?.canInstall">
                <div v-if="progress.phase !== 'idle'" class="update-progress" :class="{ 'update-progress-error': progress.phase === 'error' }">
                    <ProgressRoot class="update-progress-track" :model-value="percentage" aria-label="下载进度">
                        <ProgressIndicator class="update-progress-fill" :style="{ width: percentage + '%' }" />
                    </ProgressRoot>
                    <span class="update-progress-value" aria-hidden="true">
                        <i-ep-circle-close-filled v-if="progress.phase === 'error'" />
                        <template v-else>{{ percentage }}%</template>
                    </span>
                </div>
                <p v-if="downloadActive">
                    {{ formatBytes(progress.downloaded) }} / {{ formatBytes(progress.total) }}
                    · {{ formatBytes(speed) }}/s
                </p>
                <p v-if="progress.message">{{ progress.message }}</p>
                <p v-if="updateError" class="update-error">{{ updateError }}</p>
            </template>
            <UiCheckbox v-model="suppressAutomaticUpdates" class="update-suppression">
                不再自动提示更新（仍可在关于页手动检查）
            </UiCheckbox>
        </template>
        <template #footer>
            <div class="update-download-actions">
                <UiButton class="update-cnb-button" :loading="busy"
                    :disabled="!platform || progress.phase === 'installing'" @click="acceptUpdate('cnb')">
                    {{ progress.phase === 'installing' ? '正在安装' : progress.phase === 'ready' ? '安装更新' : busy ? '正在下载' : '使用 CNB 下载（推荐）' }}
                </UiButton>
                <UiButton ref="otherSourceTrigger" class="update-other-button"
                    :disabled="busy || !platform || progress.phase === 'installing'" @click="openOtherSources">
                    使用其他下载源下载
                </UiButton>
            </div>
            <UiButton v-if="downloadActive" @click="cancelDownload">取消下载</UiButton>
            <UiButton v-else :disabled="busy" @click="declineUpdate">下次再说</UiButton>
        </template>
    </UiDialog>
    <UiDialog v-model="otherSourcesVisible" title="其他下载源" width="var(--app-dialog-width, 600px)" top="var(--app-dialog-top)"
        content-class="app-dialog release-update-dialog" focus-container :return-focus="restoreOtherSourceFocus">
        <UiButton v-if="platform?.canInstall" :loading="testing" @click="testSources">检测线路</UiButton>
        <RadioGroupRoot v-model="otherSource" class="update-sources" orientation="vertical" aria-label="其他下载源" :disabled="testing">
            <RadioGroupItem v-for="source in sources" :key="source.id" :value="source.id"
                class="update-source-option" :disabled="!!source.error">
                <span class="update-source-radio" aria-hidden="true"><RadioGroupIndicator /></span>
                {{ source.name }} {{ source.error || (source.speed ? formatBytes(source.speed) + '/s · ' + source.elapsed + ' ms' : '') }}
            </RadioGroupItem>
        </RadioGroupRoot>
        <template #footer>
            <UiButton @click="otherSourcesVisible = false">返回</UiButton>
            <UiButton variant="primary" :disabled="testing || !otherSource" @click="acceptOtherSource">
                {{ platform?.canInstall ? '下载并更新' : '下载更新包' }}
            </UiButton>
        </template>
    </UiDialog>
    </el-config-provider>
</template>

<script setup>
import {onMounted, onBeforeUnmount, ref, computed, watch} from 'vue'
import {useRoute} from 'vue-router'
import {createPatchChecker, startPatchChecks} from '@/platform/patch-update.mjs'
import {refreshPatchInfo} from '@/platform/patch-info.mjs'
import {isNative} from '@/platform/native.mjs'
import {shouldShowWebVersionNotice} from '@/platform/web-version.mjs'
import {ProgressIndicator, ProgressRoot, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot} from 'radix-vue'
import {elementLocale} from '@/i18n/element-locale'
import {showCalculationNotice} from '@/store/calculation-history'
import ContentShareDialog from '@/components/share/ContentShareDialog.vue'
import CalculationToaster from '@/components/CalculationToaster.vue'
import ArtifactPromptDialog from '@/pages/ArtifactsPage/ArtifactPromptDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { legacyArtifactShareDialogs } from '@/import/legacy-artifact-share-dialogs'
import MainPage from "@page/MainPage"
import UsageStatsNotice from "@/components/UsageStatsNotice.vue"
import OnboardingHubDialog from "@/onboarding/OnboardingHubDialog.vue"
import OnboardingOverlay from "@/onboarding/OnboardingOverlay.vue"
import WebVersionNotice from "@/components/WebVersionNotice.vue"
import {recordUsage} from "@/usage-stats/index.mjs"
import {createReleaseCheckCoordinator, isAutomaticUpdateEnabled, setAutomaticUpdateEnabled,
    MANUAL_UPDATE_EVENT, openReleaseDownload, UPDATE_SOURCES, findReleaseAsset, releaseAsset,
    sourceUrl, getUpdatePlatform, probeUpdateSource,
    startUpdateDownload, getUpdateStatus, getResumableUpdateStatus, cancelUpdateDownload, installDownloadedUpdate} from '@/platform/release-update.mjs'

const migrationNoticePending = ref(shouldShowWebVersionNotice({
    development: process.env.NODE_ENV === 'development',
    native: isNative,
    tauri: window.__MONA_TAURI__ === true,
}))
const updateVisible = ref(false), availableRelease = ref(null), suppressAutomaticUpdates = ref(false)
const platform = ref(null), sources = ref([]), otherSourcesVisible = ref(false)
const otherSource = ref('github'), testing = ref(false), busy = ref(false), updateError = ref('')
const otherSourceTrigger = ref(null)
const progress = ref({phase: 'idle', downloaded: 0, total: 0}), speed = ref(0)
const downloadActive = computed(() => ['pending', 'downloading', 'paused'].includes(progress.value.phase))
let cancelRequested = false
const percentage = computed(() => progress.value.total > 0 ?
    Math.min(100, Math.round(progress.value.downloaded / progress.value.total * 100)) : 0)
const formatBytes = value => (Math.max(0, value || 0) / 1048576).toFixed(2) + ' MB'
const runUpdateCheck = createReleaseCheckCoordinator(process.env.MONA_VERSION)

async function checkForUpdates(manual = false) {
    if (updateVisible.value) return
    try {
        const release = await runUpdateCheck()
        if (!manual && !isAutomaticUpdateEnabled()) return
        const detectedPlatform = release.newer ? await getUpdatePlatform() : null
        if (updateVisible.value) return
        if (!detectedPlatform || !findReleaseAsset(release, detectedPlatform.kind)) {
            if (manual) showCalculationNotice('success', '当前已是最新版本（' + release.currentVersion + '）')
            return
        }
        availableRelease.value = release
        suppressAutomaticUpdates.value = false
        updateVisible.value = true
        otherSourcesVisible.value = false
        sources.value = []
        otherSource.value = 'github'
        updateError.value = ''
        platform.value = null
        progress.value = {phase: 'idle', downloaded: 0, total: 0}
        try {
            if (detectedPlatform.canInstall)
                progress.value = await getResumableUpdateStatus(release, detectedPlatform.kind)
        } finally {platform.value = detectedPlatform}
    } catch (error) {
        console.error(error)
        updateError.value = error.message
        if (manual || updateVisible.value) showCalculationNotice('error', error.message)
    }
}
async function openOtherSources() {
    otherSourcesVisible.value = true
    if (platform.value.canInstall) await testSources()
    else sources.value = [UPDATE_SOURCES.find(source => source.id === 'github')]
}
function restoreOtherSourceFocus() {
    if (!updateVisible.value) return
    const trigger = otherSourceTrigger.value?.$el
    const target = trigger?.disabled ? trigger.closest('[role="dialog"]') : trigger
    target?.focus({ preventScroll: true })
}
async function acceptOtherSource() {
    otherSourcesVisible.value = false
    await acceptUpdate(otherSource.value)
}
async function testSources() {
    testing.value = true; updateError.value = ''
    const candidates = UPDATE_SOURCES.filter(source => platform.value.kind === 'tauri' ? source.id === 'github' : source.id !== 'cnb')
    const results = await Promise.all(candidates.map(async source => {
        try {
            const result = await probeUpdateSource(availableRelease.value, platform.value.kind, source.id)
            return {...source, ...result}
        } catch (error) {return {...source, error: error.message}}
    }))
    sources.value = results.sort((a, b) => (b.speed || 0) - (a.speed || 0))
    otherSource.value = sources.value.find(source => !source.error)?.id || ''
    testing.value = false
}
function rememberSuppression() {
    if (suppressAutomaticUpdates.value && !setAutomaticUpdateEnabled(false))
        showCalculationNotice('error', '无法保存更新偏好，下次启动仍会自动检查')
}
function declineUpdate() {rememberSuppression(); updateVisible.value = false}
async function cancelDownload() {
    cancelRequested = true
    try {progress.value = await cancelUpdateDownload()}
    catch (error) {updateError.value = error.message}
}
async function acceptUpdate(source = 'cnb') {
    busy.value = true; updateError.value = ''; cancelRequested = false
    try {
        if (!platform.value.canInstall) {
            await openReleaseDownload(sourceUrl(releaseAsset(availableRelease.value, platform.value.kind).browser_download_url, source))
            rememberSuppression(); updateVisible.value = false
            return
        }
        if (progress.value.phase !== 'ready') {
            if (!downloadActive.value)
                progress.value = await startUpdateDownload(availableRelease.value, platform.value.kind, source)
            let tick = Date.now(), previous = progress.value.downloaded
            while (downloadActive.value && !cancelRequested) {
                await new Promise(resolve => setTimeout(resolve, 500))
                const status = await getUpdateStatus()
                if (cancelRequested) break
                progress.value = status
                const now = Date.now()
                speed.value = (progress.value.downloaded - previous) * 1000 / Math.max(1, now - tick)
                tick = now; previous = progress.value.downloaded
            }
        }
        if (cancelRequested) return
        if (progress.value.phase === 'error') throw new Error(progress.value.error)
        if (progress.value.phase === 'ready') {
            rememberSuppression()
            recordUsage('action.update-install')
            await installDownloadedUpdate()
            progress.value.phase = 'installing'
        }
    } catch (error) {
        updateError.value = error.message
        showCalculationNotice('error', error.message)
    } finally {busy.value = false}
}
let automaticTimer, patchChecks
const route = useRoute()
// 内容补丁：打开计算页时也查一次（不短于最小间隔），装好的补丁下次启动生效
watch(() => route.name, name => { if (name === 'calculate') patchChecks?.requestCheck() })
const manualCheck = () => { recordUsage('action.update-check'); return checkForUpdates(true) }
onMounted(() => {
    window.addEventListener(MANUAL_UPDATE_EVENT, manualCheck)
    refreshPatchInfo()
    patchChecks = startPatchChecks({check: createPatchChecker({onResult: () => refreshPatchInfo()})})
    if (isAutomaticUpdateEnabled()) checkForUpdates()
    automaticTimer = setInterval(() => {if (isAutomaticUpdateEnabled()) checkForUpdates()}, 60 * 60 * 1000)
})
onBeforeUnmount(() => {
    clearInterval(automaticTimer)
    patchChecks?.stop()
    window.removeEventListener(MANUAL_UPDATE_EVENT, manualCheck)
})
</script>

<style lang="scss">
html .ui-dialog.app-dialog {--app-dialog-top: var(--app-dialog-desktop-top, 15vh); max-width: 100vw;}
.ui-dialog.app-dialog > header {flex-shrink: 0; min-height: 0; padding: 20px 20px 10px;}
.ui-dialog.app-dialog .ui-dialog-title {font-weight: 400; line-height: 24px; padding: 0;}
.ui-dialog.app-dialog > .ui-dialog-body {padding: 30px 20px; font-size: 14px; overflow-wrap: anywhere;}
.ui-dialog.app-dialog > footer {flex-shrink: 0; padding: 10px 20px 20px;}
.ui-dialog.app-dialog > .ui-dialog-body > [data-slot="button"],
.ui-dialog.app-dialog > footer > [data-slot="button"] {min-height: 32px;}
.ui-dialog.app-dialog > footer > [data-slot="button"] + [data-slot="button"] {margin-inline-start: 12px;}
.ui-dialog.release-update-dialog {--app-dialog-desktop-top: 24px;}
.update-suppression {max-width: 100%; line-height: 1.5;}
.release-update-dialog .release-notes {
    box-sizing: border-box; width: 100%; max-height: min(35vh, 340px); overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere;
    padding: 12px; background: var(--cx-step); border-radius: 6px; font: inherit;
}
.update-download-actions {display: flex; flex-direction: column; gap: 10px; width: 100%; margin-bottom: 16px;}
.ui-dialog.app-dialog .update-download-actions [data-slot="button"] {width: 100%; min-height: 42px; white-space: normal;}
.update-download-actions .update-cnb-button {background: #16a34a; border-color: #16a34a; color: #fff;}
.update-download-actions .update-cnb-button:hover:enabled {background: #15803d;}
.update-download-actions [data-slot="button"]:disabled {opacity: .55;}
.update-sources {display: flex; flex-direction: column; align-items: flex-start; margin: 16px 0 12px;}
.update-source-option {
    display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 32px;
    padding: 0; border: 0; background: transparent; color: inherit; font: inherit; line-height: 1.5; text-align: start; cursor: pointer;
}
.update-source-option:disabled {color: var(--cx-dim); opacity: .65; cursor: default;}
.update-source-option:focus-visible {outline: 2px solid var(--cx-gold); outline-offset: 2px;}
.update-source-radio {
    display: grid; place-items: center; flex: 0 0 14px; width: 14px; height: 14px; box-sizing: border-box;
    border: 1px solid var(--cx-dim); border-radius: 50%;
}
.update-source-option[data-state="checked"] .update-source-radio {border-color: var(--cx-gold);}
.update-source-radio > span {width: 6px; height: 6px; border-radius: 50%; background: var(--cx-gold);}
.update-progress {display: flex; align-items: center; gap: 5px; color: var(--cx-dim); font-variant-numeric: tabular-nums;}
.update-progress-track {flex: 1; overflow: hidden; height: 6px; border-radius: 999px; background: var(--cx-step-2);}
.update-progress-fill {height: 100%; border-radius: inherit; background: var(--cx-gold);}
.update-progress-value {min-width: 50px; font-size: 14px;}
.update-progress-error {color: var(--cx-up);}
.update-progress-error .update-progress-fill {background: var(--cx-up);}
.update-error {color: var(--cx-up); overflow-wrap: anywhere;}
@media (min-width: 768px) {
    .ui-dialog.app-dialog.release-update-dialog {max-width: calc(100vw - 32px); max-height: calc(100vh - 48px);}
}
@media (max-width: 767px) {
    html .ui-dialog.app-dialog {
        --app-dialog-top: calc(8px + env(safe-area-inset-top));
        --app-dialog-width: calc(100vw - 16px);
        max-width: none;
        max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
    .ui-dialog.app-dialog > header {padding: 18px 16px 12px;}
    .ui-dialog.app-dialog > .ui-dialog-body,
    .ui-dialog.app-dialog > footer {padding: 12px 16px;}
    .ui-dialog.app-dialog > .ui-dialog-body > [data-slot="button"],
    .ui-dialog.app-dialog > footer > [data-slot="button"] {min-height: 40px;}
}
</style>
