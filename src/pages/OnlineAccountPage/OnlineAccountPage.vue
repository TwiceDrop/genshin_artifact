<template>
    <main class="online-account-page">
        <h2>在线账号</h2>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <section class="online-section">
            <h3>在线服务</h3>
            <div class="online-row">
                <el-input v-model="serviceUrl" label="服务地址" placeholder="https://" :disabled="busy" @keyup.enter="saveConfig" />
                <el-button :disabled="busy || !serviceUrl.trim()" @click="saveConfig">保存服务地址</el-button>
            </div>
        </section>

        <section v-if="!user" class="online-section">
            <h3>邮箱注册／登录</h3>
            <label class="online-field">邮箱
                <el-input v-model="email" type="email" autocomplete="email" label="邮箱" :disabled="busy" />
            </label>
            <div class="online-row">
                <el-input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" label="邮箱验证码" placeholder="验证码" :disabled="busy" @keyup.enter="verifyCode" />
                <el-button :disabled="busy || !configuredUrl || !email.trim() || cooldown > 0" @click="requestCode">{{ cooldown ? `${cooldown} 秒后重发` : '发送验证码' }}</el-button>
            </div>
            <label class="online-field">设备名称
                <el-input v-model="deviceName" maxlength="80" label="设备名称" :disabled="busy" />
            </label>
            <el-button type="primary" :loading="busy" :disabled="!challengeId || code.length !== 6" @click="verifyCode">注册／登录</el-button>
        </section>

        <template v-else>
            <section class="online-section">
                <div class="online-heading"><h3>{{ user.email }}</h3><el-button :disabled="busy" @click="logout">退出登录</el-button></div>
            </section>

            <section class="online-section">
                <div class="online-heading"><h3>Cookie 托管</h3><el-button :disabled="busy" @click="refreshAll">刷新</el-button></div>
                <div class="online-row">
                    <el-select v-model="localAccountId" aria-label="本机游戏账号" placeholder="选择本机已保存账号" :disabled="busy" style="width:100%">
                        <el-option v-for="account in localAccounts" :key="account.id" :value="account.id" :label="accountLabel(account)" />
                    </el-select>
                    <el-button type="primary" :disabled="busy || !localAccountId" @click="uploadLocal">上传所选 Cookie</el-button>
                </div>
                <el-button class="online-manual-toggle" :disabled="busy" @click="manualOpen = !manualOpen">手动输入 Cookie</el-button>
                <div v-if="manualOpen" class="online-manual">
                    <el-select v-model="platform" aria-label="Cookie 平台" :disabled="busy"><el-option value="miyoushe" label="米游社" /><el-option value="hoyolab" label="HoYoLAB" /></el-select>
                    <el-input v-model="cookie" type="password" autocomplete="off" label="Cookie" placeholder="Cookie" :disabled="busy" />
                    <el-button :disabled="busy || !cookie.trim()" @click="uploadCookie">上传 Cookie</el-button>
                </div>
                <el-empty v-if="!cloudAccounts.length" description="暂无托管账号" />
                <article v-for="account in cloudAccounts" :key="account.id" class="online-game-account">
                    <div class="online-heading"><strong>{{ accountLabel(account) }}</strong><el-tag>{{ statusName(account.status) }}</el-tag></div>
                    <div class="online-roles"><span v-for="role in account.roles" :key="role.uid">{{ role.nickname }} · {{ role.uid }} · {{ role.regionName || role.region }}</span></div>
                    <dl class="online-values">
                        <div><dt>上次同步</dt><dd>{{ dateText(account.lastSyncedAt) }}</dd></div>
                        <div><dt>下次同步</dt><dd>{{ dateText(account.nextRunAt) }}</dd></div>
                        <div><dt>同步间隔</dt><dd>{{ account.intervalMinutes }} 分钟</dd></div>
                    </dl>
                    <div v-if="account.lastError" class="online-error" role="alert">{{ account.lastError }}</div>
                    <div v-if="jobs[account.id]" class="online-job" role="status">{{ jobName(jobs[account.id].status) }}<span v-if="jobs[account.id].error"> · {{ jobs[account.id].error }}</span></div>
                    <div class="online-actions">
                        <el-switch :model-value="account.syncEnabled" active-text="自动同步" :disabled="busy" @change="value => toggleSync(account, value)" />
                        <el-button :disabled="busy || !!account.activeJobId" @click="syncNow(account)">立即同步</el-button>
                        <el-button :disabled="busy" @click="showSnapshots(account)">查看最新快照</el-button>
                        <el-popconfirm title="删除云端 Cookie 和快照？" confirm-button-text="删除" cancel-button-text="取消" @confirm="deleteAccount(account)">
                            <template #reference><el-button type="danger" plain :disabled="busy">删除托管</el-button></template>
                        </el-popconfirm>
                    </div>
                    <div v-if="snapshots[account.id]" class="online-snapshots">
                        <el-empty v-if="!snapshots[account.id].length" description="暂无快照" />
                        <div v-for="item in snapshots[account.id]" :key="`${item.uid}:${item.region}`" class="online-snapshot">
                            <div><strong>{{ item.snapshot.role.nickname || item.uid }}</strong><div>{{ item.uid }} · {{ item.snapshot.characters.length }} 名角色 · {{ dateText(item.updatedAt) }}</div></div>
                            <el-button type="primary" :disabled="busy" @click="importSnapshot(item)">导入 {{ localProfile.currentAccountName.value }}</el-button>
                        </div>
                    </div>
                </article>
                <div v-if="importResult" class="online-import-result" role="status">已导入 {{ importResult.imported }} 名角色 · 新增 {{ importResult.added }} 件圣遗物<span v-if="importResult.rejected"> · {{ importResult.rejected }} 名角色未导入</span></div>
                <div v-for="(warning, index) in importResult?.warnings || []" :key="index" class="online-error">{{ warning }}</div>
            </section>
            <section class="online-section">
                <h3>登录设备</h3>
                <div v-for="session in sessions" :key="session.id" class="online-session">
                    <div><strong>{{ session.deviceName || '未命名设备' }}{{ session.current ? ' · 当前设备' : '' }}</strong><div>最近使用 {{ dateText(session.lastUsedAt) }}</div></div>
                    <el-button :disabled="busy" @click="revokeSession(session)">退出此设备</el-button>
                </div>
            </section>
        </template>
    </main>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { cloudApi } from '@/platform/cloud.mjs'

