<template>
    <div class="setup-page cx-scope">
        <h2>设置</h2>

        <section class="setup-card">
            <h3 id="setup-appearance">{{ t('setupPage.appearance') }}</h3>
            <div class="mode-options" role="radiogroup" aria-labelledby="setup-appearance">
                <button v-for="mode in modes" :key="mode.value" type="button" role="radio" class="mode-option"
                        :aria-checked="colorMode === mode.value" @click="handleSetColorMode(mode.value)">
                    <span class="mode-preview" :class="mode.value" aria-hidden="true">
                        <span class="pv day"><i></i><span><b></b><b></b><em></em></span></span>
                        <span class="pv night"><i></i><span><b></b><b></b><em></em></span></span>
                    </span>
                    <span class="mode-label">{{ t(mode.label) }}</span>
                </button>
            </div>
        </section>

        <section class="setup-card setup-rows">
            <!-- 在线账号的资料、同步和云端内容都在账户管理与同步页 -->
            <div class="setup-row">
                <span class="setup-row-label">在线账号</span>
                <button type="button" class="setup-plain" @click="router.push('/online-account')">账户管理与同步</button>
            </div>

            <div class="setup-row">
                <label class="setup-row-label" for="setup-locale">{{ t("misc.lang") }}</label>
                <el-select id="setup-locale" class="setup-locale" :model-value="locale" @update:modelValue="handleSetLocale($event)">
                    <el-option label="简体中文" value="zh-cn"></el-option>
                    <el-option label="English" value="en"></el-option>
                </el-select>
            </div>

            <!-- 内容补丁：显示正在生效的补丁号（没有补丁显示「无」），并可关闭自动获取；构建没有配置补丁通道时不显示 -->
            <div v-if="patchChannelAvailable" class="setup-row">
                <span class="setup-row-label setup-patch-label">内容补丁</span>
                <div class="setup-patch">
                    <span class="setup-patch-value">{{ activePatch || '无' }}</span>
                    <span id="setup-patch-auto" class="setup-patch-auto">自动获取内容补丁</span>
                    <el-switch :model-value="automaticPatches" aria-label="自动获取内容补丁" @update:model-value="changeAutomaticPatches"></el-switch>
                </div>
            </div>

            <div v-if="usageStatsAvailable" class="setup-row">
                <div class="setup-row-label">
                    <span>{{ t('usageStats.title') }}</span>
                    <p>{{ t('usageStats.notice') }}</p>
                </div>
                <el-switch :model-value="usageStatsConsent === 'on'" :aria-label="t('usageStats.title')"
                    @update:model-value="setUsageStatsConsent($event ? 'on' : 'off')"></el-switch>
            </div>

            <div class="setup-row">
                <span class="setup-row-label">{{ t("setupPage.storage") }}</span>
                <el-popconfirm @confirm="handleClearLocalStorage" :title="t('setupPage.confirmClear')"
                               :confirm-button-text="t('misc.clear')" :cancel-button-text="t('misc.cancel')" :teleported="false">
                    <template #reference>
                        <button type="button" class="setup-danger"><icon-ep-delete aria-hidden="true" />{{ t("setupPage.clear") }}</button>
                    </template>
                </el-popconfirm>
            </div>
        </section>

        <section class="setup-card migration-actions" aria-label="数据迁移">
            <button id="export-data" type="button" class="setup-plain" :disabled="transferring" @click="exportAccounts">导出数据</button>
            <button type="button" class="setup-plain" :disabled="transferring" @click="backupFile?.click()">导入数据</button>
            <input ref="backupFile" type="file" accept=".json,application/json" hidden @change="previewFile">
        </section>
        <el-dialog v-model="previewOpen" title="导入数据" width="min(480px, 92vw)" append-to-body
                   :close-on-click-modal="!transferring" :close-on-press-escape="!transferring" :show-close="!transferring" @closed="pendingBackup = null">
            <ul class="backup-preview">
                <li v-for="account in previewAccounts" :key="account.id">
                    <strong>{{ account.name }}</strong>
                    <div>{{ account.uids }} 个 UID · {{ account.artifacts }} 件圣遗物 · {{ account.axes }} 条四人轴 · {{ account.history }} 条计算记录</div>
                </li>
            </ul>
            <el-checkbox v-if="pendingBackup?.preferences" v-model="usePreferences">同时导入语言和外观设置</el-checkbox>
            <template #footer>
                <el-button :disabled="transferring" @click="previewOpen = false">取消</el-button>
                <el-button type="primary" :loading="transferring" @click="importAccounts">导入为新账号</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import localforage from "localforage"
