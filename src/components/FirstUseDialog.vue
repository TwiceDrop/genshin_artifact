<template>
    <!-- 首次使用引导：只负责判断和跳转，导入逻辑都在各自现有的页面里 -->
    <el-dialog :model-value="visible && !usageNoticeOpen" title="先导入你的数据" :width="deviceIsPC ? '440px' : '92%'" :show-close="false"
        :close-on-click-modal="false" :close-on-press-escape="false" append-to-body>
        <p class="first-use-lead">还没有圣遗物和预设。选一种方式导入，之后也可以在对应页面再导入。</p>
        <div class="first-use-options">
            <el-button v-if="loggedIn" size="large" @click="choose('cloud')">从云端账号导入</el-button>
            <el-button size="large" @click="choose('uid')">通过 UID 导入</el-button>
            <el-button size="large" @click="choose('file')">导入圣遗物文件</el-button>
        </div>
        <template #footer>
            <el-button link @click="choose('skip')">跳过</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import backend from '@/store/backend'
import {accountReady, useAccountStore} from '@/store/pinia/account'
import {cloudApi} from '@/platform/cloud.mjs'
import {isFirstUseDone, markFirstUseDone, needsFirstUse} from '@/platform/first-use.mjs'
import {usageStatsAvailable, usageStatsConsent} from '@/usage-stats/index.mjs'
import {deviceIsPC} from '@/utils/device'

const route = useRoute(), router = useRouter()
const visible = ref(false), loggedIn = ref(false)
let decided = false
// 同一时刻只让一个弹窗在前面：用量统计说明还没回答时先等它
const usageNoticeOpen = computed(() => usageStatsAvailable && usageStatsConsent.value === null)

async function decide() {
    decided = true
    if (isFirstUseDone()) return
    try {
        await accountReady
        await backend.allReady()
        const accountData = []
        for (const {id} of useAccountStore().allAccounts) {
            accountData.push({
                artifacts: await backend.getItem(`mona_account_artifacts_${id}`),
                presets: await backend.getItem(`mona_account_presets_${id}`),
            })
        }
        if (!needsFirstUse({done: false, accountData})) return
    } catch (error) {
        console.error('判断是否首次使用失败', error)
        return
    }
    try { loggedIn.value = !!(await cloudApi('config')).user } catch { loggedIn.value = false }
    visible.value = true
}

// 进入登录页之外的页面（欢迎页）后判断一次
watch(() => route.name, name => {
    if (!decided && name && name !== 'login') decide()
}, {immediate: true})

const targets = {
    cloud: '/account',
    uid: '/uid-data',
    file: {path: '/artifacts', query: {import: '1'}},
}
function choose(option) {
    markFirstUseDone()
    visible.value = false
    if (option !== 'skip') router.push(targets[option])
}
</script>

<style scoped>
.first-use-lead { margin: 0 0 16px; line-height: 1.7; }
.first-use-options { display: flex; flex-direction: column; gap: 10px; }
.first-use-options .el-button { width: 100%; margin-left: 0; }
</style>
