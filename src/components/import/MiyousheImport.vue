<template>
    <section class="mys-import">
        <p v-if="error && !panelOpen" role="alert" class="mys-error">{{ error }}</p>
        <section class="mys-card mys-characters" aria-label="已保存的角色">
            <miyoushe-character-picker roster :disabled="busy">
                <template #heading-actions>
                    <PageGuideButton guide-id="detail-import" />
                </template>
                <template #actions="{ openManual }">
                    <UiDropdownMenu content-class="character-add-menu">
                        <template #trigger>
                            <UiButton ref="addTrigger" data-tour="uid.import-entry" class="mys-add" aria-label="添加角色">
                                <i-ep-plus /><span>添加角色</span><i-ep-arrow-down />
                            </UiButton>
                        </template>
                        <UiDropdownMenuItem @select="openManual" :disabled="busy">
                            <span class="add-source-icon"><i-ep-user /></span>手动添加角色
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem @select="openAction(panels.cookie)" :disabled="busy">
                            <span class="add-source-icon"><i-ep-key /></span>
                            <span class="add-source-label">Cookie 导入<small>米游社 / HoYoLAB</small></span>
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem @select="openAction(panels.enka)" :disabled="busy || webLoginPending">
                            <span class="add-source-icon"><i-ep-connection /></span>
                            <span class="add-source-label">UID 导入<small>Enka 展柜</small></span>
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem @select="openScreenshot" :disabled="busy">
                            <span class="add-source-icon"><i-ep-picture /></span>
                            <span class="add-source-label">识图导入<small>米游社原神战绩分享图</small></span>
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem @select="openAction('file')" :disabled="busy">
                            <span class="add-source-icon"><i-ep-folder-opened /></span>
                            <span class="add-source-label">导入文件<small>UID 数据包 / 角色快照 / GOOD v3</small></span>
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem @select="openAction(panels.account)" divided>
                            <span class="add-tool-icon"><i-ep-user /></span>Cookie 账号管理
                        </UiDropdownMenuItem>
                        <UiDropdownMenuItem @select="openAction(panels.records)">
                            <span class="add-tool-icon"><i-ep-clock /></span>导入记录
                        </UiDropdownMenuItem>
                    </UiDropdownMenu>
                    <UiButton class="mys-add" @click="exportAllPresets"><i-ep-download /><span>导出角色</span></UiButton>
                </template>
            </miyoushe-character-picker>
        </section>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="restore" />
        <input ref="screenshotInput" type="file" multiple accept="image/*" hidden @change="reviewScreenshots" />
        <RosterScreenshotDialog v-if="screenshotFiles.length" :files="screenshotFiles" :save="saveScreenshot"
            :return-focus="focusAddTrigger" @close="screenshotFiles=[]" />
        <UiDialog v-model="panelOpen" v-if="!bindingCookie" :title="panel" :return-focus="focusAddTrigger" width="min(480px, 94vw)">
            <p v-if="error" role="alert" class="mys-error">{{ error }}</p>
            <section v-if="panel === panels.account" class="mys-card mys-account" aria-label="Cookie 账号管理">
                <div class="mys-section-title"><span>{{ savedAccounts.length }} 个账号</span></div>
                <UiButton v-if="verificationNeeded && loggedIn && !isNative" variant="primary" :disabled="busy" @click="startVerification">完成验证</UiButton>
                <miyoushe-verification v-if="verification" :verification="verification" :submitting="submittingVerification" @complete="finishVerification" @cancel="cancelVerification" />
                <div v-if="savedAccounts.length" class="mys-roster">
                    <div v-for="account in savedAccounts" :key="account.id" class="mys-character" :class="{ active: activeId === account.id }">
                        <div><strong>{{ account.roles[0]?.nickname || `${platformName(account.platform)} ${account.accountUid}` }}{{ activeId === account.id ? ' · 当前' : '' }}</strong>
                            <small>{{ platformName(account.platform) }} ID {{ account.accountUid }} · Cookie {{ account.cookieVersion }} · {{ account.status === 'expired' ? '需要更新' : account.status === 'error' ? '上次读取失败' : '已保存' }}</small>
                            <small>{{ account.roles.map(r => `${r.uid} ${r.regionName || ''}`).join(' / ') || '待读取绑定角色' }}</small>
                            <small v-if="account.lastError" class="mys-warnings">{{ account.lastError }}</small>
                        </div>
                        <div class="mys-account-buttons">
                            <UiButton size="small" :disabled="busy" @click="selectAccount(account.id, true)">使用</UiButton>
                            <UiButton size="small" variant="danger" :disabled="busy" @click="deleteAccount(account.id)">删除 Cookie</UiButton>
                        </div>
                    </div>
                </div>
                <div v-if="loggedIn" class="mys-actions">
                    <select v-model="selectedUid" aria-label="选择原神账号" :disabled="busy">
                        <option v-for="r in roles" :key="r.uid" :value="r.uid">{{ r.nickname }} · {{ r.uid }} · {{ r.regionName }}</option>
                    </select>
                    <UiButton variant="primary" :loading="busy && !enkaImporting" :disabled="!selectedUid || enkaImporting" @click="sync">同步全部角色</UiButton>
                    <UiButton v-if="busy && !enkaImporting" @click="cancelSync">取消同步</UiButton>
                    <UiButton v-else :disabled="busy" @click="refreshRoles">刷新绑定角色</UiButton>
                </div>
                <progress v-if="busy && loggedIn && !enkaImporting" aria-label="同步进度" :value="progress.completed" :max="progress.total || 1" />
            </section>

            <section v-if="panel === panels.cookie" class="mys-login">
                <div class="mys-actions">
                    <UiButton :disabled="busy || webLoginPending" @click="login('miyoushe')">使用米游社登录</UiButton>
                    <UiButton :disabled="busy || webLoginPending" @click="login('hoyolab')">使用 HoYoLAB 登录</UiButton>
                </div>
                <div v-if="qrImage && !loggedIn" class="mys-qr">
                    <img :src="qrImage" alt="米游社登录二维码" width="200" height="200" />
                    <p>{{ qrStatus }}</p>
                    <span>{{ secondsLeft }} 秒</span>
                    <UiButton v-if="isNative" @click="saveQr">保存登录二维码</UiButton>
                </div>
                <p v-if="webLoginPending" class="mys-pending">请在 HoYoLAB 官方窗口完成登录。<UiButton size="small" @click="cancelLogin">取消登录</UiButton></p>
            </section>
            <div v-if="panel === panels.cookie" class="mys-manual">
                <select v-model="loginPlatform" aria-label="Cookie 平台"><option value="miyoushe">米游社</option><option value="hoyolab">HoYoLAB</option></select>
                <input v-model="manualCookie" type="password" autocomplete="off" placeholder="粘贴完整 Cookie（支持 v1 / v2）" aria-label="完整 Cookie" />
                <UiButton :loading="busy" :disabled="!manualCookie.trim() || webLoginPending" @click="addCookie">验证并保存 Cookie</UiButton>
            </div>
            <form v-if="panel === panels.enka" class="mys-manual" @submit.prevent="importEnka">
                <input v-model.trim="enkaUid" aria-label="原神 UID" placeholder="原神 UID" inputmode="numeric" maxlength="10" :disabled="busy" />
                <UiButton variant="primary" type="submit" :disabled="busy || !enkaUid || webLoginPending">导入展柜角色</UiButton>
            </form>
            <section v-if="panel === panels.records" class="mys-card mys-records" aria-label="导入记录">
                <div class="mys-section-title"><span>保存在当前莫娜账号 · {{ importRecords.length }} 条</span></div>
                <p v-if="undoResult" class="mys-result">{{ undoResult }}</p>
                <p v-if="!importRecords.length" class="mys-empty">暂无导入记录</p>
                <div v-else class="mys-import-history">
                    <div v-for="record in importRecords" :key="record.id" class="mys-import-record">
                        <div><strong>{{ record.source }}</strong><small>UID {{ record.uids.join('、') }} · {{ new Date(record.time).toLocaleString() }}</small>
                            <small>{{ record.characters }} 名角色新增／更新 · 新增 {{ record.added }} 件圣遗物</small>
                            <small v-if="record.status === 'undone'">已撤销 · {{ new Date(record.undoneAt).toLocaleString() }}{{ record.retained ? ` · 保留 ${record.retained} 项后续修改／引用` : '' }}</small>
                        </div>
                        <UiButton :disabled="busy || record.status === 'undone'" size="small" variant="danger" @click="undoImport(record.id)">{{ record.status === 'undone' ? '已撤销' : '撤销导入' }}</UiButton>
                    </div>
                </div>
            </section>
            <character-import-result :result="result" />
        </UiDialog>
        <character-import-result v-if="!panelOpen" :result="result" />
    </section>