import { computed, nextTick, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import backend from '@/store/backend'
import { accountReady, useAccountStore, reload } from '@/store/pinia/account'
import { calculationState, calculationHistory } from '@/store/calculation-history'
import { flushTeamDpsWrites } from '../../../beta-data/team-dps-library.mjs'
import { backupCounts, validateBackup } from '@/store/account-backup.mjs'
import { downloadString } from '@/utils/common'
import {colorMode,setColorMode} from "@/styles/color-mode.mjs"
import {useI18n} from "@/i18n/i18n"
import {usageStatsAvailable, usageStatsConsent, setUsageStatsConsent, refreshUsageStatsConsent, recordUsage} from "@/usage-stats/index.mjs"
import IconEpDelete from "~icons/ep/delete"
import {useRouter} from "vue-router"
import {patchChannelAvailable, isAutomaticPatchEnabled, setAutomaticPatchEnabled} from "@/platform/patch-update.mjs"
import {activePatch} from "@/platform/patch-info.mjs"


// 外观选项：值与 color-mode.mjs 一致，文字沿用 setupPage 的 i18n
const modes = [
    { value: "light", label: "setupPage.light" },
    { value: "dark", label: "setupPage.dark" },
    { value: "auto", label: "setupPage.system" },
]

const { t, setLocale, locale } = useI18n()
const router = useRouter()

const transferring = ref(false), previewOpen = ref(false), usePreferences = ref(false)
const backupFile = ref<HTMLInputElement | null>(null), pendingBackup = shallowRef<any>(null)
const previewAccounts = computed(() => (pendingBackup.value?.accounts || []).map((account: any) =>
    ({ id: account.id, name: account.name, ...backupCounts(account) })))

async function settlePlayerData() {
    await accountReady
    await nextTick()
    if (calculationState.active) throw new Error('请先等待当前计算结束')
    for (const { id } of useAccountStore().allAccounts) {
        await flushTeamDpsWrites(id)
        await calculationHistory.flush(id)
    }
    await backend.allReady()
    if (calculationState.active) throw new Error('请先等待当前计算结束')
}

async function exportAccounts() {
    transferring.value = true
    try {
        await settlePlayerData()
        const pack = await backend.exportBackup(process.env.MONA_VERSION, { locale: locale.value, colorMode: colorMode.value })
        await downloadString(JSON.stringify(pack), 'application/json', 'mona-backup-' + pack.exportedAt.slice(0, 10) + '.json')
    } catch (error) { ElMessage.error('导出失败：' + String(error)) }
    finally { transferring.value = false }
}

async function previewFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    transferring.value = true
    try {
        pendingBackup.value = validateBackup(JSON.parse(await file.text()))
        usePreferences.value = false
        previewOpen.value = true
    } catch (error) { ElMessage.error('无法读取备份：' + String(error)) }
    finally { transferring.value = false }
}

async function importAccounts() {
    transferring.value = true
    try {
        const pack = pendingBackup.value
        await settlePlayerData()
        try { await backend.importBackup(pack) }
        finally { await reload() }
        if (usePreferences.value) {
            const prefs = pack.preferences
            if (['zh-cn', 'en'].includes(prefs.locale)) await setLocale(prefs.locale)
            if (['light', 'dark', 'auto'].includes(prefs.colorMode)) setColorMode(prefs.colorMode)
        }
        previewOpen.value = false
        ElMessage.success('已导入 ' + pack.accounts.length + ' 个新账号')
    } catch (error) { ElMessage.error(String(error)) }
    finally { transferring.value = false }
}

const automaticPatches = ref(isAutomaticPatchEnabled())
function changeAutomaticPatches(enabled: boolean) {
    if (setAutomaticPatchEnabled(enabled)) automaticPatches.value = enabled
}

function handleSetColorMode(mode: string) {
    setColorMode(mode)
    recordUsage('action.color-mode-change')
}

function handleClearLocalStorage() {
    localStorage.clear()
    localforage.clear()
    refreshUsageStatsConsent()
}

async function handleSetLocale(lang: string) {
    const loading = ElLoading.service({
        fullscreen: true,
        lock: true,
        text: t("setupPage.loading"),
    })

    await nextTick()

    await setLocale(lang).finally(() => {
        loading.close()
    })
    recordUsage('action.locale-change')
}
</script>

