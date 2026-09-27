<template>
    <section class="mys-import">
        <p class="mys-lead">登录一次，把游戏里的养成数据带进莫娜。</p>
        <p class="mys-help">同步国服账号拥有的角色、等级、命座、天赋、武器及已装备圣遗物。未装备的背包圣遗物请继续用 YAS／OCR 导入。</p>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <div class="mys-section-title"><h3>Cookie 账号管理</h3><span>{{ savedAccounts.length }} 个账号</span></div>
        <div class="mys-roster">
            <div v-for="account in savedAccounts" :key="account.id" class="mys-character">
                <div><strong>{{ account.roles[0]?.nickname || `米游社 ${account.id}` }}{{ activeId === account.id ? ' · 当前' : '' }}</strong>
                    <small>米游社 ID {{ account.id }} · Cookie {{ account.cookieVersion }} · {{ account.status === 'expired' ? '需要更新' : account.status === 'error' ? '上次读取失败' : '已保存' }}</small>
                    <small>{{ account.roles.map(r => `${r.uid} ${r.regionName || ''}`).join(' / ') || '待读取绑定角色' }}</small>
                    <small v-if="account.lastError" class="mys-warnings">{{ account.lastError }}</small>
                </div>
                <div class="mys-account-buttons">
                    <el-button size="small" :disabled="busy" @click="selectAccount(account.id)">使用</el-button>
                    <el-button size="small" type="danger" plain :disabled="busy" @click="deleteAccount(account.id)">删除 Cookie</el-button>
                </div>
            </div>
        </div>
        <p class="mys-help">Cookie 在本机加密长期保存，关闭窗口、刷新页面或重启服务均保留。米游社使凭证失效时可扫码更新。删除 Cookie 不影响已导入的角色和装备。</p>
        <div class="mys-login">
            <div v-if="qrImage && !loggedIn" class="mys-qr">
                <img :src="qrImage" alt="米游社登录二维码" width="200" height="200" />
                <p>{{ qrStatus }}</p>
                <small>使用米游社 App 扫码并确认登录 · {{ secondsLeft }} 秒</small>
                <el-button v-if="isNative" @click="saveQr">保存登录二维码</el-button>
                <p v-if="isNative" class="mys-help">可在米游社扫一扫中从相册识别，或用另一台设备扫码。也支持从电脑导入 UID 数据包。</p>
            </div>
            <div class="mys-actions">
                <el-button v-if="!loggedIn" type="primary" :loading="busy" @click="login">{{ qrImage ? '刷新二维码' : '米游社扫码登录' }}</el-button>
                <template v-else>
                    <el-select v-model="selectedUid" placeholder="选择原神账号" :disabled="busy">
                        <el-option v-for="r in roles" :key="r.uid" :value="r.uid" :label="`${r.nickname} · ${r.uid} · ${r.regionName}`" />
                    </el-select>
                    <el-button type="primary" :loading="busy" :disabled="!selectedUid" @click="sync">同步全部角色</el-button>
                    <el-button v-if="busy" @click="cancelSync">取消同步</el-button>
                    <el-button v-else @click="refreshRoles">刷新绑定角色</el-button>
                </template>
                <el-button v-if="loggedIn" :disabled="busy" @click="login">扫码添加 / 更新账号</el-button>
                <el-button :disabled="busy" @click="manualOpen = !manualOpen">手动录入 Cookie</el-button>
            </div>
            <div v-if="manualOpen" class="mys-manual">
                <el-input v-model="manualCookie" type="password" autocomplete="off" placeholder="粘贴完整 Cookie（支持 v1 / v2）" aria-label="完整 Cookie" />
                <el-button :loading="busy" :disabled="!manualCookie.trim()" @click="addCookie">验证并保存 Cookie</el-button>
            </div>
        </div>
        <el-progress v-if="busy && loggedIn" :percentage="progress.total ? Math.round(progress.completed / progress.total * 100) : 0" />
        <p v-if="result" class="mys-result">已保存 {{ result.imported }} 名角色；新增 {{ result.added }} 件、复用 {{ result.reused }} 件圣遗物。{{ result.rejected ? `${result.rejected} 名角色待适配，原始数据已保留。` : '' }}</p>
        <ul v-if="result?.warnings?.length" class="mys-warnings"><li v-for="(w, i) in result.warnings" :key="i">{{ w }}</li></ul>
        <div class="mys-section-title"><h3>已保存的角色</h3><span>{{ store.uidGroups.value.length }} 个 UID · 共 {{ entries.length }} 名</span></div>
        <miyoushe-character-picker :disabled="busy" @apply="name => emit('apply', name)" />
        <p class="mys-help">导入天赋采用游戏显示等级（含命座等级加成）。队伍增益、武器层数和技能触发条件仍按计算页设置，请计算前确认。</p>
        <div class="mys-backup">
            <el-button type="primary" :disabled="!store.selectedUid.value || busy" @click="exportUid">导出此 UID 到手机 / 电脑</el-button>
            <el-checkbox v-model="includeInventory">附带未标记 UID 的仓库圣遗物（归入此 UID）</el-checkbox>
            <el-button size="small" :disabled="!Object.keys(store.data.value.snapshots).length || busy" @click="exportSnapshots">导出角色快照</el-button>
            <el-button size="small" :disabled="busy" @click="fileInput?.click()">导入 UID 数据包 / 角色快照</el-button>
            <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="restore" />
        </div>
        <p class="mys-help">此 UID 将导出 {{ exportArtifactCount }} 件圣遗物，包含已穿戴和闲置装备；已标记为其他 UID 的装备不包含在内。旧版 YAS／OCR 仓库没有 UID 标记时，可勾选上方选项一并带入。</p>
        <div class="mys-section-title"><h3>导入记录</h3><span>保存在当前莫娜账号 · {{ importRecords.length }} 条</span></div>
        <p class="mys-help">撤销会恢复导入前的角色、预设和归属，仅移除本次非重复新增且未被修改或引用的装备；去重复用的原有装备始终保留。同一 UID 请从最新记录向前撤销；后续手动修改会保留。更新前的导入无法追溯。</p>
        <p v-if="undoResult" class="mys-result">{{ undoResult }}</p>
        <el-empty v-if="!importRecords.length" description="暂无导入记录" :image-size="65" />
        <div v-else class="mys-import-history">
            <div v-for="record in importRecords" :key="record.id" class="mys-import-record">
                <div><strong>{{ record.source }}</strong><small>UID {{ record.uids.join('、') }} · {{ new Date(record.time).toLocaleString() }}</small>
                    <small>{{ record.characters }} 名角色新增／更新 · 新增 {{ record.added }} 件圣遗物</small>
                    <small v-if="record.status === 'undone'">已撤销 · {{ new Date(record.undoneAt).toLocaleString() }}{{ record.retained ? ` · 保留 ${record.retained} 项后续修改／引用` : '' }}</small>
                </div>
                <el-button :disabled="busy || record.status === 'undone'" size="small" type="danger" plain @click="undoImport(record.id)">{{ record.status === 'undone' ? '已撤销' : '撤销导入' }}</el-button>
            </div>
        </div>
    </section>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import QRCode from 'qrcode'