import { isNative } from '@/platform/native.mjs'
import { useAccountStore } from '@/store/pinia/account'
import { saveGameSnapshot } from '@/import/save-game-snapshot.mjs'

const localProfile = useAccountStore()
const serviceUrl = ref(''), configuredUrl = ref(''), user = ref(null), error = ref(''), busy = ref(false)
const email = ref(''), code = ref(''), deviceName = ref(isNative ? 'Android' : 'Windows'), challengeId = ref('')
const resendAt = ref(0), now = ref(Date.now()), cooldown = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)))
const localAccounts = ref([]), localAccountId = ref(''), cloudAccounts = ref([]), sessions = ref([]), snapshots = ref({}), jobs = ref({})
const manualOpen = ref(false), cookie = ref(''), platform = ref('miyoushe'), importResult = ref(null)
let disposed = false, pollTimer, tickTimer, polling = false, generation = 0, nextAccountRefresh = 0
const platformName = value => value === 'hoyolab' ? 'HoYoLAB' : '米游社'
const accountLabel = account => `${platformName(account.platform)} · ${account.accountUid}${account.roles[0]?.nickname ? ` · ${account.roles[0].nickname}` : ''}`
const dateText = value => value ? new Date(value).toLocaleString() : '—'
const statusName = value => ({ ready: '已托管', syncing: '同步中', expired: 'Cookie 已失效', verification_required: '需要验证', error: '同步失败' }[value] || value)
const jobName = value => ({ queued: '等待同步', running: '同步中', succeeded: '同步完成', failed: '同步失败', cancelled: '同步已取消' }[value] || value)
watch(email, () => { challengeId.value = ''; code.value = '' })
function clearAccount() { generation++; user.value = null; cloudAccounts.value = []; sessions.value = []; snapshots.value = {}; jobs.value = {}; cookie.value = ''; importResult.value = null }
function showError(e) { error.value = e.message; if (e.status === 401) clearAccount() }
async function run(action) {
    if (busy.value) return
    busy.value = true; error.value = ''
    try { await action() } catch (e) { if (!disposed) showError(e) }
    finally { busy.value = false }
}
async function loadAccounts() {
    const run = generation
    const data = await cloudApi('v1/game-accounts')
    if (!disposed && run === generation) cloudAccounts.value = data.accounts
}
async function loadAll() {
    const run = generation
    await loadAccounts()
    const devices = await cloudApi('v1/sessions'), local = await cloudApi('local-accounts')
    if (disposed || run !== generation) return
    sessions.value = devices.sessions; localAccounts.value = local.accounts
    if (!local.accounts.some(account => account.id === localAccountId.value)) localAccountId.value = local.accounts[0]?.id || ''
}
function refreshAll() { return run(loadAll) }
function saveConfig() { return run(async () => {
    const config = await cloudApi('config', 'PUT', { url: serviceUrl.value.trim() })
    clearAccount(); configuredUrl.value = serviceUrl.value = config.url; challengeId.value = ''; code.value = ''; resendAt.value = 0
    if (config.user) { user.value = (await cloudApi('v1/me')).user; await loadAll() }
}) }
function requestCode() { return run(async () => {
    const result = await cloudApi('v1/auth/email/request', 'POST', { email: email.value.trim() })
    challengeId.value = result.challengeId; now.value = Date.now(); resendAt.value = now.value + result.resendAfterSeconds * 1000
}) }
function verifyCode() {
    if (!challengeId.value || code.value.length !== 6) return
    return run(async () => {
        const result = await cloudApi('v1/auth/email/verify', 'POST', { challengeId: challengeId.value, code: code.value, deviceName: deviceName.value.trim() })
        generation++; user.value = result.user; code.value = ''; challengeId.value = ''; await loadAll()
    })
}
function logout() { return run(async () => { await cloudApi('v1/auth/logout', 'POST'); clearAccount() }) }
function revokeSession(session) { return run(async () => {
    await cloudApi(`v1/sessions/${session.id}`, 'DELETE')
    if (session.current) clearAccount(); else sessions.value = (await cloudApi('v1/sessions')).sessions
}) }
function uploadLocal() { return run(async () => { await cloudApi('game-accounts/import-local', 'POST', { id: localAccountId.value }); await loadAccounts() }) }
function uploadCookie() { return run(async () => {
    const value = cookie.value; cookie.value = ''
    await cloudApi('v1/game-accounts', 'POST', { platform: platform.value, cookie: value }); manualOpen.value = false; await loadAccounts()
}) }
function toggleSync(account, syncEnabled) { return run(async () => { await cloudApi(`v1/game-accounts/${account.id}`, 'PATCH', { syncEnabled }); await loadAccounts() }) }
function syncNow(account) { return run(async () => {
    const result = await cloudApi(`v1/game-accounts/${account.id}/sync`, 'POST')
    jobs.value[account.id] = { id: result.jobId, status: result.status }; await loadAccounts()
}) }
function showSnapshots(account) { return run(async () => { snapshots.value[account.id] = (await cloudApi(`v1/game-accounts/${account.id}/snapshots`)).snapshots }) }
function deleteAccount(account) { return run(async () => {
    await cloudApi(`v1/game-accounts/${account.id}`, 'DELETE'); delete snapshots.value[account.id]; delete jobs.value[account.id]; await loadAccounts()
}) }
function importSnapshot(item) { return run(async () => {
    const accountId = localProfile.currentAccountId.value
    importResult.value = await saveGameSnapshot(item.snapshot, accountId, `云端 ${platformName(item.snapshot.source)} 同步`, () => {
        if (disposed) throw new Error('页面已关闭，数据未写入')
    })
}) }
async function pollJobs() {
    if (disposed) return
    const run = generation
    if (!busy.value && user.value && !polling) {
        polling = true
        try {
            if (Date.now() >= nextAccountRefresh) {
                const previous = new Map(cloudAccounts.value.map(account => [account.id, account.lastSyncedAt]))
                await loadAccounts(); nextAccountRefresh = Date.now() + 15000
                if (disposed || run !== generation) return
                for (const account of cloudAccounts.value) {
                    if (snapshots.value[account.id] && previous.get(account.id) !== account.lastSyncedAt) {
                        const data = await cloudApi(`v1/game-accounts/${account.id}/snapshots`)
                        if (disposed || run !== generation) return
                        snapshots.value[account.id] = data.snapshots
                    }
                }
            }
            const active = cloudAccounts.value.map(account => ({ account, jobId: account.activeJobId || (['queued', 'running'].includes(jobs.value[account.id]?.status) ? jobs.value[account.id].id : null) })).filter(item => item.jobId)
            for (const { account, jobId } of active) {
                const { job } = await cloudApi(`v1/jobs/${jobId}`)
                if (disposed || run !== generation) return
                jobs.value[account.id] = job
                if (!['queued', 'running'].includes(job.status)) {
                    await loadAccounts()
                    if (disposed || run !== generation) return
                    if (snapshots.value[account.id]) {
                        const data = await cloudApi(`v1/game-accounts/${account.id}/snapshots`)
                        if (disposed || run !== generation) return
                        snapshots.value[account.id] = data.snapshots
                    }
                }
            }
        } catch (e) { if (!disposed && run === generation) showError(e) }
        finally { polling = false; if (!disposed) pollTimer = setTimeout(pollJobs, 2500) }
    } else if (!disposed) pollTimer = setTimeout(pollJobs, 2500)
}
onMounted(async () => {
    tickTimer = setInterval(() => { now.value = Date.now() }, 1000)
    await run(async () => {
        const config = await cloudApi('config'); configuredUrl.value = serviceUrl.value = config.url
        if (config.user) { user.value = (await cloudApi('v1/me')).user; await loadAll() }
    })
    pollJobs()
})
onBeforeUnmount(() => { disposed = true; generation++; clearTimeout(pollTimer); clearInterval(tickTimer); cookie.value = ''; code.value = '' })
</script>

