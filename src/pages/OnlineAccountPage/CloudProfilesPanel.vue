<template>
    <section class="oa-panel cloud-profiles" aria-labelledby="oa-profiles">
        <header class="oa-panel-head">
            <div class="profiles-title">
                <h3 id="oa-profiles" class="oa-panel-title">数据同步</h3>
                <span class="profile-badge" :data-status="binding?.status">{{ binding ? statusLabel(binding.status) : '未关联' }}</span>
            </div>
            <div class="oa-actions oa-actions-end">
                <UiButton :disabled="working" @click="refresh">刷新云档案</UiButton>
                <UiButton v-if="binding" variant="primary" :disabled="working || binding.status === 'conflict' || binding.status === 'deleted'"
                    @click="run(() => sync.syncCurrent())">立即同步</UiButton>
            </div>
        </header>
        <div class="profile-current">
            <div class="oa-list-main">
                <strong>当前本地账号 · {{ account.currentAccountName.value }}</strong>
                <div v-if="binding" class="profile-meta oa-meta">
                    <span>云端修订 {{ binding.baseRevision }}</span><span v-if="binding.lastSyncedAt">{{ dateText(binding.lastSyncedAt) }}</span>
                </div>
            </div>
            <div class="oa-actions oa-actions-end">
                <UiButton v-if="!binding" variant="primary" :disabled="working" @click="run(() => sync.createCurrent())">关联当前账号并自动同步</UiButton>
                <template v-else>
                    <label class="profile-sync-switch">
                        <UiSwitch :model-value="binding.enabled" :disabled="working || binding.status === 'deleted'" aria-label="自动同步"
                            @update:model-value="value => run(() => sync.setEnabled(account.currentAccountId.value, value))" />
                        <span>自动同步</span>
                    </label>
                    <UiButton class="oa-quiet-danger" variant="danger" :disabled="working" @click="run(() => sync.unlink(account.currentAccountId.value))">解除关联</UiButton>
                </template>
            </div>
        </div>
        <UiAlert v-if="error || sync.state.error" tone="error" class="profiles-alert">{{ error || sync.state.error }}</UiAlert>
        <UiAlert v-if="binding?.error && binding.error !== error" tone="error" class="profiles-alert">{{ binding.error }}</UiAlert>
        <div v-if="binding?.status === 'conflict'" class="profile-conflict">
            <div>冲突修订 {{ binding.conflictRevision }}</div>
            <div class="oa-actions">
                <UiButton :disabled="working" @click="run(() => sync.resolveCurrent('remote'))">采用云端</UiButton>
                <UiButton :disabled="working" @click="run(() => sync.resolveCurrent('local'))">保留本机</UiButton>
                <UiButton variant="primary" :disabled="working" @click="run(() => sync.resolveCurrent('copy'))">另存为新云档案</UiButton>
            </div>
        </div>
        <fieldset class="sync-categories">
            <legend>同步内容</legend>
            <div class="sync-options">
                <UiCheckbox v-for="item in categories" :key="item.key" class="sync-category" :model-value="settings[item.key]"
                    :disabled="working" @update:model-value="value => setCategory(item.key, value)"><span>{{ item.label }}</span></UiCheckbox>
            </div>
        </fieldset>
        <div class="profile-archive">
            <UiEmpty v-if="!activeProfiles.length" description="暂无云档案" />
            <div v-else class="oa-list">
                <article v-for="profile in activeProfiles" :key="profile.id" class="oa-list-row cloud-profile">
                    <div class="oa-list-summary">
                        <div class="oa-list-main">
                            <div class="profile-name"><strong>{{ profile.name }}</strong><span class="profile-badge">修订 {{ profile.revision }}</span></div>
                            <div class="oa-meta">{{ dateText(profile.updatedAt) }}</div>
                        </div>
                        <div class="oa-actions oa-actions-end">
                            <UiButton size="small" :disabled="working || !profile.revision" @click="run(() => sync.downloadNew(profile.id))">下载为新本地账号</UiButton>
                            <UiButton size="small" :disabled="working || !profile.revision" @click="loadVersions(profile)">查看修订</UiButton>
                            <UiConfirmPopover title="删除云档案及全部修订和历史？" confirm-text="删除" cancel-text="取消" @confirm="run(() => sync.deleteCloud(profile.id))">
                                <UiButton size="small" class="oa-quiet-danger" variant="danger" :disabled="working">删除云档案</UiButton>
                            </UiConfirmPopover>
                        </div>
                    </div>
                    <div v-if="versions[profile.id]" class="profile-versions">
                        <div v-for="revision in versions[profile.id].items" :key="revision.revision" class="oa-list-summary profile-version">
                            <span class="oa-list-main oa-meta">修订 {{ revision.revision }} · {{ revisionLabel(revision.status) }} · {{ dateText(revision.createdAt) }}</span>
                            <UiButton size="small" :disabled="working" @click="run(() => sync.downloadNew(profile.id, revision.revision))">下载此修订</UiButton>
                        </div>
                        <UiButton v-if="versions[profile.id].nextCursor" size="small" :disabled="working" @click="loadVersions(profile, true)">更多修订</UiButton>
                    </div>
                </article>
            </div>
        </div>
    </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useAccountStore } from '@/store/pinia/account'
