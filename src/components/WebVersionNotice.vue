<template>
    <el-dialog v-model="visible" title="版本迁移通知" :width="deviceIsPC ? '480px' : '92%'" :show-close="false" append-to-body @closed="onClosed">
        <p class="web-version-notice">莫娜占卜铺正逐步迁移至本地程序版。请及时备份网页版中的全部数据，并将备份导入本地程序版。</p>
        <p class="web-version-notice">您可以通过登录莫娜占卜铺同步数据，或在设置页选择「导出数据」进行迁移。</p>
        <p class="web-version-notice">您可以点击下方按钮加入 QQ 群下载本地程序版，也可以前往 CNB 或 GitHub 下载。</p>
        <div class="web-version-links">
            <a class="qq-link" href="./qq-group.html" target="_blank" rel="noopener noreferrer">进入 QQ 群</a>
            <a class="cnb-link" href="https://cnb.cool/twicedrop/genshin_artifact/-/releases" target="_blank" rel="noopener noreferrer">前往 CNB 下载</a>
            <a class="github-link" href="https://github.com/TwiceDrop/genshin_artifact/releases" target="_blank" rel="noopener noreferrer">前往 GitHub 下载</a>
        </div>
        <template #footer>
            <el-button @click="openExportSettings">导出数据</el-button>
            <el-button type="primary" @click="visible = false">继续使用网页版</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {nextTick, ref} from 'vue'
import {useRouter} from 'vue-router'
import {isNative} from '@/platform/native.mjs'
import {shouldShowWebVersionNotice} from '@/platform/web-version.mjs'
import {deviceIsPC} from '@/utils/device'

const visible = ref(shouldShowWebVersionNotice({native: isNative, tauri: window.__MONA_TAURI__ === true}))
const router = useRouter()
let exportRequested = false

function openExportSettings() {
    exportRequested = true
    visible.value = false
}

async function onClosed() {
    if (!exportRequested) return
    exportRequested = false
    await router.push({ name: 'setup', hash: '#export-data' })
    await nextTick()
    document.getElementById('export-data')?.focus()
}
</script>

<style scoped>
.web-version-notice {
    margin: 0;
    line-height: 1.7;
}
.web-version-notice + .web-version-notice {
    margin-top: 12px;
}
.web-version-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
}
.web-version-links a {
    flex: 1 0 auto;
    padding: 10px 12px;
    border-radius: 8px;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
}
.web-version-links a:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
}
.web-version-links a:hover {
    text-decoration: underline;
}
.qq-link { background: #dceeff; color: #164875; }
.cnb-link { background: #dff3e6; color: #20583a; }
.github-link { background: #e9ebef; color: #343b46; }
</style>