import MiyousheCharacterPicker from './MiyousheCharacterPicker.vue'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import targets from '@/assets/_gen_tf'
import locale from '@/i18n/generated/zh-cn.json'
import { createMysConverter } from '@/import/miyoushe.mjs'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { watchContent as artifactsContent } from '@/store/pinia/artifact'
import { watchContent as presetsContent } from '@/store/pinia/preset'
import { useAccountStore } from '@/store/pinia/account'
import backend from '@/store/backend'
import { useMona } from '@/wasm/mona'
import { isNative, MonaLocal, saveText } from '@/platform/native.mjs'
import { captureImportState, appendImportRecord, undoImportRecord } from '@/import/import-history.mjs'
import { selectUidInventory } from '@/import/uid-inventory.mjs'
import { useKumiStore } from '@/store/pinia/kumi'
import { exportUidPackage, importUidPackage } from '@/import/uid-package.mjs'
import { useArtifactStore } from '@/store/pinia/artifact'
import { usePresetStore } from '@/store/pinia/preset'
const emit = defineEmits(['apply'])
const store = useMiyousheStore(), accounts = useAccountStore()
const entries = computed(() => store.data.value.entries)
const error = ref(''), busy = ref(false), loggedIn = ref(false), qrImage = ref(''), qrStatus = ref('等待扫码'), secondsLeft = ref(120)
const roles = ref([]), selectedUid = ref(''), result = ref(null), progress = ref({ completed: 0, total: 0 }), fileInput = ref(null)
const savedAccounts = ref([]), activeId = ref(''), manualOpen = ref(false), manualCookie = ref('')
const includeInventory = ref(true)
const importRecords = computed(() => store.data.value.importRecords || [])
const undoResult = ref('')
const exportArtifactCount = computed(() => selectUidInventory(store.selectedUid.value, store.data.value, usePresetStore().presets.value, useArtifactStore().artifacts.value, includeInventory.value).length)
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
            removeArtifact: id => inventory.removeArtifact(id), extraArtifactIds: useKumiStore().kumi.value.flatMap(k => k.artifactIds || []) })
        store.init(undone.data)
        await persistImport(accountId)
        result.value = null
        undoResult.value = `已撤销导入，移除 ${undone.removed} 件新增圣遗物。${undone.retained ? `保留 ${undone.retained} 项后续修改或引用。` : ''}`
    } catch (e) { error.value = e.message }
    finally { busy.value = false }
}
let generation = 0, timer, clock, progressTimer, disposed = false
async function api(path, method = 'GET', body) {
    if (isNative) return (await import('@/platform/mys-mobile.mjs')).mobileMysApi(path, method, body)
    let response
    try { response = await fetch(`/api/mys/${path}`, { method, headers: { 'X-Mona-Local': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'same-origin' }) }
    catch { throw new Error('本机服务连接失败，请在项目目录运行 npm start，并打开 http://127.0.0.1:4174') }
    if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('扫码登录需要本机服务。请运行 npm start，打开 http://127.0.0.1:4174')
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '同步失败')
    return data
}
function stopTimers() { clearTimeout(timer); clearInterval(clock); clearInterval(progressTimer) }
async function saveQr() {
    try { await MonaLocal.saveFile({ base64: qrImage.value.split(',')[1], mimeType: 'image/png', filename: 'mona-login-qr.png' }) }
    catch (e) { error.value = e.message }
}
async function loadAccounts() {
    const data = await api('accounts')
    if (disposed) return
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
        if (!data.length) error.value = '当前账号没有可导入的国服原神角色'
    } catch (e) { if (!disposed && run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false; await loadAccounts().catch(() => {}) }
}
async function selectAccount(id) {
    const run = ++generation
    stopTimers(); busy.value = true; error.value = ''; qrImage.value = ''; manualCookie.value = ''
    try {
        const data = await api('select', 'POST', { id })
        if (disposed || run !== generation) return
        activeId.value = id; roles.value = data.roles; selectedUid.value = data.roles[0]?.uid || ''; loggedIn.value = true
        if (!data.roles.length) await refreshRoles()
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
    stopTimers(); busy.value = true; error.value = ''; qrImage.value = ''
    const cookie = manualCookie.value
    manualCookie.value = ''
    try {
        const data = await api('accounts', 'POST', { cookie })
        if (disposed || run !== generation) return
        await loadAccounts(); manualOpen.value = false
        activeId.value = data.account.id; roles.value = data.account.roles; selectedUid.value = roles.value[0]?.uid || ''; loggedIn.value = true
    } catch (e) { if (run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false }
}
async function cancelSync() {
    generation++; stopTimers()
    try { await api('cancel', 'POST'); error.value = '同步已取消，Cookie 和已保存数据保留' }
    catch (e) { error.value = e.message }
    finally { busy.value = false }
}
async function login() {
    const run = ++generation
    stopTimers(); error.value = ''; busy.value = true; qrImage.value = ''; loggedIn.value = false; activeId.value = ''; roles.value = []; selectedUid.value = ''
    try {
        const qr = await api('login', 'POST')
        if (run !== generation || disposed) return
        qrImage.value = await QRCode.toDataURL(qr.url, { width: 256, margin: 2 })
        qrStatus.value = '等待扫码'
        const tick = () => { secondsLeft.value = Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000)); if (!secondsLeft.value) { stopTimers(); qrImage.value = ''; error.value = '二维码已过期，请重新生成' } }
        tick(); clock = setInterval(tick, 1000)
        async function poll() {
            try {
                const state = await api('poll', 'POST')
                if (run !== generation || disposed) return
                if (state.status === 'Confirmed') {
                    stopTimers(); qrImage.value = ''; loggedIn.value = true
                    const saved = await loadAccounts()
                    if (run !== generation || disposed) return
                    activeId.value = saved?.activeId || ''
                    roles.value = await api('roles')
                    if (run !== generation || disposed) return
                    selectedUid.value = roles.value[0]?.uid || ''
                    if (!roles.value.length) error.value = '当前米游社账号没有可导入的国服原神角色'
                    await loadAccounts()
                    return
                }
                if (state.status === 'Expired') { stopTimers(); qrImage.value = ''; error.value = '二维码已过期，请刷新'; return }
                qrStatus.value = state.status === 'Scanned' ? '已扫码，请在手机确认登录' : '等待扫码'
                if (secondsLeft.value > 0) timer = setTimeout(poll, 3000)
            } catch (e) { if (run === generation) { stopTimers(); error.value = e.message; qrImage.value = '' } }
        }
        timer = setTimeout(poll, 3000)
    } catch (e) { if (run === generation) error.value = e.message }
    finally { if (run === generation) busy.value = false }
}
async function save(snapshot, accountId, source = '米游社同步') {
    const run = generation
    const mona = await useMona()
    if (disposed || run !== generation || accounts.currentAccountId.value !== accountId) throw new Error('同步已取消或莫娜账号已切换，数据未写入')
    const converter = createMysConverter({ characters, weapons, artifacts, targets, locale,
        inferAscend(c, w, hp) {
            if (!Number.isFinite(hp)) return undefined
            const values = [false, true].map(ascend => mona.CommonInterface.get_attribute({ character: { ...c, ascend }, weapon: w, artifacts: [], buffs: [], artifact_config: null }).hp['角色基础生命'])
            const errors = values.map(n => Math.abs(n - hp))
            if (Math.min(...errors) > 3 || Math.abs(values[0] - values[1]) < 1) return undefined
            return errors[1] < errors[0]
        },
    })
    const imported = store.importSnapshot(snapshot, converter, source)
    const saved = JSON.parse(JSON.stringify({ miyoushe: store.data.value, artifacts: artifactsContent(), presets: presetsContent() }))
    // Let the account store's persistence watchers enqueue their writes before reporting success.
    await new Promise(resolve => setTimeout(resolve, 0))
    for (const [type, content] of Object.entries(saved)) await backend.setItem(`mona_account_${type}_${accountId}`, content)
    await backend.allReady()
    result.value = imported
}
async function sync() {
    const run = ++generation, accountId = accounts.currentAccountId.value
    error.value = ''; result.value = null; busy.value = true
    progressTimer = setInterval(async () => { try { const p = await api('progress'); if (run === generation) progress.value = p } catch { /* Main request reports errors. */ } }, 1500)
    try { const snapshot = await api('import', 'POST', { uid: selectedUid.value }); if (run === generation && !disposed) await save(snapshot, accountId) }
    catch (e) { if (run === generation) error.value = e.message }
    finally { clearInterval(progressTimer); if (run === generation) busy.value = false; await loadAccounts().catch(() => {}) }
}
async function exportSnapshots() {
    try { await saveText(JSON.stringify(Object.values(store.data.value.snapshots), null, 2), 'application/json', 'mona-miyoushe-characters.json') }
    catch (e) { error.value = e.message }
}
async function exportUid() {
    try {
        const pack = exportUidPackage(store.selectedUid.value, store.data.value, usePresetStore().presets.value, useArtifactStore().artifacts.value, includeInventory.value)
        await saveText(JSON.stringify(pack), 'application/json', `mona-uid-${pack.uid}.json`)
    } catch (e) { error.value = e.message }
}
async function restore(event) {
    const file = event.target.files?.[0], accountId = accounts.currentAccountId.value
    if (!file) return
    busy.value = true; error.value = ''
    try {
        if (file.size > 50 * 1024 * 1024) throw new Error('文件超过 50 MB')
        const raw = JSON.parse(await file.text())
        if (raw?.format === 'mona-uid') {
            if (disposed || accounts.currentAccountId.value !== accountId) throw new Error('账号已切换，请重新导入')
            const inventory = useArtifactStore(), presets = usePresetStore()
            const before = captureImportState(store.data.value, presets.presets.value, inventory.artifacts.value)
            const imported = importUidPackage(raw, { data: store.data.value, presets: presets.presets.value, inventory: inventory.artifacts.value,
                addArtifact: a => inventory.addArtifact(a), addPreset: (name, item) => presets.addOrOverwrite(name, item), catalog: { characters, weapons, artifacts, targets } })
            store.init(appendImportRecord(imported.data, before, presets.presets.value, inventory.artifacts.value, { source: file.name, uids: [raw.uid] }))
            await new Promise(resolve => setTimeout(resolve, 0))
            for (const [type, content] of Object.entries({ miyoushe: store.data.value, artifacts: artifactsContent(), presets: presetsContent() })) await backend.setItem(`mona_account_${type}_${accountId}`, JSON.parse(JSON.stringify(content)))
            await backend.allReady()
            result.value = { imported: imported.imported, added: imported.added, reused: raw.artifacts.length - imported.added }
            return
        }
        const snapshots = Array.isArray(raw) ? raw : [raw]
        if (snapshots.length > 10) throw new Error('单次最多恢复 10 个 UID')
        for (const snapshot of snapshots) await save(snapshot, accountId, file.name)
    } catch (e) { error.value = e.message }
    finally { busy.value = false; event.target.value = '' }
}
onMounted(async () => {
    const run = generation
    busy.value = true
    try {
        const data = await loadAccounts()
        if (!disposed && run === generation && data?.accounts.length) await selectAccount(data.activeId || data.accounts[0].id)
    } catch (e) { if (!disposed) error.value = e.message }
    finally { if (!disposed) busy.value = false }
})
onBeforeUnmount(() => {
    disposed = true; generation++; stopTimers(); manualCookie.value = ''
    if (busy.value && loggedIn.value) api('cancel', 'POST').catch(() => {})
})
</script>
<style scoped>
.mys-import-history{max-height:420px;overflow:auto}.mys-import-record{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--el-border-color-light)}.mys-import-record strong{overflow-wrap:anywhere}.mys-import-record small{display:block;color:var(--el-text-color-secondary);margin-top:5px}.mys-import-record .el-button{flex-shrink:0}