import { profileSync as sync } from '@/cloud/profile-sync'
import { cloudApi } from '@/platform/cloud.mjs'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiConfirmPopover from '@/components/ui/UiConfirmPopover.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'

const props = defineProps({ user: { type: Object, required: true }, serviceUrl: { type: String, required: true } })
const account = useAccountStore(), error = ref(''), pending = ref(false), versions = ref({})
const working = computed(() => pending.value || sync.state.busy)
const activeProfiles = computed(() => sync.state.profiles.filter(profile => !profile.deletedAt))
const binding = computed(() => sync.state.bindings.find(item => item.localAccountId === account.currentAccountId.value))
// 类别名称为占位文案，待开发者确认（见 docs/specs/online-accounts/issues/09-sync-settings.md）
const categories = [{ key: 'uid', label: 'UID 数据' }, { key: 'history', label: '历史记录' }, { key: 'artifacts', label: '圣遗物' }, { key: 'characters', label: '角色设置（含 MONA-DSL 手改）' }, { key: 'teams', label: '多人轴和文件' }]
const settings = ref(sync.getSyncSettings())
const setCategory = (key, value) => run(async () => { await sync.setSyncSettings({ ...settings.value, [key]: value }); settings.value = sync.getSyncSettings() })
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
function refresh() { return run(async () => { await sync.refresh(); settings.value = sync.getSyncSettings() }) }
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

<style scoped lang="scss">
.profiles-title, .profile-name, .profile-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
}

.profile-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border: 1px solid var(--oa-line);
    border-radius: 6px;
    background: var(--cx-step);
    color: var(--cx-dim);
    font-size: 12px;
    line-height: 1.5;
    white-space: nowrap;
}

.profile-badge[data-status="synced"] {
    color: var(--cx-down);
    background: color-mix(in srgb, var(--cx-down) 10%, var(--cx-card));
}

.profile-badge:is([data-status="syncing"], [data-status="waiting"], [data-status="running"], [data-status="dirty"]) {
    color: var(--cx-gold);
    background: color-mix(in srgb, var(--cx-gold) 12%, var(--cx-card));
}

.profile-badge:is([data-status="error"], [data-status="conflict"], [data-status="deleted"]) {
    color: var(--cx-up);
    background: color-mix(in srgb, var(--cx-up) 10%, var(--cx-card));
}

.profile-current {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 14px;
    padding: 12px;
    border: 1px solid var(--oa-line);
    border-radius: 9px;
    background: color-mix(in srgb, var(--cx-step) 55%, var(--cx-card));
}

.profile-meta { margin-top: 3px; }
.profiles-alert { margin-top: 10px; color: var(--cx-up); }

.profile-sync-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    font-size: 13px;
    white-space: nowrap;
}

.sync-categories {
    min-width: 0;
    margin: 16px 0 0;
    padding: 6px 0 0;
    border: 0;

    legend { padding: 0; font-size: 13px; font-weight: 700; }
}

.sync-options {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
}

.sync-category {
    justify-content: space-between;
    min-height: 38px;
    padding: 6px 10px;
    border: 1px solid var(--oa-line);
    border-radius: 7px;

    :deep([data-slot="checkbox"]) { order: 1; }
}

.profile-conflict {
    display: grid;
    gap: 8px;
    margin-top: 12px;
    font-size: 14px;
}

.profile-archive {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--oa-line);
}

.profile-name { margin-bottom: 3px; }

.profile-versions {
    margin-top: 10px;
    border-top: 1px solid var(--oa-line);
}

.profile-version { padding: 8px 0; }

@media (min-width: 640px) {
    .sync-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }

    .oa-panel-head > .oa-actions, .profile-current > .oa-actions {
        margin-inline-start: auto;
    }
}

@media (max-width: 639px) {
    .cloud-profiles .oa-actions-end {
        justify-content: flex-start;
    }
}
</style>
