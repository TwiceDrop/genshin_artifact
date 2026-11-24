<template>
    <div class="cookie-panel">
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

        <!-- 本区块的文案均为占位，待开发者确认（docs/specs/online-accounts/issues/08-cookie-client-encryption.md 的 Comments） -->
        <section class="oa-card">
            <div class="oa-heading"><h3>云端 Cookie</h3><el-button :disabled="busy" @click="refreshAll">刷新</el-button></div>
            <div v-if="!cookieKey && !vaults.length" class="oa-passphrase">
                <el-input v-model="passphrase" type="password" autocomplete="new-password" label="解密密码" placeholder="设置解密密码" :disabled="busy" />
                <el-input v-model="passphraseConfirm" type="password" autocomplete="new-password" label="确认解密密码" placeholder="再次输入解密密码" :disabled="busy" />
                <el-button type="primary" :disabled="busy || !passphrase || passphrase !== passphraseConfirm" @click="setPassphrase">设置解密密码</el-button>
            </div>
            <div v-else-if="!cookieKey" class="oa-passphrase">
                <el-input v-model="passphrase" type="password" autocomplete="current-password" label="解密密码" placeholder="输入解密密码" :disabled="busy" @keyup.enter="unlock" />
                <el-button type="primary" :disabled="busy || !passphrase" @click="unlock">解锁</el-button>
                <el-popconfirm :teleported="false" title="删除云端全部 Cookie，之后重新上传并设置新的解密密码？" confirm-button-text="删除" cancel-button-text="取消" @confirm="forgetPassphrase">
                    <template #reference><el-button :disabled="busy">忘记解密密码</el-button></template>
                </el-popconfirm>
            </div>
            <template v-else>
                <div class="oa-row">
                    <el-select v-model="localAccountId" aria-label="本机游戏账号" placeholder="选择本机已保存账号" :disabled="busy" style="width:100%">
                        <el-option v-for="account in localAccounts" :key="account.id" :value="account.id" :label="accountLabel(account)" />
                    </el-select>
                    <el-button type="primary" :disabled="busy || !localAccountId" @click="uploadLocal">加密上传所选 Cookie</el-button>
                </div>
                <div class="oa-actions oa-manual-toggle">
                    <el-button :disabled="busy" @click="manualOpen = !manualOpen">手动输入 Cookie</el-button>
                    <el-button :disabled="busy" @click="changeOpen = !changeOpen">修改解密密码</el-button>
                </div>
                <div v-if="manualOpen" class="oa-manual">
                    <el-select v-model="platform" aria-label="Cookie 平台" :disabled="busy"><el-option value="miyoushe" label="米游社" /><el-option value="hoyolab" label="HoYoLAB" /></el-select>
                    <el-input v-model="cookie" type="password" autocomplete="off" label="Cookie" placeholder="Cookie" :disabled="busy" />
                    <el-button :disabled="busy || !cookie.trim()" @click="uploadCookie">加密上传 Cookie</el-button>
                </div>
                <div v-if="changeOpen" class="oa-passphrase">
                    <el-input v-model="passphrase" type="password" autocomplete="new-password" label="新解密密码" placeholder="新解密密码" :disabled="busy" />
                    <el-input v-model="passphraseConfirm" type="password" autocomplete="new-password" label="确认新解密密码" placeholder="再次输入新解密密码" :disabled="busy" />
                    <el-button type="primary" :disabled="busy || !passphrase || passphrase !== passphraseConfirm" @click="changePassphrase">确认修改</el-button>
                </div>
            </template>
            <el-empty v-if="!vaults.length" description="云端暂无 Cookie" />
            <div v-for="vault in vaults" :key="vaultKey(vault)" class="oa-session">
                <div><strong>{{ platformName(vault.platform) }} · {{ vault.accountUid }}</strong><div>上传于 {{ dateText(vault.updatedAt) }}</div></div>
                <div class="oa-actions">
                    <el-button type="primary" :disabled="busy || !cookieKey" @click="importVault(vault)">导入本机</el-button>
                    <el-popconfirm :teleported="false" title="删除这条云端 Cookie？" confirm-button-text="删除" cancel-button-text="取消" @confirm="deleteVault(vault)">
                        <template #reference><el-button type="danger" plain :disabled="busy">删除</el-button></template>
                    </el-popconfirm>
                </div>
            </div>
            <div v-if="notice" class="oa-result" role="status">{{ notice }}</div>
        </section>

        <section class="oa-card">
            <h3>登录设备</h3>
            <div v-for="session in sessions" :key="session.id" class="oa-session">
                <div><strong>{{ session.deviceName || '未命名设备' }}{{ session.current ? ' · 当前设备' : '' }}</strong><div>最近使用 {{ dateText(session.lastUsedAt) }}</div></div>
                <el-button :disabled="busy" @click="revokeSession(session)">退出此设备</el-button>
            </div>
        </section>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cloudApi } from '@/platform/cloud.mjs'