</template>
<script setup>
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiDropdownMenu from '@/components/ui/UiDropdownMenu.vue'
import UiDropdownMenuItem from '@/components/ui/UiDropdownMenuItem.vue'
import QRCode from 'qrcode'
import { restoreCharacterFile } from '@/import/restore-character-file.mjs'
import { exportAllPresets } from '@/utils/export-presets'
import CharacterImportResult from './CharacterImportResult.vue'
import MiyousheVerification from './MiyousheVerification.vue'
import { recordUsage } from '@/usage-stats/index.mjs'
import MiyousheCharacterPicker from './MiyousheCharacterPicker.vue'
import RosterScreenshotDialog from './RosterScreenshotDialog.vue'
import sets from '@/assets/_gen_artifact'
import { snapshotRelic, POSITIONS } from '@/import/miyoushe.mjs'
import { wornArtifactIds } from '@/import/roster-equipment.mjs'
import { canonicalGameElement } from '@/import/character-summary.mjs'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import { saveGameSnapshot, savePreparedSnapshot } from '@/import/save-game-snapshot.mjs'
import { uidImportSession, bindCookieRole, cancelledImport } from '@/import/uid-import-session'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { watchContent as artifactsContent } from '@/store/pinia/artifact'
import { watchContent as presetsContent } from '@/store/pinia/preset'
import { useAccountStore } from '@/store/pinia/account'
import backend from '@/store/backend'
import { isNative, MonaLocal } from '@/platform/native.mjs'
import { fetchEnkaShowcase } from '@/platform/enka.mjs'
import { enkaSnapshot } from '@/import/enka-showcase.mjs'
import locale from '@/i18n/generated/zh-cn.json'
import { mysApi } from '@/platform/mys-api.mjs'
import { undoImportRecord } from '@/import/import-history.mjs'
import { useKumiStore } from '@/store/pinia/kumi'
import { useArtifactStore } from '@/store/pinia/artifact'
import { usePresetStore } from '@/store/pinia/preset'
const store = useMiyousheStore(), accounts = useAccountStore()
const error = ref(''), busy = ref(false), loggedIn = ref(false), qrImage = ref(''), qrStatus = ref('等待扫码'), secondsLeft = ref(120)
const roles = ref([]), selectedUid = ref(''), result = ref(null), progress = ref({ completed: 0, total: 0 }), fileInput = ref(null)
const savedAccounts = ref([]), activeId = ref(''), manualCookie = ref('')
const loginPlatform = ref('miyoushe'), webLoginPending = ref(false)
const platformName = platform => platform === 'hoyolab' ? 'HoYoLAB' : '米游社'
const panels = { cookie: 'Cookie 导入', account: 'Cookie 账号管理', enka: 'UID 导入（Enka 展柜）', records: '导入记录' }
const panel = ref(''), panelOpen = ref(false), addTrigger = ref(null)
const bindingCookie = ref(false)
function focusAddTrigger() { addTrigger.value?.$el.focus() }
const screenshotInput=ref(null), screenshotFiles=ref([])
let screenshotSession
function openScreenshot() {
    screenshotSession=uidImportSession(accounts.currentAccountId.value, () => {
        if (disposed) throw new Error('角色页已关闭')
    })
    screenshotInput.value.click()
}
function reviewScreenshots(event) {
    const files=Array.from(event.target.files)
    event.target.value=''
    if (!files.length) return
    error.value=''
    result.value=null
    screenshotFiles.value=files
}
async function saveScreenshot(snapshot) {
    result.value = await savePreparedSnapshot(String(snapshot.role.uid), ({ roster, presets, inventory }) => {
        for (const raw of snapshot.characters) {
            const row = roster.data.value.entries.find(e => e.uid === snapshot.role.uid && Number(e.id) === raw.base.id &&
                canonicalGameElement(e.element) === canonicalGameElement(raw.base.element))
            if (!row) continue
            // A cropped or unreadable slot must not unequip the player's current piece.
            const ids = wornArtifactIds(row, presets.presets.value)
            for (const [i, slot] of POSITIONS.entries()) {
                if (raw.relics.some(r => r.pos === i + 1)) continue
                const item = inventory.artifacts.value.get(ids[i]) ?? row.equippedArtifacts?.find(a => a.position === slot)
                if (item) raw.relics.push(snapshotRelic(item, locale[sets[item.setName].nameLocale]))
            }
        }
        return snapshot
    }, '识图导入', screenshotSession)
}
function openAction(action) {
    if (action === 'file') fileInput.value.click()
    else {
        panel.value = action
        panelOpen.value = true
    }
}
const enkaUid = ref(''), enkaImporting = ref(false)
const verificationNeeded = ref(false), verification = ref(null), submittingVerification = ref(false)
let verificationContext = null
const importRecords = computed(() => store.data.value.importRecords || [])
const undoResult = ref('')
async function persistImport(accountId) {
    const saved = JSON.parse(JSON.stringify({ miyoushe: store.data.value, artifacts: artifactsContent(), presets: presetsContent() }))
    await new Promise(resolve => setTimeout(resolve, 0))
    for (const [type, content] of Object.entries(saved)) await backend.setItem(`mona_account_${type}_${accountId}`, content)
    await backend.allReady()
}
async function undoImport(id) {
    busy.value = true; error.value = ''; undoResult.value = ''
    try {
        const inventory = useArtifactStore(), presets = usePresetStore(), accountId = accounts.currentAccountId.value
        const undone = undoImportRecord(id, { data: store.data.value, presets: presets.presets.value, inventory: inventory.artifacts.value,
            addPreset: (name, item) => presets.addOrOverwrite(name, item), deletePreset: name => presets.deletePreset(name),
            removeArtifact: id => inventory.removeArtifact(id), updateArtifact: (id, a) => inventory.updateArtifact(id, a), extraArtifactIds: useKumiStore().kumi.value.flatMap(k => k.artifactIds || []) })
        store.init(undone.data)
        await persistImport(accountId)
        result.value = null
        undoResult.value = `已撤销导入，移除 ${undone.removed} 件新增圣遗物。${undone.retained ? `保留 ${undone.retained} 项后续修改或引用。` : ''}`
    } catch (e) { error.value = e.message }
    finally { busy.value = false }
}
let generation = 0, timer, clock, progressTimer, disposed = false
const api = mysApi
function stopTimers() { clearTimeout(timer); clearInterval(clock); clearInterval(progressTimer) }
async function saveQr() {
    try { await MonaLocal.saveFile({ base64: qrImage.value.split(',')[1], mimeType: 'image/png', filename: 'mona-login-qr.png' }) }
    catch (e) { error.value = e.message }
}
async function loadAccounts() {
    const run = generation
    const data = await api('accounts')
    if (disposed || run !== generation) return
    savedAccounts.value = data.accounts
    return data
}
async function refreshRoles() {
    const run = generation
    busy.value = true; error.value = ''
    try {
        const data = await api('roles')
        if (disposed || run !== generation) return
        roles.value = data
        if (!data.some(r => r.uid === selectedUid.value)) selectedUid.value = data[0]?.uid || ''
        if (!data.length) error.value = '当前账号没有可导入的原神角色'
    } catch (e) { if (!disposed && run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false; await loadAccounts().catch(() => {}) }
}
async function selectAccount(id, bind = false) {
    const run = ++generation, accountId = accounts.currentAccountId.value
    stopTimers(); verificationNeeded.value = false; busy.value = true; error.value = ''; qrImage.value = ''; manualCookie.value = ''
    try {
        const data = await api('select', 'POST', { id })
        if (disposed || run !== generation) return
        activeId.value = id; loginPlatform.value = data.account.platform || 'miyoushe'; webLoginPending.value = false; roles.value = data.roles; loggedIn.value = true
        selectedUid.value = data.roles.find(role => String(role.uid) === store.data.value.boundUid)?.uid || data.roles[0]?.uid || ''
        if (!data.roles.length) await refreshRoles()
        if (bind) await bindCookieUid(accountId, run)
    } catch (e) { if (run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false }
}
async function deleteAccount(id) {
    busy.value = true; error.value = ''
    try {
        await api(`accounts/${encodeURIComponent(id)}`, 'DELETE')
        if (activeId.value === id) { generation++; stopTimers(); activeId.value = ''; loggedIn.value = false; roles.value = []; selectedUid.value = ''; qrImage.value = '' }
        await loadAccounts()
    } catch (e) { error.value = e.message }
    finally { busy.value = false }
}
async function addCookie() {
    const run = ++generation
    const accountId = accounts.currentAccountId.value
    stopTimers(); verificationNeeded.value = false; busy.value = true; error.value = ''; qrImage.value = ''
    const cookie = manualCookie.value
    manualCookie.value = ''
    try {
        const data = await api('accounts', 'POST', { cookie, platform: loginPlatform.value })
        if (disposed || run !== generation) return
        await loadAccounts()
        if (panel.value === panels.cookie) panel.value = panels.account
        activeId.value = data.account.id; roles.value = data.account.roles; selectedUid.value = roles.value[0]?.uid || ''; loggedIn.value = true
        await bindCookieUid(accountId, run)
    } catch (e) { if (run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false }
}
async function cancelSync() {
    generation++; stopTimers()
    try { await api('cancel', 'POST'); error.value = '同步已取消，Cookie 和已保存数据保留' }
    catch (e) { error.value = e.message }
    finally { busy.value = false }
}
async function cancelLogin() {
    generation++; stopTimers(); webLoginPending.value = false
    try { await api('cancel', 'POST') } catch (e) { error.value = e.message }
}
async function login(platform = 'miyoushe') {
    loginPlatform.value = platform; webLoginPending.value = false
    const run = ++generation
    const accountId = accounts.currentAccountId.value
    stopTimers(); verificationNeeded.value = false; error.value = ''; busy.value = true; qrImage.value = ''; loggedIn.value = false; activeId.value = ''; roles.value = []; selectedUid.value = ''
    try {
        const qr = await api('login', 'POST', { platform })
        if (run !== generation || disposed) return
        webLoginPending.value = qr.mode === 'web'
        if (!webLoginPending.value) qrImage.value = await QRCode.toDataURL(qr.url, { width: 256, margin: 2 })
        qrStatus.value = '等待扫码'
        const tick = () => { secondsLeft.value = Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000)); if (!secondsLeft.value) { stopTimers(); qrImage.value = ''; error.value = '二维码已过期，请重新生成' } }
        if (!webLoginPending.value) { tick(); clock = setInterval(tick, 1000) }
        async function poll() {
            try {
                const state = await api('poll', 'POST')
                if (run !== generation || disposed) return
                if (state.status === 'Confirmed') {
                    stopTimers(); qrImage.value = ''; webLoginPending.value = false; loggedIn.value = true
                    const saved = await loadAccounts()
                    if (run !== generation || disposed) return
                    activeId.value = saved?.activeId || ''
                    roles.value = state.roles ?? await api('roles')
                    if (run !== generation || disposed) return
                    selectedUid.value = roles.value[0]?.uid || ''
                    if (panel.value === panels.cookie) panel.value = panels.account
                    if (!roles.value.length) error.value = '当前账号没有可导入的原神角色'
                    await bindCookieUid(accountId, run)
                    await loadAccounts()
                    return
                }
                if (state.status === 'Expired') { stopTimers(); webLoginPending.value = false; qrImage.value = ''; error.value = '二维码已过期，请刷新'; return }
                qrStatus.value = state.status === 'Scanned' ? '已扫码，请在手机确认登录' : '等待扫码'
                if (webLoginPending.value || secondsLeft.value > 0) timer = setTimeout(poll, 3000)
            } catch (e) { if (run === generation) { stopTimers(); error.value = e.message; qrImage.value = ''; webLoginPending.value = false } }
        }
        timer = setTimeout(poll, 3000)
    } catch (e) { if (run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false }
}
async function save(snapshot, accountId, source = snapshot.source === 'hoyolab' ? 'HoYoLAB 同步' : '米游社同步', preserveEquipped = false) {
    const run = generation
    if (panel.value === panels.enka || panel.value === panels.account) panelOpen.value = false
    result.value = await saveGameSnapshot(snapshot, accountId, source, () => {
        if (disposed || run !== generation || accounts.currentAccountId.value !== accountId) throw new Error('同步已取消或莫娜账号已切换，数据未写入')
    }, preserveEquipped)
}
async function bindCookieUid(accountId, run) {
    try {
        const uid = await bindCookieRole(roles.value, accountId, () => {
            if (disposed || run !== generation) throw new Error('登录已取消')
        }, () => { bindingCookie.value = true })
        if (uid) selectedUid.value = uid
    } catch (e) { if (!cancelledImport(e)) throw e }
    finally { bindingCookie.value = false }
}
async function importEnka() {
    if (busy.value || webLoginPending.value) return
    const run = ++generation, accountId = accounts.currentAccountId.value, uid = enkaUid.value
    enkaImporting.value = true
    busy.value = true; error.value = ''; result.value = null
    try {
        const data = await fetchEnkaShowcase(uid)
        if (disposed || generation !== run || accounts.currentAccountId.value !== accountId) return
        const snapshot = enkaSnapshot(uid, data, { characters, weapons, locale })
        await save(snapshot, accountId, 'Enka 展柜导入')
    } catch (e) { if (!disposed && generation === run) error.value = e.message }
    finally { enkaImporting.value = false; if (generation === run) busy.value = false }
}
async function sync() {
    const run = ++generation, accountId = accounts.currentAccountId.value
    error.value = ''; result.value = null; busy.value = true; verificationNeeded.value = false
    progressTimer = setInterval(async () => { try { const p = await api('progress'); if (run === generation) progress.value = p } catch { /* Main request reports errors. */ } }, 1500)
    try { const snapshot = await api('import', 'POST', { uid: selectedUid.value }); if (run === generation && !disposed) { await save(snapshot, accountId); recordUsage('action.miyoushe-import') } }
    catch (e) { if (run === generation) { error.value = e.message; verificationNeeded.value = e.retcode === 1034 && loginPlatform.value !== 'hoyolab' } }
    finally { clearInterval(progressTimer); if (run === generation) busy.value = false; await loadAccounts().catch(() => {}) }
}
async function startVerification() {
    const run = generation
    submittingVerification.value = false
    busy.value = true
    verificationContext = { run, uid: selectedUid.value, accountId: accounts.currentAccountId.value }
    try {
        const data = await api('verification/start', 'POST')
        if (disposed || run !== generation) return
        verification.value = data
    } catch (e) { if (run === generation) { error.value = e.message; busy.value = false } }
}
async function cancelVerification() {
    if (!verification.value) return
    const run = ++generation
    verification.value = null; verificationContext = null
    try { await api('verification/cancel', 'POST') }
    catch (e) { if (!disposed) error.value = e.message }
    finally { if (!disposed && run === generation) busy.value = false }
}
async function finishVerification(result) {
    if (submittingVerification.value || !verification.value) return
    const flowId = verification.value.flowId, context = verificationContext
    let ownedRun = context?.run
    submittingVerification.value = true
    try {
        await api('verification/complete', 'POST', { flowId, result })
        if (disposed || !context || context.run !== generation) return
        if (context.uid !== selectedUid.value || context.accountId !== accounts.currentAccountId.value) throw new Error('账号已切换，请重新同步角色')
        verification.value = null
        submittingVerification.value = false
        verificationNeeded.value = false
        ownedRun = generation + 1
        await sync()
    } catch (e) { if (!disposed && context?.run === generation) { verification.value = null; error.value = e.message } }
    finally {
        if (!disposed && ownedRun === generation) { submittingVerification.value = false; verificationContext = null; busy.value = false }
    }
}
async function restore(event) {
    const file = event.target.files?.[0], accountId = accounts.currentAccountId.value, run = generation
    if (!file) return
    busy.value = true; error.value = ''; result.value = null
    try {
        const imported = await restoreCharacterFile(file, accountId, expected => {
            if (disposed || run !== generation || accounts.currentAccountId.value !== expected) throw new Error('账号已切换，请重新导入')
        })
        if (imported) result.value = imported
    } catch (e) { error.value = e.message }
    finally { busy.value = false; event.target.value = '' }
}
function onCloudCookieImported({ detail: { accounts, account, uid } }) {
    generation++
    stopTimers()
    savedAccounts.value = accounts
    if (uid) selectedUid.value = uid
    else if (activeId.value !== account.id || !account.roles.some(role => role.uid === selectedUid.value)) {
        selectedUid.value = account.roles[0]?.uid || ''
    }
    activeId.value = account.id; roles.value = account.roles; loginPlatform.value = account.platform
    loggedIn.value = true; busy.value = false
    qrImage.value = ''; error.value = ''; manualCookie.value = ''; webLoginPending.value = false
    verification.value = null; verificationNeeded.value = false
}
onMounted(async () => {
    window.addEventListener('mona-cloud-cookie-imported', onCloudCookieImported)
    const run = generation
    busy.value = true
    try {
        const data = await loadAccounts()
        if (!disposed && run === generation && data?.accounts.length) await selectAccount(data.activeId || data.accounts[0].id)
    } catch (e) { if (!disposed) error.value = e.message }
    finally { if (!disposed) busy.value = false }
})
onBeforeUnmount(() => {
    window.removeEventListener('mona-cloud-cookie-imported', onCloudCookieImported)
    disposed = true; generation++; stopTimers(); manualCookie.value = ''; verification.value = null
    if (webLoginPending.value || (busy.value && loggedIn.value && !enkaImporting.value)) api('cancel', 'POST').catch(() => {})
})
</script>
<style scoped>
.mys-import { display: grid; gap: 14px; color: var(--cx-letter); }
.mys-add.ui-button { display: grid; grid-template-columns: 14px auto 14px; align-items: center; justify-content: center; gap: 5px; border-radius: 999px; color: var(--cx-gold); border: 1px dashed currentColor; }
.mys-add svg { width: 14px; height: 14px; }
.mys-account, .mys-records { display: grid; gap: 12px; }
.mys-characters { min-width: 0; }
.mys-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.mys-section-title h3 { margin: 0; font-size: 16px; font-weight: 700; }
.mys-section-title > span { color: var(--cx-dim); font-size: 13px; }
.mys-error { margin: 0 0 10px; padding: 10px; color: var(--cx-up); background: var(--cx-step); border-radius: 7px; }
.mys-manual input, .mys-manual select, .mys-actions select { min-width: 0; min-height: 36px; box-sizing: border-box; padding: 6px 10px; border: 1px solid var(--cx-step-2); border-radius: 7px; background: var(--cx-step); color: var(--cx-letter); font: inherit; font-size: 14px; }
.mys-account progress { width: 100%; accent-color: var(--cx-gold); }

/* 账号 */
.mys-roster { max-height: 340px; overflow: auto; display: grid; gap: 8px; }
.mys-character { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; background: var(--cx-step); }
.mys-character.active { box-shadow: inset 3px 0 var(--cx-gold); }
.mys-character strong { overflow-wrap: anywhere; }
.mys-character small { display: block; font-size: 12px; color: var(--cx-dim); margin-top: 4px; line-height: 1.5; overflow-wrap: anywhere; }
.mys-account-buttons { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.mys-login { display: grid; gap: 12px; padding: 14px; border-radius: 14px; background: var(--cx-step); }
.mys-qr { display: grid; justify-items: center; gap: 6px; }
.mys-qr img { border-radius: 12px; }
.mys-qr p { margin: 0; }
.mys-qr span { color: var(--cx-dim); font-size: 13px; font-variant-numeric: tabular-nums; }
.mys-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mys-actions select { flex: 1 1 200px; }
.mys-pending { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--cx-dim); font-size: 13px; }
.mys-manual { display: flex; flex-wrap: wrap; gap: 8px; }
.mys-manual select { width: 120px; }
.mys-manual input { flex: 1 1 200px; }
.mys-result { margin: 0; color: var(--cx-down); font-size: 13px; line-height: 1.6; }
.mys-warnings { margin: 0; padding-left: 18px; color: var(--cx-gold) !important; font-size: 12px; line-height: 1.7; max-height: 150px; overflow: auto; }

/* 导入记录 */
.mys-import-history { max-height: 420px; overflow: auto; display: grid; gap: 8px; }
.mys-import-record { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--cx-step); }
.mys-import-record strong { overflow-wrap: anywhere; }
.mys-import-record small { display: block; color: var(--cx-dim); font-size: 12px; margin-top: 4px; line-height: 1.5; }
.mys-import-record button { flex-shrink: 0; }
.mys-empty { margin: 0; padding: 18px 0; text-align: center; color: var(--cx-dim); font-size: 13px; }
</style>

<style>
.character-add-menu { width: min(284px, calc(100vw - 24px)); }
.character-add-menu :is(.add-source-icon, .add-tool-icon) {
    display: grid;
    place-items: center;
    flex: 0 0 32px;
    height: 32px;
    font-size: 17px;
}
.character-add-menu .add-source-icon { color: var(--cx-gold); background: var(--cx-step); border-radius: 9px; }
.character-add-menu .add-tool-icon { color: var(--cx-dim); }
.character-add-menu .add-source-label { display: grid; gap: 3px; padding-block: 3px; font-weight: 600; }
.character-add-menu .add-source-label small { color: var(--cx-dim); font-size: 12px; font-weight: 400; }
</style>
