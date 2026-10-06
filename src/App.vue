<template>
    <main-page></main-page>
    <el-dialog v-model="updateVisible" title="发现新版本" width="600px" class="release-update-dialog"
        :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false">
        <template v-if="availableRelease">
            <p>当前版本 {{ availableRelease.currentVersion }}，最新版本 {{ availableRelease.version }}。</p>
            <p>版本更新日志</p>
            <pre class="release-notes">{{ availableRelease.notes }}</pre>
            <template v-if="platform?.canInstall">
                <div class="update-source-header">
                    <span>第三方下载加速</span>
                    <el-switch v-model="accelerated" :disabled="busy || testing" @change="changeAcceleration" />
                    <el-button :loading="testing" :disabled="busy" @click="testSources">检测线路</el-button>
                </div>
                <el-radio-group v-model="selectedSource" class="update-sources" :disabled="busy || testing">
                    <el-radio v-for="source in sources" :key="source.id" :label="source.id" :disabled="!!source.error">
                        {{ source.name }} {{ source.error || (source.speed ? formatBytes(source.speed) + '/s · ' + source.elapsed + ' ms' : '') }}
                    </el-radio>
                </el-radio-group>
                <el-progress v-if="progress.phase !== 'idle'" :percentage="percentage"
                    :status="progress.phase === 'error' ? 'exception' : undefined" />
                <p v-if="progress.phase === 'downloading'">
                    {{ formatBytes(progress.downloaded) }} / {{ formatBytes(progress.total) }}
                    · {{ formatBytes(speed) }}/s
                </p>
                <p v-if="updateError" class="update-error">{{ updateError }}</p>
            </template>
            <el-checkbox v-model="suppressAutomaticUpdates">不再自动提示更新（仍可在关于页手动检查）</el-checkbox>
        </template>
        <template #footer>
            <el-button v-if="progress.phase === 'downloading'" @click="cancelDownload">取消下载</el-button>
            <el-button v-else :disabled="busy" @click="declineUpdate">下次再说</el-button>
            <el-button type="primary" :loading="busy" :disabled="testing || !platform || !selectedSource || progress.phase === 'installing'" @click="acceptUpdate">
                {{ progress.phase === 'installing' ? '正在安装' : progress.phase === 'ready' ? '安装更新' : platform?.canInstall ? '下载并更新' : '下载更新包' }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {onMounted, onBeforeUnmount, ref, computed} from 'vue'
import {ElMessage} from 'element-plus'
import MainPage from "@page/MainPage"
import {createReleaseCheckCoordinator, isAutomaticUpdateEnabled, setAutomaticUpdateEnabled,
    MANUAL_UPDATE_EVENT, openReleaseDownload, UPDATE_SOURCES, releaseAsset,
    isAcceleratedUpdateEnabled, setAcceleratedUpdateEnabled, getUpdatePlatform, probeUpdateSource,
    startUpdateDownload, getUpdateStatus, cancelUpdateDownload, installDownloadedUpdate} from '@/platform/release-update.mjs'

const updateVisible = ref(false), availableRelease = ref(null), suppressAutomaticUpdates = ref(false)
const platform = ref(null), accelerated = ref(isAcceleratedUpdateEnabled()), sources = ref([])
const selectedSource = ref('github'), testing = ref(false), busy = ref(false), updateError = ref('')
const progress = ref({phase: 'idle', downloaded: 0, total: 0}), speed = ref(0)
let cancelRequested = false
const percentage = computed(() => progress.value.total > 0 ?
    Math.min(100, Math.round(progress.value.downloaded / progress.value.total * 100)) : 0)
const formatBytes = value => (Math.max(0, value || 0) / 1048576).toFixed(2) + ' MB'
const runUpdateCheck = createReleaseCheckCoordinator(process.env.MONA_VERSION)

async function checkForUpdates(manual = false) {
    if (updateVisible.value) return
    try {
        const release = await runUpdateCheck()
        if (release.newer) {
            if (!manual && !isAutomaticUpdateEnabled()) return
            availableRelease.value = release
            suppressAutomaticUpdates.value = false
            updateVisible.value = true
            updateError.value = ''
            platform.value = await getUpdatePlatform()
            if (platform.value.canInstall) {
                progress.value = await getUpdateStatus()
                if (progress.value.version !== release.version) progress.value = {phase: 'idle', downloaded: 0, total: 0}
                await testSources()
            } else sources.value = [UPDATE_SOURCES[0]]
        } else if (manual) ElMessage.success('当前已是最新版本（' + release.currentVersion + '）')
    } catch (error) {
        console.error(error)
        updateError.value = error.message
        if (manual || updateVisible.value) ElMessage.error(error.message)
    }
}
async function changeAcceleration() {
    try {setAcceleratedUpdateEnabled(accelerated.value); await testSources()}
    catch (error) {updateError.value = error.message}
}
async function testSources() {
    testing.value = true; updateError.value = ''
    const candidates = accelerated.value ? UPDATE_SOURCES : UPDATE_SOURCES.slice(0, 1)
    const results = await Promise.all(candidates.map(async source => {
        try {
            const result = await probeUpdateSource(availableRelease.value, platform.value.kind, source.id)
            return {...source, ...result}
        } catch (error) {return {...source, error: error.message}}
    }))
    sources.value = results.sort((a, b) => (b.speed || 0) - (a.speed || 0))
    selectedSource.value = sources.value.find(source => !source.error)?.id || ''
    testing.value = false
}
function rememberSuppression() {
    if (suppressAutomaticUpdates.value && !setAutomaticUpdateEnabled(false))
        ElMessage.error('无法保存更新偏好，下次启动仍会自动检查')
}
function declineUpdate() {rememberSuppression(); updateVisible.value = false}
async function cancelDownload() {
    cancelRequested = true
    try {progress.value = await cancelUpdateDownload()}
    catch (error) {updateError.value = error.message}
}
async function acceptUpdate() {
    busy.value = true; updateError.value = ''; cancelRequested = false
    try {
        if (!platform.value.canInstall) {
            await openReleaseDownload(releaseAsset(availableRelease.value, platform.value.kind).browser_download_url)
            rememberSuppression(); updateVisible.value = false
            return
        }
        if (progress.value.phase !== 'ready') {
            if (progress.value.phase !== 'downloading')
                progress.value = await startUpdateDownload(availableRelease.value, platform.value.kind, selectedSource.value)
            let tick = Date.now(), previous = progress.value.downloaded
            while (progress.value.phase === 'downloading' && !cancelRequested) {
                await new Promise(resolve => setTimeout(resolve, 500))
                progress.value = await getUpdateStatus()
                const now = Date.now()
                speed.value = (progress.value.downloaded - previous) * 1000 / Math.max(1, now - tick)
                tick = now; previous = progress.value.downloaded
            }
        }
        if (cancelRequested) return
        if (progress.value.phase === 'error') throw new Error(progress.value.error)
        if (progress.value.phase === 'ready') {
            rememberSuppression()
            await installDownloadedUpdate()
            progress.value.phase = 'installing'
        }
    } catch (error) {
        updateError.value = error.message
        ElMessage.error(error.message)
    } finally {busy.value = false}
}
let automaticTimer
const manualCheck = () => checkForUpdates(true)
onMounted(() => {
    window.addEventListener(MANUAL_UPDATE_EVENT, manualCheck)
    if (isAutomaticUpdateEnabled()) checkForUpdates()
    automaticTimer = setInterval(() => {if (isAutomaticUpdateEnabled()) checkForUpdates()}, 60 * 60 * 1000)
})
onBeforeUnmount(() => {
    clearInterval(automaticTimer)
    window.removeEventListener(MANUAL_UPDATE_EVENT, manualCheck)
})
</script>

<style lang="scss">
.release-update-dialog {max-width: calc(100vw - 32px);}
.release-update-dialog .release-notes {
    max-height: min(35vh, 340px); overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere;
    padding: 12px; background: #f5f7fa; border-radius: 6px; font: inherit;
}
.update-source-header {display: flex; align-items: center; gap: 12px; margin: 16px 0 8px;}
.update-sources {display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 12px;}
.update-error {color: #f56c6c; overflow-wrap: anywhere;}
</style>
