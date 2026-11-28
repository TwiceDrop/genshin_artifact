<template>
    <UiButton size="small" variant="primary" aria-haspopup="dialog" @click="openFilter">保护圣遗物</UiButton>
    <UiDialog v-model="open" width="min(720px, calc(100vw - 24px))" title="保护圣遗物">
        <template #toolbar>
            <div class="filter-tools">
                <UiSearchInput v-model="query" placeholder="搜索角色或预设" />
                <UiSegmentedControl v-model="source" label="预设来源" :options="sources" />
            </div>
            <div class="selection-tools">
                <span>匹配 {{ visibleCount }} 套</span>
                <div class="selection-actions">
                    <UiButton size="small" :disabled="!visibleCount" @click="selectVisible(true)">全选当前结果</UiButton>
                    <UiButton size="small" :disabled="!visibleCount" @click="selectVisible(false)">取消当前结果</UiButton>
                </div>
            </div>
        </template>
        <div class="role-list" role="region" aria-label="可保护的角色预设">
            <section v-for="role in visible" :key="role.key" class="role-group">
                <div class="role-heading">
                    <img :src="role.avatar" alt="" loading="lazy" />
                    <strong>{{ role.label }}</strong>
                    <small v-if="role.showUid">UID {{ role.uid }}</small>
                </div>
                <UiCheckbox v-for="choice in role.choices" :key="choice.key" class="preset-row"
                    :model-value="draft[role.key]?.includes(choice.key) === true"
                    :label="[role.label, role.showUid && `UID ${role.uid}`, choice.game ? '游戏内' : choice.name].filter(Boolean).join('，')"
                    @update:model-value="setSelected(role.key, choice.key, $event)">
                    <span class="preset-label">
                        <span>{{ choice.game ? '游戏内' : choice.name }}</span>
                        <small v-if="!choice.game">自定义</small>
                    </span>
                    <span v-if="draft[role.key]?.includes(choice.key)" class="protected-state" aria-hidden="true">已保护</span>
                </UiCheckbox>
            </section>
            <p v-if="!visible.length" class="protection-empty">没有匹配的预设</p>
        </div>
        <template #footer>
            <div class="protection-footer">
                <span aria-live="polite">已保护 <strong>{{ selectedCount }}</strong> 套</span>
                <div class="footer-actions">
                    <UiButton @click="open = false">取消</UiButton>
                    <UiButton variant="primary" @click="apply">确定</UiButton>
                </div>
            </div>
        </template>
    </UiDialog>
</template>
<script setup>
import { computed, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'

const props = defineProps({ groups: { type: Array, required: true }, modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const open = ref(false), query = ref(''), source = ref('all'), draft = ref({})
const sources = [{ value: 'all', label: '全部' }, { value: 'game', label: '游戏内' }, { value: 'custom', label: '自定义' }]
const labelCounts = computed(() => {
    const counts = new Map()
    for (const role of props.groups) counts.set(role.label, (counts.get(role.label) || 0) + 1)
    return counts
})
const visible = computed(() => {
    const needle = query.value.trim().toLowerCase()
    return props.groups.flatMap(role => {
        const roleMatches = role.label.toLowerCase().includes(needle) || String(role.uid || '').includes(needle)
        const choices = role.choices.filter(choice =>
            (source.value === 'all' || choice.game === (source.value === 'game')) &&
            (roleMatches || choice.name.toLowerCase().includes(needle)))
        return choices.length ? [{ ...role, choices, showUid: !!role.uid && labelCounts.value.get(role.label) > 1 }] : []
    })
})
const selectedCount = computed(() => props.groups.reduce((sum, role) =>
    sum + role.choices.filter(choice => draft.value[role.key]?.includes(choice.key)).length, 0))
const visibleCount = computed(() => visible.value.reduce((sum, role) => sum + role.choices.length, 0))
function openFilter() {
    const next = { ...props.modelValue }
    for (const role of props.groups) {
        const keys = role.choices.map(choice => choice.key).filter(key => next[role.key]?.includes(key))
        if (keys.length) next[role.key] = keys
        else delete next[role.key]
    }
    draft.value = next
    query.value = ''
    source.value = 'all'
    open.value = true
}
function setSelected(role, key, checked) {
    const keys = new Set(draft.value[role])
    if (checked) keys.add(key)
    else keys.delete(key)
    if (keys.size) draft.value[role] = [...keys]
    else delete draft.value[role]
}
function selectVisible(checked) {
    for (const role of visible.value) {
        for (const choice of role.choices) setSelected(role.key, choice.key, checked)
    }
}
function apply() {
    emit('update:modelValue', draft.value)
    open.value = false
}
</script>
<style scoped>
.filter-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }
.selection-tools, .protection-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.selection-tools { margin: 7px 0; color: var(--cx-dim); font-size: 13px; }
.selection-actions, .footer-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.role-list { min-height: 0; padding-bottom: 8px; }
.protection-empty { text-align: center; color: var(--cx-dim); font-size: 13px; }
.role-group { display: grid; gap: 2px; margin-bottom: 8px; padding: 4px; border-radius: 10px; background: var(--cx-step); }
.role-heading, .preset-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.role-heading { padding: 4px 8px; color: var(--cx-letter); }
.role-heading img { flex: none; width: 28px; height: 28px; object-fit: cover; border-radius: 50%; background: var(--cx-step-2); }
.preset-row { box-sizing: border-box; min-height: 44px; margin-left: 8px; padding: 5px 9px; border: 1px solid transparent; border-radius: 7px; color: var(--cx-letter); cursor: pointer; }
.preset-row:hover { background: var(--cx-step-2); }
.preset-row:has([data-state="checked"]) { border-color: var(--cx-gold); background: var(--cx-card); }
.preset-row:focus-within { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.preset-label { display: flex; flex: 1; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; overflow-wrap: anywhere; }
.preset-label small, .role-heading small { color: var(--cx-dim); font-size: 12px; }
.protected-state { flex: none; color: var(--cx-gold); font-size: 12px; }
.protection-footer { padding-top: 14px; border-top: 1px solid var(--cx-step-2); color: var(--cx-dim); font-size: 14px; text-align: left; }
.protection-footer strong { color: var(--cx-gold); }
@media (max-width: 600px) {
    .filter-tools { grid-template-columns: minmax(0, 1fr); gap: 8px; }
    .filter-tools :deep(.ui-segmented > button) { flex: 1; }
    .footer-actions > button { min-width: 64px; min-height: 38px; }
}
</style>