<style scoped>
.online-account-page{max-width:1040px;margin:0 auto;padding-bottom:24px}.online-account-page h2{font-size:23px;margin:8px 0 20px}.online-account-page h3{font-size:17px;margin:0 0 16px}.online-section{padding:22px 0;border-bottom:1px solid var(--el-border-color-light,#e4e7ed)}.online-section:first-of-type{padding-top:20px}.online-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.online-heading h3{margin:0;overflow-wrap:anywhere}.online-row{display:flex;gap:12px;align-items:center;max-width:720px}.online-row>:first-child{flex:1;min-width:0}.online-field{display:flex;flex-direction:column;gap:8px;max-width:720px;margin:0 0 16px}.online-row+.online-field{margin-top:16px}.online-manual-toggle{margin-top:14px}.online-manual{display:grid;grid-template-columns:130px 1fr auto;gap:12px;margin-top:14px}.online-game-account{padding:22px 0;border-top:1px solid var(--el-border-color-light,#e4e7ed);margin-top:20px}.online-game-account .online-heading{margin-bottom:10px}.online-roles{display:flex;gap:8px 20px;flex-wrap:wrap;font-size:14px}.online-values{display:flex;gap:14px 30px;flex-wrap:wrap;margin:16px 0}.online-values>div{display:flex;gap:10px;font-size:14px}.online-values dt{color:var(--el-text-color-secondary,#909399)}.online-values dd{margin:0}.online-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.online-actions .el-button,.online-manual .el-button,.online-session .el-button{margin-left:0}.online-actions .el-switch{margin-right:12px}.online-error{color:var(--el-color-danger,#f56c6c);overflow-wrap:anywhere;margin:10px 0}.online-job{margin:10px 0}.online-snapshots{margin-top:18px}.online-snapshot,.online-session{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid var(--el-border-color-lighter,#ebeef5)}.online-snapshot>div,.online-session>div{min-width:0;overflow-wrap:anywhere;line-height:1.8}.online-import-result{margin-top:18px}.online-account-page :deep(.el-alert){margin-bottom:8px}
@media(max-width:640px){.online-row{flex-direction:column;align-items:stretch}.online-row>*{width:100%}.online-manual{grid-template-columns:1fr}.online-snapshot{align-items:stretch;flex-direction:column}.online-actions{display:grid;grid-template-columns:1fr 1fr}.online-actions .el-switch{grid-column:1/-1}.online-actions .el-button{width:100%}.online-values{flex-direction:column;gap:8px}.online-session{align-items:flex-start}.online-heading strong{overflow-wrap:anywhere}.online-field+.el-button{width:100%}}
</style>