<style scoped lang="scss">
// 设置页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-*
.setup-page {
    box-sizing: border-box;
    min-height: calc(100vh - 48px);
    padding: 16px clamp(10px, 1.3vw, 18px) 18px;
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);

    h2 {
        margin: 0 0 14px;
        font-size: 20px;
        font-weight: 700;
    }
}

.setup-card {
    max-width: 760px;
    margin-bottom: 12px;
    padding: 16px 18px;
    border-radius: 16px;
    background: var(--cx-card);

    h3 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 700;
    }
}

.migration-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.backup-preview { margin: 0; padding-left: 1.5em; max-height: 48vh; overflow: auto; }
.backup-preview li { margin-bottom: 10px; overflow-wrap: anywhere; }

// 外观：三张带缩略图的选项卡
.mode-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.mode-option {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 8px 10px;
    border: 0;
    border-radius: 14px;
    background: var(--cx-step);
    color: var(--cx-dim);
    font: inherit;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
        color: var(--cx-letter);
    }

    &[aria-checked=true] {
        box-shadow: 0 0 0 2px var(--cx-gold);
        color: var(--cx-letter);
        font-weight: 700;
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 3px;
    }
}

.mode-label {
    text-align: center;
    font-size: 14px;
}

// 缩略图：侧栏 + 两条内容卡 + 金色小圆点。颜色固定为两种模式的样子，不随当前模式变化，
// 所以写成带默认值的 var()（构建时的配色插件不改写 var() 值）。
.mode-preview {
    position: relative;
    display: block;
    height: 76px;
    border-radius: 10px;
    overflow: hidden;
}

.pv {
    position: absolute;
    inset: 0;
    display: flex;
    gap: 8px;

    i {
        width: 20%;
    }

    > span {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 9px 9px 9px 0;
    }

    b {
        height: 16px;
        border-radius: 4px;
    }

    b + b {
        width: 70%;
    }

    em {
        width: 32%;
        height: 8px;
        margin-top: auto;
        border-radius: 999px;
    }

    &.day {
        background: var(--setup-day-ground, #eef0f6);

        i { background: var(--setup-day-side, #e4e0f2); }
        b { background: var(--setup-day-card, #ffffff); }
        em { background: var(--setup-day-gold, #8a6420); }
    }

    &.night {
        background: var(--setup-night-ground, #0f1428);

        i { background: var(--setup-night-side, #0a0e20); }
        b { background: var(--setup-night-card, #1b2343); }
        em { background: var(--setup-night-gold, #e2c078); }
    }
}

.mode-preview.light .night,
.mode-preview.dark .day {
    display: none;
}

// 跟随系统：左上浅色、右下深色
.mode-preview.auto .night {
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

// 其余设置：左边名称（可带说明），右边控件
// 普通胶囊按钮（保存、退出登录、登录在线账号）
.setup-plain {
    flex: none;
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font: inherit;
    font-size: 13px;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: var(--cx-step-2);
    }

    &:disabled {
        opacity: .5;
        cursor: default;
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.setup-rows {
    padding: 4px 18px;
}

.setup-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 56px;
    padding: 10px 0;

    & + & {
        box-shadow: 0 -1px 0 var(--cx-step-2);
    }
}

.setup-row-label {
    min-width: 0;
    font-size: 15px;
    font-weight: 600;

    p {
        max-width: 44rem;
        margin: 4px 0 0;
        color: var(--cx-dim);
        font-size: 12px;
        font-weight: 400;
        line-height: 1.6;
    }
}

.setup-locale {
    width: 180px;
}

// 内容补丁一行：补丁号、开关名和开关排成一组，窄屏上换行
// 标签不换行，补丁号、开关名和开关在剩下的位置里换行
.setup-patch-label {
    flex: none;
    white-space: nowrap;
}

.setup-patch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px 12px;
    min-width: 0;
}

.setup-patch-value {
    font-variant-numeric: tabular-nums;
    color: var(--cx-dim);
    font-size: 14px;
}

.setup-patch-auto {
    font-size: 13px;
}

.setup-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    height: 36px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-step);
    color: var(--cx-up);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

@media (max-width: 520px) {
    .mode-options {
        gap: 8px;
    }

    .mode-preview {
        height: 60px;
    }

    .setup-locale {
        width: 140px;
    }
}
</style>
