<template>
    <section class="cloud-profiles">
        <div class="profiles-heading"><h3>数据同步</h3><el-button :disabled="working" @click="refresh">刷新云档案</el-button></div>
        <el-alert v-if="error || sync.state.error" :title="error || sync.state.error" type="error" :closable="false" show-icon />
        <div class="profile-current">
            <div class="profiles-heading"><strong>当前本地账号 · {{ account.currentAccountName.value }}</strong><el-tag>{{ binding ? statusLabel(binding.status) : '未关联' }}</el-tag></div>
            <div v-if="binding" class="profile-meta"><span>云端修订 {{ binding.baseRevision }}</span><span v-if="binding.lastSyncedAt">{{ dateText(binding.lastSyncedAt) }}</span></div>
            <div v-if="binding?.error && binding.error !== error" class="profile-error" role="alert">{{ binding.error }}</div>
            <div class="profile-actions">
                <el-button v-if="!binding" type="primary" :disabled="working" @click="run(() => sync.createCurrent())">关联当前账号并自动同步</el-button>
                <template v-else>
                    <el-switch :model-value="binding.enabled" active-text="自动同步" :disabled="working || binding.status === 'deleted'" @change="value => run(() => sync.setEnabled(account.currentAccountId.value, value))" />
                    <el-button :disabled="working || binding.status === 'conflict' || binding.status === 'deleted'" @click="run(() => sync.syncCurrent())">立即同步</el-button>
                    <el-button :disabled="working" @click="run(() => sync.unlink(account.currentAccountId.value))">解除关联</el-button>
                </template>
            </div>
            <div v-if="binding?.status === 'conflict'" class="profile-conflict">
                <div>冲突修订 {{ binding.conflictRevision }}</div>
                <div class="profile-actions">
                    <el-button :disabled="working" @click="run(() => sync.resolveCurrent('remote'))">采用云端</el-button>
                    <el-button :disabled="working" @click="run(() => sync.resolveCurrent('local'))">保留本机</el-button>
                    <el-button type="primary" :disabled="working" @click="run(() => sync.resolveCurrent('copy'))">另存为新云档案</el-button>
                </div>
            </div>
        </div>
        <el-empty v-if="!sync.state.profiles.length" description="暂无云档案" />
        <article v-for="profile in sync.state.profiles" :key="profile.id" class="cloud-profile">
            <div class="profiles-heading"><strong>{{ profile.name || '已删除档案' }}</strong><el-tag>{{ profile.deletedAt ? '已删除' : `修订 ${profile.revision}` }}</el-tag></div>
            <div class="profile-meta"><span>{{ dateText(profile.updatedAt) }}</span></div>
            <div v-if="!profile.deletedAt" class="profile-actions">
                <el-button :disabled="working || !profile.revision" @click="run(() => sync.downloadNew(profile.id))">下载为新本地账号</el-button>
                <el-button :disabled="working || !profile.revision" @click="loadVersions(profile)">查看修订</el-button>
                <el-popconfirm title="删除云档案及全部修订和历史？" confirm-button-text="删除" cancel-button-text="取消" @confirm="run(() => sync.deleteCloud(profile.id))">
                    <template #reference><el-button type="danger" plain :disabled="working">删除云档案</el-button></template>
                </el-popconfirm>
            </div>
            <div v-if="versions[profile.id]" class="profile-versions">
                <div v-for="revision in versions[profile.id].items" :key="revision.revision" class="profile-version">
                    <span>修订 {{ revision.revision }} · {{ revisionLabel(revision.status) }} · {{ dateText(revision.createdAt) }}</span>
                    <el-button :disabled="working" @click="run(() => sync.downloadNew(profile.id, revision.revision))">下载此修订</el-button>
                </div>
                <el-button v-if="versions[profile.id].nextCursor" :disabled="working" @click="loadVersions(profile, true)">更多修订</el-button>
            </div>
        </article>
    </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useAccountStore } from '@/store/pinia/account'
import { profileSync as sync } from '@/cloud/profile-sync'
import { cloudApi } from '@/platform/cloud.mjs'

const props = defineProps({ user: { type: Object, required: true }, serviceUrl: { type: String, required: true } })
const account = useAccountStore(), error = ref(''), pending = ref(false), versions = ref({})
const working = computed(() => pending.value || sync.state.busy)
const binding = computed(() => sync.state.bindings.find(item => item.localAccountId === account.currentAccountId.value))
let disposed = false, generation = 0
const dateText = value => value ? new Date(value).toLocaleString() : '—'
const statusLabel = value => ({ synced:'已同步', syncing:'同步中', pending:'待同步', dirty:'待提交', offline:'离线待同步', conflict:'存在冲突', deleted:'云档案已删除', disabled:'已暂停', paused:'已暂停', waiting:'等待计算结束', running:'等待计算结束', error:'同步失败', idle:'待同步' }[value] || value)
const revisionLabel = value => ({ applied:'已采用', conflict:'冲突副本', deleted:'已删除' }[value] || value)
async function run(action) {
    if (working.value) return
    const identity = generation
    pending.value = true; error.value = ''
    try { await action() } catch (e) { if (!disposed && identity === generation) error.value = e.message }
    finally { pending.value = false }
}
function refresh() { return run(() => sync.refresh()) }
function loadVersions(profile, more = false) { return run(async () => {
    const identity = generation, before = more ? versions.value[profile.id]?.nextCursor : null
    const result = await cloudApi(`v1/profiles/${profile.id}/revisions?limit=20${before ? `&before=${before}` : ''}`, 'GET', undefined, { url: props.serviceUrl, userId: props.user.id })
    if (disposed || identity !== generation) return
    versions.value[profile.id] = { items: [...(more ? versions.value[profile.id].items : []), ...result.revisions], nextCursor: result.nextCursor }
}) }
watch(() => `${props.serviceUrl}:${props.user.id}`, () => { generation++; versions.value = {}; error.value = ''; refresh() })
onMounted(refresh)
onBeforeUnmount(() => { disposed = true; generation++ })
</script>

<style scoped>
.cloud-profiles{padding:22px 0;border-bottom:1px solid var(--el-border-color-light,#e4e7ed)}.profiles-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.profiles-heading h3{font-size:17px;margin:0}.profiles-heading strong{overflow-wrap:anywhere}.profile-current{padding:18px 0}.profile-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.profile-actions .el-button{margin-left:0}.profile-actions .el-switch{margin-right:8px}.profile-meta{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;color:var(--el-text-color-secondary,#909399);font-size:14px}.profile-error{margin:10px 0;color:var(--el-color-danger,#f56c6c);overflow-wrap:anywhere}.cloud-profile{padding:18px 0;border-top:1px solid var(--el-border-color-light,#e4e7ed)}.profile-conflict{margin-top:16px}.profile-conflict>.profile-actions{margin-top:10px}.profile-versions{margin-top:14px}.profile-version{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;font-size:14px;border-top:1px solid var(--el-border-color-lighter,#ebeef5)}
@media(max-width:640px){.profile-actions{display:grid;grid-template-columns:1fr 1fr}.profile-actions .el-switch{grid-column:1/-1}.profile-actions .el-button{width:100%}.profiles-heading{align-items:flex-start}.profile-version{align-items:flex-start;flex-direction:column}}
</style>
