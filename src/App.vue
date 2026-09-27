<template>
    <main-page></main-page>
    <el-dialog v-model="updateVisible" title="发现新版本" width="600px" class="release-update-dialog"
        :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false">
        <template v-if="availableRelease">
            <p>当前版本 {{ availableRelease.currentVersion }}，最新版本 {{ availableRelease.version }}。</p>
            <p>版本更新日志</p>
            <pre class="release-notes">{{ availableRelease.notes }}</pre>
            <el-checkbox v-model="suppressAutomaticUpdates">不再自动提示更新（仍可在关于页手动检查）</el-checkbox>
        </template>
        <template #footer>
            <el-button @click="declineUpdate">否，下次再说</el-button>
            <el-button type="primary" @click="acceptUpdate">是，前往更新</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {onMounted, onBeforeUnmount, ref} from 'vue'
import {ElMessage} from 'element-plus'
import MainPage from "@page/MainPage"
import {createReleaseCheckCoordinator, isAutomaticUpdateEnabled, setAutomaticUpdateEnabled,
    MANUAL_UPDATE_EVENT, openReleaseDownload} from '@/platform/release-update.mjs'

const updateVisible = ref(false)
const availableRelease = ref(null)
const suppressAutomaticUpdates = ref(false)
const runUpdateCheck = createReleaseCheckCoordinator(process.env.MONA_VERSION)

async function checkForUpdates(manual = false) {
    try {
        const release = await runUpdateCheck()
        if (release.newer) {
            if (!manual && !isAutomaticUpdateEnabled()) return
            if (!updateVisible.value || availableRelease.value?.version !== release.version) {
                availableRelease.value = release
                suppressAutomaticUpdates.value = false
                updateVisible.value = true
            }
        } else if (manual) ElMessage.success(`当前已是最新版本（${release.currentVersion}）`)
    } catch (error) {
        if (manual) ElMessage.error(error?.message || '检查更新失败，请稍后重试')
    }
}

function declineUpdate() {
    rememberSuppression()
    updateVisible.value = false
}

function rememberSuppression() {
    if (suppressAutomaticUpdates.value && !setAutomaticUpdateEnabled(false))
        ElMessage.error('无法保存更新偏好，下次启动仍会自动检查')
}

async function acceptUpdate() {
    if (!availableRelease.value) return
    try {
        await openReleaseDownload(availableRelease.value.downloadUrl)
        rememberSuppression()
        updateVisible.value = false
    } catch (error) { ElMessage.error(error?.message || '无法打开更新页面') }
}

const manualCheck = () => checkForUpdates(true)
onMounted(() => {
    window.addEventListener(MANUAL_UPDATE_EVENT, manualCheck)
    if (isAutomaticUpdateEnabled()) checkForUpdates()
})
onBeforeUnmount(() => window.removeEventListener(MANUAL_UPDATE_EVENT, manualCheck))
</script>

<style lang="scss">
.release-update-dialog {
    max-width: calc(100vw - 32px);
}
.release-update-dialog .release-notes {
    max-height: min(45vh, 420px);
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 6px;
    font: inherit;
}
//.el-scrollbar {
//    .el-scrollbar__bar {
//        opacity: 1!important;
//    }
//}
</style>
