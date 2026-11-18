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

            <!-- 本区块的文案均为占位，待开发者确认（docs/specs/online-accounts/issues/08-cookie-client-encryption.md 的 Comments） -->
            <section class="online-section">
                <div class="online-heading"><h3>云端 Cookie</h3><el-button :disabled="busy" @click="refreshAll">刷新</el-button></div>
                <div v-if="!cookieSyncEnabled" class="online-note" role="status">Cookie 同步已关闭，不会上传 Cookie</div>
                <div v-if="!cookieKey && !vaults.length" class="online-passphrase">
                    <el-input v-model="passphrase" type="password" autocomplete="new-password" label="解密密码" placeholder="设置解密密码" :disabled="busy" />
                    <el-input v-model="passphraseConfirm" type="password" autocomplete="new-password" label="确认解密密码" placeholder="再次输入解密密码" :disabled="busy" />
                    <el-button type="primary" :disabled="busy || !passphrase || passphrase !== passphraseConfirm" @click="setPassphrase">设置解密密码</el-button>
                </div>
                <div v-else-if="!cookieKey" class="online-passphrase">
                    <el-input v-model="passphrase" type="password" autocomplete="current-password" label="解密密码" placeholder="输入解密密码" :disabled="busy" @keyup.enter="unlock" />
                    <el-button type="primary" :disabled="busy || !passphrase" @click="unlock">解锁</el-button>
                    <el-popconfirm title="删除云端全部 Cookie，之后重新上传并设置新的解密密码？" confirm-button-text="删除" cancel-button-text="取消" @confirm="forgetPassphrase">
                        <template #reference><el-button :disabled="busy">忘记解密密码</el-button></template>
                    </el-popconfirm>
                </div>
                <template v-else>
                    <div class="online-row">
                        <el-select v-model="localAccountId" aria-label="本机游戏账号" placeholder="选择本机已保存账号" :disabled="busy" style="width:100%">
                            <el-option v-for="account in localAccounts" :key="account.id" :value="account.id" :label="accountLabel(account)" />
                        </el-select>
                        <el-button type="primary" :disabled="busy || !localAccountId || !cookieSyncEnabled" @click="uploadLocal">加密上传所选 Cookie</el-button>
                    </div>
                    <div class="online-actions online-manual-toggle">
                        <el-button :disabled="busy" @click="manualOpen = !manualOpen">手动输入 Cookie</el-button>
                        <el-button :disabled="busy" @click="changeOpen = !changeOpen">修改解密密码</el-button>
                    </div>
                    <div v-if="manualOpen" class="online-manual">
                        <el-select v-model="platform" aria-label="Cookie 平台" :disabled="busy"><el-option value="miyoushe" label="米游社" /><el-option value="hoyolab" label="HoYoLAB" /></el-select>
                        <el-input v-model="cookie" type="password" autocomplete="off" label="Cookie" placeholder="Cookie" :disabled="busy" />
                        <el-button :disabled="busy || !cookie.trim() || !cookieSyncEnabled" @click="uploadCookie">加密上传 Cookie</el-button>
                    </div>
                    <div v-if="changeOpen" class="online-passphrase">
                        <el-input v-model="passphrase" type="password" autocomplete="new-password" label="新解密密码" placeholder="新解密密码" :disabled="busy" />
                        <el-input v-model="passphraseConfirm" type="password" autocomplete="new-password" label="确认新解密密码" placeholder="再次输入新解密密码" :disabled="busy" />
                        <el-button type="primary" :disabled="busy || !passphrase || passphrase !== passphraseConfirm" @click="changePassphrase">确认修改</el-button>
                    </div>
                </template>
                <el-empty v-if="!vaults.length" description="云端暂无 Cookie" />
                <div v-for="vault in vaults" :key="vaultKey(vault)" class="online-session">
                    <div><strong>{{ platformName(vault.platform) }} · {{ vault.accountUid }}</strong><div>上传于 {{ dateText(vault.updatedAt) }}</div></div>
                    <div class="online-actions">
                        <el-button type="primary" :disabled="busy || !cookieKey" @click="importVault(vault)">导入本机</el-button>
                        <el-popconfirm title="删除这条云端 Cookie？" confirm-button-text="删除" cancel-button-text="取消" @confirm="deleteVault(vault)">
                            <template #reference><el-button type="danger" plain :disabled="busy">删除</el-button></template>
                        </el-popconfirm>
                    </div>
                </div>
                <div v-if="notice" class="online-import-result" role="status">{{ notice }}</div>
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
import { mysApi } from '@/platform/mys-api.mjs'
import { profileSync } from '@/cloud/profile-sync'
import { deriveCookieKey, encryptCookie, decryptCookie, checkNewPassphrase } from '@/cloud/cookie-crypto.mjs'
import { communityAccount } from '../../../server/cookie.mjs'

