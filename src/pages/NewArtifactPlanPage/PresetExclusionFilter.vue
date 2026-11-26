<template>
    <el-button @click="openFilter">保护圣遗物</el-button>
    <el-dialog v-model="open" append-to-body destroy-on-close custom-class="cx-scope preset-protection-dialog"
        modal-class="preset-protection-overlay"
        title="保护圣遗物">
        <div class="filter-tools">
            <el-input v-model="query" placeholder="搜索角色或预设" aria-label="搜索角色或预设" clearable />
            <el-radio-group v-model="source" aria-label="预设来源">
                <el-radio-button label="all">全部</el-radio-button>
                <el-radio-button label="game">游戏内</el-radio-button>
                <el-radio-button label="custom">自定义</el-radio-button>
            </el-radio-group>
        </div>
        <div class="selection-tools">
            <span>匹配 {{ visibleCount }} 套</span>
            <div class="selection-actions">
                <el-button text :disabled="!visibleCount" @click="selectVisible(true)">全选当前结果</el-button>
                <el-button text :disabled="!visibleCount" @click="selectVisible(false)">取消当前结果</el-button>
            </div>
        </div>
        <div class="role-list" tabindex="0" role="region" aria-label="可保护的角色预设">
            <section v-for="role in visible" :key="role.key" class="role-group">
                <div class="role-heading">
                    <img :src="role.avatar" alt="" loading="lazy" />
                    <strong>{{ role.label }}</strong>
                    <small v-if="role.showUid">UID {{ role.uid }}</small>
                </div>
                <label v-for="choice in role.choices" :key="choice.key" class="preset-row">
                    <input type="checkbox" :checked="draft[role.key]?.includes(choice.key)"
                        :aria-label="[role.label, role.showUid && `UID ${role.uid}`, choice.game ? '游戏内' : choice.name].filter(Boolean).join('，')"
                        @change="setSelected(role.key, choice.key, $event.target.checked)" />
                    <span class="preset-label">
                        <span>{{ choice.game ? '游戏内' : choice.name }}</span>
                        <small v-if="!choice.game">自定义</small>
                    </span>
                    <span v-if="draft[role.key]?.includes(choice.key)" class="protected-state" aria-hidden="true">已保护</span>
                </label>
            </section>
            <el-empty v-if="!visible.length" description="没有匹配的预设" :image-size="48" />
        </div>
        <template #footer>
            <div class="protection-footer">
                <span aria-live="polite">已保护 <strong>{{ selectedCount }}</strong> 套</span>
                <div class="footer-actions">
                    <el-button @click="open = false">取消</el-button>
                    <el-button type="primary" @click="apply">确定</el-button>
                </div>
            </div>
        </template>
    </el-dialog>
</template>
<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ groups: { type: Array, required: true }, modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const open = ref(false), query = ref(''), source = ref('all'), draft = ref({})
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
<style>
.preset-protection-overlay .el-overlay-dialog { display: grid; place-items: center; }
.preset-protection-dialog.el-dialog {
    display: flex;
    flex-direction: column;
    width: min(720px, calc(100vw - 48px));
    height: min(740px, calc(100dvh - 64px));
    margin: 0;
    border-radius: 16px;
}
.preset-protection-dialog .el-dialog__header { padding: 22px 24px 0; margin-right: 0; }
.preset-protection-dialog .el-dialog__title { font-size: 20px; font-weight: 650; }
.preset-protection-dialog .el-dialog__body { display: flex; flex: 1; flex-direction: column; min-height: 0; padding: 16px 24px 0; overflow: hidden; }
.preset-protection-dialog .el-dialog__footer { padding: 0 24px 18px; }
@media (max-width: 600px) {
    .preset-protection-dialog.el-dialog {
        width: calc(100vw - 16px);
        height: calc(100dvh - 24px);
    }
    .preset-protection-dialog .el-dialog__header { padding: 18px 16px 0; }
    .preset-protection-dialog .el-dialog__body { padding-inline: 16px; }
    .preset-protection-dialog .el-dialog__footer { padding: 0 16px 12px; }
}
</style>
<style scoped>
.filter-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }
.filter-tools :deep(.el-input__wrapper), .filter-tools :deep(.el-radio-button__inner) { min-height: 38px; box-sizing: border-box; }
.selection-tools, .protection-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.selection-tools { margin: 7px 0; color: var(--cx-dim); font-size: 13px; }
.selection-actions, .footer-actions { display: flex; gap: 8px; }
.selection-actions .el-button { min-height: 36px; padding-inline: 8px; color: var(--cx-dim); }
.selection-actions .el-button:enabled:hover { color: var(--cx-gold); }
.selection-actions .el-button + .el-button, .footer-actions .el-button + .el-button { margin-left: 0; }
.role-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 2px 4px 14px 2px; }
.role-list:focus-visible { outline: 1px solid var(--cx-gold); outline-offset: -1px; }
.role-group { display: grid; gap: 2px; margin-bottom: 8px; padding: 4px; border-radius: 10px; background: var(--cx-step); }
.role-heading, .preset-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.role-heading { padding: 4px 8px; color: var(--cx-letter); }
.role-heading img { flex: none; width: 28px; height: 28px; object-fit: cover; border-radius: 50%; background: var(--cx-step-2); }
.preset-row { box-sizing: border-box; min-height: 44px; margin-left: 8px; padding: 5px 9px; border: 1px solid transparent; border-radius: 7px; color: var(--cx-letter); cursor: pointer; }
.preset-row:hover { background: var(--cx-step-2); }
.preset-row:has(input:checked) { border-color: var(--cx-gold); background: var(--cx-card); }
.preset-row:focus-within { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.preset-label { display: flex; flex: 1; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; overflow-wrap: anywhere; }
.preset-label small, .role-heading small { color: var(--cx-dim); font-size: 12px; }
.protected-state { flex: none; color: var(--cx-gold); font-size: 12px; }
.preset-row input { flex: none; width: 17px; height: 17px; margin: 0; accent-color: var(--cx-gold); cursor: pointer; }
.protection-footer { padding-top: 14px; border-top: 1px solid var(--cx-step-2); color: var(--cx-dim); font-size: 14px; text-align: left; }
.protection-footer strong { color: var(--cx-gold); }
.footer-actions .el-button { min-width: 76px; min-height: 40px; }
@media (max-width: 600px) {
    .filter-tools { grid-template-columns: minmax(0, 1fr); gap: 8px; }
    .filter-tools :deep(.el-radio-button) { flex: 1; }
    .filter-tools :deep(.el-radio-button__inner) { width: 100%; }
    .selection-actions { gap: 0; }
    .selection-actions .el-button { min-height: 42px; }
    .footer-actions .el-button { min-width: 64px; min-height: 44px; }
}
</style>