.mys-account-buttons{display:flex;flex-direction:column;gap:8px}.mys-account-buttons .el-button{margin-left:0}.mys-manual{display:flex;gap:10px;margin-top:14px}
.mys-import{color:var(--el-text-color-primary)}.mys-lead{font-size:20px;font-weight:600;margin-top:0}.mys-help{font-size:13px;line-height:1.7;color:var(--el-text-color-secondary)}.mys-login{background:var(--el-fill-color-light);border:1px solid var(--el-border-color-light);border-radius:12px;padding:18px;margin:18px 0}.mys-qr{text-align:center;margin-bottom:18px}.mys-qr img{border-radius:10px}.mys-qr p{margin:8px 0}.mys-qr small{color:var(--el-text-color-secondary)}.mys-actions,.mys-backup{display:flex;gap:10px;flex-wrap:wrap}.mys-actions .el-button+.el-button{margin-left:0}.mys-section-title{display:flex;align-items:center;justify-content:space-between}.mys-section-title span{color:var(--el-text-color-secondary);font-size:13px}.mys-roster{max-height:340px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:10px}.mys-character{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px;background:var(--el-fill-color-light);border-radius:8px}.mys-character small{display:block;font-size:11px;color:var(--el-text-color-secondary);margin-top:5px;line-height:1.5}.mys-result{color:#218354}.mys-warnings{color:#a46410!important;font-size:12px;line-height:1.7;max-height:150px;overflow:auto}.mys-backup{border-top:1px solid var(--el-border-color-light);padding-top:15px}@media(max-width:600px){.mys-roster{grid-template-columns:1fr}}
</style>