const serviceUrl = ref(''), configuredUrl = ref(''), user = ref(null), error = ref(''), busy = ref(false)
const email = ref(''), code = ref(''), deviceName = ref(isNative ? 'Android' : 'Windows'), challengeId = ref('')
const resendAt = ref(0), now = ref(Date.now()), cooldown = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)))
const localAccounts = ref([]), localAccountId = ref(''), vaults = ref([]), sessions = ref([]), cookieKey = ref(null), cookieSyncEnabled = ref(true)
const manualOpen = ref(false), changeOpen = ref(false), cookie = ref(''), platform = ref('miyoushe'), passphrase = ref(''), passphraseConfirm = ref(''), notice = ref('')
let disposed = false, tickTimer, generation = 0
const platformName = value => value === 'hoyolab' ? 'HoYoLAB' : '米游社'
const accountLabel = account => `${platformName(account.platform)} · ${account.accountUid}${account.roles?.[0]?.nickname ? ` · ${account.roles[0].nickname}` : ''}`
const vaultKey = vault => `${vault.platform}/${vault.accountUid}`
const vaultPath = vault => `v1/cookie-vaults/${vault.platform}/${vault.accountUid}`
const dateText = value => value ? new Date(value).toLocaleString() : '—'
watch(email, () => { challengeId.value = ''; code.value = '' })
function clearSecrets() { cookie.value = ''; passphrase.value = ''; passphraseConfirm.value = '' }
function clearAccount() { generation++; user.value = null; vaults.value = []; sessions.value = []; cookieKey.value = null; notice.value = ''; changeOpen.value = false; clearSecrets() }
function showError(e) { error.value = e.message; if (e.status === 401) clearAccount() }
async function run(action) {
    if (busy.value) return
    busy.value = true; error.value = ''; notice.value = ''
    try { await action() } catch (e) { if (!disposed) showError(e) }
    finally { busy.value = false }
}
async function loadVaults() {
    const run = generation
    const list = await cloudApi('v1/cookie-vaults'), key = await cloudApi('cookie-key')
    if (!disposed && run === generation) { vaults.value = list.vaults; cookieKey.value = key.cookieKey }
}
async function loadAll() {
    const run = generation
    await loadVaults()
    const devices = await cloudApi('v1/sessions'), local = await cloudApi('local-accounts')
    if (disposed || run !== generation) return
    sessions.value = devices.sessions; localAccounts.value = local.accounts; cookieSyncEnabled.value = profileSync.getSyncSettings().cookie
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

// 云端 Cookie（任务 08）：解密密码只在派生密钥时用到，用完即清空；本机只存派生出的密钥（网关的 cookie-key）。
// 加解密都在页面里做，网关和服务端只经手密文。
async function storeKey(derived) { await cloudApi('cookie-key', 'PUT', derived); cookieKey.value = derived; clearSecrets() }
async function readVault(vault) { return (await cloudApi(vaultPath(vault))).vault }
// 解密密码已在其他设备修改时，本机旧密钥作废，回到输入解密密码；云端和本机的 Cookie 都不动。
async function open(sealed) {
    try { return await decryptCookie(cookieKey.value, sealed) } catch (e) {
        if (e.code === 'COOKIE_KEY_STALE') { await cloudApi('cookie-key', 'DELETE'); cookieKey.value = null }
        throw e
    }
}
// 上传前确认本机密钥仍是云端在用的那一把，避免云端混入用两个解密密码加密的密文。
async function assertKeyCurrent() {
    if (!vaults.value.length) return
    const sealed = await readVault(vaults.value[0])
    if (sealed.salt !== cookieKey.value.salt || sealed.kdf.iterations !== cookieKey.value.kdf.iterations) await open(sealed)
}
async function upload(account) {
    if (!profileSync.getSyncSettings().cookie) { cookieSyncEnabled.value = false; throw new Error('Cookie 同步已关闭') }
    await assertKeyCurrent()
    await cloudApi(vaultPath(account), 'PUT', await encryptCookie(cookieKey.value, account.cookie))
    await loadVaults()
}
function setPassphrase() { return run(async () => { await storeKey(await deriveCookieKey(checkNewPassphrase(passphrase.value))) }) }
// 解密密码输错时 decryptCookie 抛出明确的错误，不改动任何数据。
function unlock() { return run(async () => {
    const sealed = await readVault(vaults.value[0])
    const derived = await deriveCookieKey(passphrase.value, { salt: sealed.salt, iterations: sealed.kdf.iterations })
    await decryptCookie(derived, sealed)
    await storeKey(derived)
}) }
// 忘记解密密码：云端密文无法解开，只能删掉后重新上传本机 Cookie 并设置新的解密密码。
function forgetPassphrase() { return run(async () => {
    for (const vault of vaults.value) await cloudApi(vaultPath(vault), 'DELETE')
    await cloudApi('cookie-key', 'DELETE'); cookieKey.value = null; clearSecrets()
    await loadVaults()
}) }
// 修改解密密码：旧密钥解密、新密钥加密后整体替换；云端账号集合有变化时服务端返回 409，什么都不改。
function changePassphrase() { return run(async () => {
    checkNewPassphrase(passphrase.value)
    const plain = []
    for (const vault of vaults.value) plain.push({ platform: vault.platform, accountUid: vault.accountUid, cookie: await open(await readVault(vault)) })
    const derived = await deriveCookieKey(passphrase.value), sealed = []
    for (const item of plain) sealed.push({ platform: item.platform, accountUid: item.accountUid, ...await encryptCookie(derived, item.cookie) })
    await cloudApi('v1/cookie-vaults', 'PUT', { vaults: sealed })
    await storeKey(derived); changeOpen.value = false
    await loadVaults()
}) }
function uploadLocal() { return run(async () => { await upload(await cloudApi('local-accounts/cookie', 'POST', { id: localAccountId.value })) }) }
function uploadCookie() { return run(async () => {
    const value = cookie.value; cookie.value = ''
    const { accountUid, cookie: normalized } = communityAccount(value, platform.value)
    await upload({ platform: platform.value, accountUid, cookie: normalized }); manualOpen.value = false
}) }
// 解密后走本地米游社导入：存进本机已保存账号，之后在米游社导入里选择它拉取角色。
function importVault(vault) { return run(async () => {
    const value = await open(await readVault(vault))
    const { account } = await mysApi('accounts', 'POST', { cookie: value, platform: vault.platform })
    localAccounts.value = (await cloudApi('local-accounts')).accounts
    notice.value = `已存入本机：${accountLabel(account)}`
}) }
function deleteVault(vault) { return run(async () => { await cloudApi(vaultPath(vault), 'DELETE'); await loadVaults() }) }
onMounted(async () => {
    tickTimer = setInterval(() => { now.value = Date.now() }, 1000)
    await run(async () => {
        const config = await cloudApi('config'); configuredUrl.value = serviceUrl.value = config.url
        if (config.user) { user.value = (await cloudApi('v1/me')).user; await loadAll() }
    })
})
onBeforeUnmount(() => { disposed = true; generation++; clearInterval(tickTimer); clearSecrets(); code.value = '' })
</script>

<style scoped>
.online-account-page{max-width:1040px;margin:0 auto;padding-bottom:24px}.online-account-page h2{font-size:23px;margin:8px 0 20px}.online-account-page h3{font-size:17px;margin:0 0 16px}.online-section{padding:22px 0;border-bottom:1px solid var(--el-border-color-light,#e4e7ed)}.online-section:first-of-type{padding-top:20px}.online-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.online-heading h3{margin:0;overflow-wrap:anywhere}.online-row{display:flex;gap:12px;align-items:center;max-width:720px}.online-row>:first-child{flex:1;min-width:0}.online-field{display:flex;flex-direction:column;gap:8px;max-width:720px;margin:0 0 16px}.online-row+.online-field{margin-top:16px}.online-manual-toggle{margin-top:14px}.online-manual{display:grid;grid-template-columns:130px 1fr auto;gap:12px;margin-top:14px}.online-game-account{padding:22px 0;border-top:1px solid var(--el-border-color-light,#e4e7ed);margin-top:20px}.online-game-account .online-heading{margin-bottom:10px}.online-roles{display:flex;gap:8px 20px;flex-wrap:wrap;font-size:14px}.online-values{display:flex;gap:14px 30px;flex-wrap:wrap;margin:16px 0}.online-values>div{display:flex;gap:10px;font-size:14px}.online-values dt{color:var(--el-text-color-secondary,#909399)}.online-values dd{margin:0}.online-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.online-actions .el-button,.online-manual .el-button,.online-session .el-button{margin-left:0}.online-actions .el-switch{margin-right:12px}.online-error{color:var(--el-color-danger,#f56c6c);overflow-wrap:anywhere;margin:10px 0}.online-job{margin:10px 0}.online-snapshots{margin-top:18px}.online-snapshot,.online-session{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid var(--el-border-color-lighter,#ebeef5)}.online-snapshot>div,.online-session>div{min-width:0;overflow-wrap:anywhere;line-height:1.8}.online-import-result{margin-top:18px}.online-note{color:var(--el-text-color-secondary,#909399);margin:0 0 14px}.online-passphrase{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;max-width:720px;margin-top:14px}.online-passphrase .el-button{margin-left:0}.online-account-page :deep(.el-alert){margin-bottom:8px}
@media(max-width:640px){.online-row{flex-direction:column;align-items:stretch}.online-row>*{width:100%}.online-manual,.online-passphrase{grid-template-columns:1fr}.online-snapshot{align-items:stretch;flex-direction:column}.online-actions{display:grid;grid-template-columns:1fr 1fr}.online-actions .el-switch{grid-column:1/-1}.online-actions .el-button{width:100%}.online-values{flex-direction:column;gap:8px}.online-session{align-items:flex-start}.online-heading strong{overflow-wrap:anywhere}.online-field+.el-button{width:100%}}
</style>
