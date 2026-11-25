<template>
    <el-dialog :model-value="welcomeVisible || controller.hubOpen" :title="welcomeVisible ? '欢迎使用莫娜占卜铺' : '使用引导'"
               width="min(680px, 94vw)" custom-class="onboarding-hub cx-scope" modal-class="onboarding-backdrop" append-to-body
               :show-close="!welcomeVisible" :close-on-click-modal="!welcomeVisible" :close-on-press-escape="!welcomeVisible"
               @update:model-value="closeHub">
        <template v-if="welcomeVisible">
            <p class="welcome-lead">还没有圣遗物和预设。可以花 1 分钟快速了解核心功能，或先导入已有数据。</p>
            <div class="welcome-actions">
                <el-button type="primary" @click="beginQuickGuide">开始快速上手（约 1 分钟）</el-button>
                <el-button :aria-expanded="importsOpen" @click="importsOpen = !importsOpen">先导入我的数据</el-button>
                <div v-if="importsOpen" class="import-options">
                    <el-button v-if="loggedIn" @click="chooseImport('/online-account')">从云端账号导入</el-button>
                    <el-button @click="chooseImport('/uid-data')">通过 UID 导入</el-button>
                    <el-button @click="chooseImport('/artifacts?import=1')">导入圣遗物文件</el-button>
                </div>
            </div>
        </template>
        <div v-else class="guide-list">
            <article v-for="guide in ONBOARDING_GUIDES" :key="guide.id" class="guide-row" :class="{quick: guide.kind === 'quick'}">
                <div>
                    <h3>{{ guide.title }}</h3>
                    <p>{{ guide.summary }}</p>
                    <small>{{ guide.steps.length }} 步 <span v-if="completed(guide.id)">· 已完成</span></small>
                </div>
                <el-button :type="guide.kind === 'quick' ? 'primary' : 'default'" @click="startGuide(guide.id, router)">
                    {{ completed(guide.id) ? '再看一遍' : '开始' }}
                </el-button>
            </article>
        </div>
        <template #footer>
            <el-button v-if="welcomeVisible" link @click="skipWelcome">先自己逛逛</el-button>
            <el-button v-else :disabled="!controller.completedIds.length" @click="resetProgress">重置引导进度</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {ElMessage} from 'element-plus'
import backend from '@/store/backend'
import {accountReady, useAccountStore} from '@/store/pinia/account'
import {cloudApi} from '@/platform/cloud.mjs'
import {usageStatsAvailable, usageStatsConsent} from '@/usage-stats/index.mjs'
import {closeHub, controller, dismissWelcome, resetProgress, startGuide} from './controller.mjs'
import {loadOnboardingState, readFirstUseDone, shouldShowWelcome} from './state.mjs'
import {ONBOARDING_GUIDES} from './guides.mjs'

const route = useRoute(), router = useRouter()
const loggedIn = ref(false), importsOpen = ref(false)
const eligiblePage = computed(() => route.matched.length > 0 && route.name !== 'login' && route.path !== '/import'
    && !(route.name === 'setup' && route.hash === '#export-data')
    && !(usageStatsAvailable && usageStatsConsent.value === null))
const welcomeVisible = computed(() => eligiblePage.value && controller.welcomeOpen && !controller.hubOpen && !controller.activeGuideId)
const completed = id => controller.completedIds.includes(id)
let decided = false

watch(eligiblePage, async (eligible, previous, onCleanup) => {
    if (!eligible || decided) return
    let current = true
    onCleanup(() => { current = false })
    const state = loadOnboardingState(), firstUseDone = readFirstUseDone()
    if (state.welcomeDismissed || firstUseDone) {
        decided = true
        return
    }
    try {
        await accountReady
        await backend.allReady()
        const accountData = await Promise.all(useAccountStore().allAccounts.map(async ({id}) => ({
            artifacts: await backend.getItem(`mona_account_artifacts_${id}`),
            presets: await backend.getItem(`mona_account_presets_${id}`),
        })))
        if (!current) return
        decided = true
        if (!shouldShowWelcome({state: loadOnboardingState(), firstUseDone: readFirstUseDone(), accountData}) || controller.hubOpen || controller.activeGuideId) return
        controller.welcomeOpen = true
    } catch (error) {
        console.error('判断是否显示首次欢迎卡失败', error)
        return
    }
    try {
        loggedIn.value = !!(await cloudApi('config')).user
    } catch (error) {
        console.error('读取引导云端登录状态失败', error)
    }
}, {immediate: true})

function beginQuickGuide() {
    dismissWelcome()
    startGuide('quick-start', router)
}
function chooseImport(path) {
    dismissWelcome()
    router.push(path)
}
function skipWelcome() {
    dismissWelcome()
    ElMessage.info('随时可以从侧栏「使用引导」或设置页重新打开。')
}
</script>

<style>
@media (prefers-reduced-motion: reduce) {
    .onboarding-backdrop.dialog-fade-enter-active, .onboarding-backdrop.dialog-fade-leave-active,
    .onboarding-backdrop.dialog-fade-enter-active .el-overlay-dialog, .onboarding-backdrop.dialog-fade-leave-active .el-overlay-dialog {animation: none;}
}
.el-dialog.onboarding-hub {display: flex; flex-direction: column; max-height: 88vh; max-height: 88dvh; margin: 6vh auto;}
.onboarding-hub .el-dialog__body {min-height: 0; overflow: auto; overscroll-behavior: contain;}
</style>
<style scoped>
.welcome-lead, .guide-row p {margin: 0 0 12px; line-height: 1.65; color: var(--cx-letter);}
.welcome-actions, .import-options, .guide-list {display: grid; gap: 10px;}
.welcome-actions .el-button {height: auto; min-height: 42px; margin: 0; white-space: normal;}
.import-options {padding: 12px; border-radius: 10px; background: var(--cx-ground);}
.guide-row {display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px; border: 1px solid var(--cx-step-2); border-radius: 12px;}
.guide-row.quick {padding: 18px; border-color: var(--cx-gold); background: var(--cx-step);}
.guide-row h3 {margin: 0 0 5px; color: var(--cx-letter); font-size: 16px;}
.quick h3 {font-size: 19px;}
.guide-row p {margin-bottom: 4px;}
.guide-row small {color: var(--cx-dim);}
@media (max-width: 480px) {
    .guide-row {align-items: start; flex-direction: column; gap: 8px;}
    .guide-row .el-button {min-height: 40px;}
}
</style>