import { mysApi } from '@/platform/mys-api.mjs'
import { bindCookieRole, cancelledImport } from '@/import/uid-import-session'
import { useAccountStore } from '@/store/pinia/account'
import { setOnlineUser } from '@/cloud/online-user.mjs'
import { deriveCookieKey, encryptCookie, decryptCookie, checkNewPassphrase } from '@/cloud/cookie-crypto.mjs'
import { communityAccount } from '../../../server/cookie.mjs'

// 本面板只在已登录时由账户管理与同步页显示；登录、退出、改资料都在页面的其他部分
const error = ref(''), busy = ref(false)
const localAccounts = ref([]), localAccountId = ref(''), vaults = ref([]), sessions = ref([]), cookieKey = ref(null)
const manualOpen = ref(false), changeOpen = ref(false), cookie = ref(''), platform = ref('miyoushe'), passphrase = ref(''), passphraseConfirm = ref(''), notice = ref('')
let disposed = false, generation = 0
const platformName = value => value === 'hoyolab' ? 'HoYoLAB' : '米游社'
const accountLabel = account => `${platformName(account.platform)} · ${account.accountUid}${account.roles?.[0]?.nickname ? ` · ${account.roles[0].nickname}` : ''}`
const vaultKey = vault => `${vault.platform}/${vault.accountUid}`
const vaultPath = vault => `v1/cookie-vaults/${vault.platform}/${vault.accountUid}`
const dateText = value => value ? new Date(value).toLocaleString() : '—'
function clearSecrets() { cookie.value = ''; passphrase.value = ''; passphraseConfirm.value = '' }
function clearAccount() { generation++; vaults.value = []; sessions.value = []; cookieKey.value = null; notice.value = ''; changeOpen.value = false; clearSecrets() }
function showError(e) { error.value = e.message; if (e.status === 401) { clearAccount(); setOnlineUser(null) } }
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
    sessions.value = devices.sessions; localAccounts.value = local.accounts
    if (!local.accounts.some(account => account.id === localAccountId.value)) localAccountId.value = local.accounts[0]?.id || ''
}
function refreshAll() { return run(loadAll) }
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
    const accountId = useAccountStore().currentAccountId.value, started = generation
    const value = await open(await readVault(vault))
    const { account } = await mysApi('accounts', 'POST', { cookie: value, platform: vault.platform, source: 'cloud-vault' })
    const { accounts } = await cloudApi('local-accounts')
    localAccounts.value = accounts
    localAccountId.value = account.id
    let uid
    try {
        uid = await bindCookieRole(account.roles, accountId, () => {
            if (disposed || started !== generation) throw new Error('账户已切换，请重新导入')
        })
    } catch (e) { if (cancelledImport(e)) return; throw e }
    window.dispatchEvent(new window.CustomEvent('mona-cloud-cookie-imported', { detail: { accounts, account, uid } }))
    notice.value = `已存入本机：${accountLabel(account)}`
}) }
function deleteVault(vault) { return run(async () => { await cloudApi(vaultPath(vault), 'DELETE'); await loadVaults() }) }
onMounted(() => run(loadAll))
onBeforeUnmount(() => { disposed = true; generation++; clearSecrets() })
</script>

<style scoped lang="scss">
// 夜空风格卡片：颜色读外层 .cx-scope 的 --cx-*
.oa-card {
    max-width: 760px;
    margin-bottom: 12px;
    padding: 16px 18px;
    border-radius: 16px;
    background: var(--cx-card);
    color: var(--cx-letter);

    h3 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 700;
    }
}

.cookie-panel :deep(.el-alert) {
    max-width: 760px;
    margin-bottom: 12px;
}

.oa-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;

    h3 {
        margin: 0;
    }
}

.oa-row {
    display: flex;
    gap: 12px;
    align-items: center;

    > :first-child {
        flex: 1;
        min-width: 0;
    }
}

.oa-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .el-button {
        margin-left: 0;
    }
}

.oa-manual-toggle {
    margin-top: 14px;
}

.oa-manual {
    display: grid;
    grid-template-columns: 130px 1fr auto;
    gap: 12px;
    margin-top: 14px;

    .el-button {
        margin-left: 0;
    }
}

.oa-passphrase {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 12px;
    margin-top: 14px;

    .el-button {
        margin-left: 0;
    }
}

.oa-session {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 0;
    box-shadow: 0 -1px 0 var(--cx-step-2);

    > div {
        min-width: 0;
        overflow-wrap: anywhere;
        line-height: 1.8;
    }

    .el-button {
        margin-left: 0;
    }
}

.oa-result {
    margin-top: 14px;
}

@media (max-width: 640px) {
    .oa-row {
        flex-direction: column;
        align-items: stretch;

        > * {
            width: 100%;
        }
    }

    .oa-manual,
    .oa-passphrase {
        grid-template-columns: 1fr;
    }

    .oa-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;

        .el-button {
            width: 100%;
        }
    }

    .oa-session {
        align-items: flex-start;
    }
}
</style>
