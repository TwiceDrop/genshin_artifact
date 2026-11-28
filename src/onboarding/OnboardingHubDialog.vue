<template>
    <UiDialog :model-value="welcomeVisible || controller.hubOpen" :title="welcomeVisible ? '欢迎使用莫娜占卜铺' : '使用引导'"
              width="var(--app-dialog-width, min(680px, 94vw))" top="var(--app-dialog-top)"
              content-class="app-dialog onboarding-hub" focus-container :hide-close="welcomeVisible" :prevent-outside="welcomeVisible"
              @escape-key-down="welcomeVisible && $event.preventDefault()" @update:model-value="!$event && closeHub()">
        <template v-if="welcomeVisible">
            <p class="welcome-lead">还没有圣遗物和预设。可以先 3 步快速了解核心用法，或直接导入已有数据。</p>
            <div class="welcome-actions">
                <UiButton variant="primary" @click="beginQuickGuide">快速了解（3 步）</UiButton>
                <UiButton :aria-expanded="importsOpen" @click="importsOpen = !importsOpen">先导入我的数据</UiButton>
                <div v-if="importsOpen" class="import-options">
                    <UiButton v-if="loggedIn" @click="chooseImport('/online-account')">从云端账号导入</UiButton>
                    <UiButton @click="chooseImport('/uid-data')">通过 UID 导入</UiButton>
                    <UiButton @click="chooseImport('/artifacts?import=1')">导入圣遗物文件</UiButton>
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
                <UiButton :variant="guide.kind === 'quick' ? 'primary' : 'outline'" @click="startGuide(guide.id, router)">
                    {{ completed(guide.id) ? '再看一遍' : '开始' }}
                </UiButton>
            </article>
        </div>
        <template #footer>
            <UiButton v-if="welcomeVisible" class="skip-welcome" @click="skipWelcome">先自己逛逛</UiButton>
            <UiButton v-else :disabled="!controller.completedIds.length" @click="resetProgress">重置引导进度</UiButton>
        </template>
    </UiDialog>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import backend from '@/store/backend'
import {showCalculationNotice} from '@/store/calculation-history'
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
    showCalculationNotice('info', '随时可以从侧栏「使用引导」或设置页重新打开。')
}
</script>

<style>
.ui-dialog.onboarding-hub {--app-dialog-desktop-top: 6vh;}
@media (min-width: 768px) {
    .ui-dialog.app-dialog.onboarding-hub {max-height: 88vh; max-height: 88dvh;}
}
</style>
<style scoped>
.welcome-lead, .guide-row p {margin: 0 0 12px; line-height: 1.65; color: var(--cx-letter);}
.welcome-actions, .import-options, .guide-list {display: grid; gap: 10px;}
.welcome-actions [data-slot="button"] {height: auto; min-height: 42px; margin: 0; white-space: normal;}
.skip-welcome[data-slot="button"] {padding: 2px; border-color: transparent; background: transparent; color: var(--cx-dim);}
.skip-welcome[data-slot="button"]:hover {background: transparent; color: var(--cx-letter);}
.import-options {padding: 12px; border-radius: 10px; background: var(--cx-ground);}
.guide-row {display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px; border: 1px solid var(--cx-step-2); border-radius: 12px;}
.guide-row.quick {padding: 18px; border-color: var(--cx-gold); background: var(--cx-step);}
.guide-row h3 {margin: 0 0 5px; color: var(--cx-letter); font-size: 16px;}
.quick h3 {font-size: 19px;}
.guide-row p {margin-bottom: 4px;}
.guide-row small {color: var(--cx-dim);}
.guide-row [data-slot="button"] {min-height: 32px;}
@media (max-width: 767px) {
    .guide-row [data-slot="button"] {min-height: 40px;}
}
@media (max-width: 480px) {
    .guide-row {align-items: start; flex-direction: column; gap: 8px;}
}
</style>
