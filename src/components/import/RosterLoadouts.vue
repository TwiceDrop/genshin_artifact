<template>
    <UiPopover v-model:open="open" label="预设" side="top">
        <template #trigger><UiButton size="small" :title="triggerLabel"><span class="trigger-label">{{ triggerLabel }}</span><span aria-hidden="true">⌃</span></UiButton></template>
        <div class="loadout">
            <header><strong>预设</strong><small>{{ savedOptions.length }} 套</small></header>
            <UiSelect label="切换预设" :model-value="selection" :options="options" @update:model-value="choose" />
            <form v-if="naming" @submit.prevent="save">
                <input v-model.trim="name" ref="nameInput" aria-label="预设名称" placeholder="预设名称" />
                <UiButton type="submit" size="small" :disabled="!canSaveName">保存</UiButton>
            </form>
            <template v-else>
                <UiButton size="small" :disabled="!entry.preset && !hasDraft" @click="startNaming('create')">＋ 新建预设</UiButton>
                <UiButton v-if="selectedSaved" size="small" class="rename-action" @click="startNaming('rename')">
                    <IconEpEdit aria-hidden="true" />改名
                </UiButton>
            </template>
            <UiButton v-if="entry.preset" size="small" @click="share">分享角色预设</UiButton>
            <div v-if="savedOptions.length" class="delete-action">
                <UiButton size="small" variant="danger" @click="startDelete">
                    <IconEpDelete aria-hidden="true" />{{ selectedSaved ? '删除这套预设' : '删除预设' }}
                </UiButton>
            </div>
            <small v-if="error" role="alert">{{ error }}</small>
        </div>
    </UiPopover>
    <UiDialog v-model="confirmOpen" title="切换预设" width="400px">
        <p>将从{{ conflicts.join('、') }}身上换下这套预设使用的圣遗物。</p>
        <template #footer><UiButton @click="confirmOpen = false">取消</UiButton>
            <UiButton class="accept" variant="primary" @click="apply">确认换装</UiButton></template>
    </UiDialog>
    <UiDialog v-model="deleteOpen" title="删除预设" width="400px">
        <UiSelect v-if="pickDeleteTarget" v-model="deleteTarget" label="要删除的预设" :options="savedOptions" />
        <p>删除{{ entry.label }}的「{{ savedOptions.find(o => o.value === deleteTarget)?.label }}」预设？</p>
        <template #footer>
            <UiButton @click="deleteOpen = false">取消</UiButton>
            <UiButton class="accept" variant="danger" @click="deleteConfig">确认删除</UiButton>
        </template>
    </UiDialog>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import UiPopover from '@/components/ui/UiPopover.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import IconEpDelete from '~icons/ep/delete'
import IconEpEdit from '~icons/ep/edit'
import { useArtifactStore } from '@/store/pinia/artifact'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { POSITIONS } from '@/import/miyoushe.mjs'
import { gameRosterPresetLabel, presetSource } from '@/utils/preset-workflow.mjs'
import { equipRosterArtifact, retainRosterGear, rosterArtifactOwners } from '@/import/roster-equipment.mjs'
import { useRosterLoadout } from '@/composables/roster-loadout'
import { updatePresetExclusion } from '@/algorithms/artifact-ownership.mjs'

const props = defineProps(['entry', 'baseEntry', 'characterPresets'])
const emit = defineEmits(['select-preset', 'create-preset', 'share'])
const { data } = useMiyousheStore(), presets = usePresetStore(), inventory = useArtifactStore()
const { row, state, configs, worn, hasDraft, selectedConfig } = useRosterLoadout(() => props.baseEntry)
const roleGroup = computed(() => data.value.rosterCharacterPresets?.[props.baseEntry.key])
const equipmentLabel = computed(() => {
    const { preset, raw, uid } = props.baseEntry
    const imported = preset ? presetSource(preset) === 'game' : !!raw
    if (imported && uid) return gameRosterPresetLabel(uid)
    return row.value?.manual ? props.baseEntry.presetName : '当前装备'
})
const savedOptions = computed(() => [...props.characterPresets.map(name => ({ value: 'role:' + name, label: name })),
    ...configs.value.map(c => ({ value: 'saved:' + c.name, label: c.name }))])
const options = computed(() => [{ value: 'current', label: equipmentLabel.value },
    ...(hasDraft.value ? [{ value: 'draft', label: '未保存的搭配' }] : []),
    ...savedOptions.value])
const open = ref(false), naming = ref(''), name = ref(''), nameInput = ref(null), error = ref('')
const confirmOpen = ref(false), requested = ref('current')
const deleteOpen = ref(false), deleteTarget = ref(''), pickDeleteTarget = ref(false)
const selection = computed(() => {
    if (props.entry.characterVariant) return 'role:' + props.entry.presetName
    if (hasDraft.value) return 'draft'
    return selectedConfig.value ? 'saved:' + selectedConfig.value.name : 'current'
})
const selectedSaved = computed(() => savedOptions.value.find(o => o.value === selection.value))
const triggerLabel = computed(() => '预设-' + options.value.find(o => o.value === selection.value).label)
const canSaveName = computed(() => !!name.value && !presets.getPreset(name.value) && !configs.value.some(c => c.name === name.value))
watch([open, selection], () => { naming.value = '' })
function share() {
    open.value = false
    // The built-in game preset label contains the account UID.
    emit('share', selectedSaved.value?.label || props.entry.label+'预设')
}
function currentIds() {
    return retainRosterGear(data.value, presets.presets.value, inventory, row.value, props.baseEntry.equipped)
}
function startDelete() {
    pickDeleteTarget.value = !selectedSaved.value && savedOptions.value.length > 1
    deleteTarget.value = (selectedSaved.value || savedOptions.value[0]).value
    open.value = false
    deleteOpen.value = true
}
function deleteConfig() {
    updatePresetExclusion(data.value, row.value.key, deleteTarget.value)
    if (deleteTarget.value.startsWith('role:')) {
        const name = deleteTarget.value.slice(5)
        if (roleGroup.value.active === name) emit('select-preset', null)
        roleGroup.value.names = roleGroup.value.names.filter(n => n !== name)
        if (!data.value.entries.some(row => row.presetName === name) &&
            !Object.values(data.value.rosterCharacterPresets).some(group => group.names.includes(name))) presets.deletePreset(name)
        deleteOpen.value = false
        return
    }
    const loadouts = state.value
    const name = deleteTarget.value.slice(6)
    loadouts.configs = loadouts.configs.filter(config => config.name !== name)
    if (loadouts.active === name) {
        loadouts.active = null
        if (!loadouts.draft) loadouts.original = null
    }
    deleteOpen.value = false
}
function save() {
    if (!canSaveName.value) return
    if (naming.value === 'create' && props.entry.preset) {
        const wasDraft = selection.value === 'draft'
        emit('create-preset', name.value)
        if (wasDraft) state.value.draft = null
    } else if (naming.value === 'rename' && props.entry.characterVariant) {
        const old = props.entry.presetName
        for (const key of Object.keys(data.value.excludedArtifactPresets || {})) {
            updatePresetExclusion(data.value, key, 'role:' + old, 'role:' + name.value)
        }
        presets.createCustom(name.value, props.entry.preset)
        for (const group of Object.values(data.value.rosterCharacterPresets)) {
            group.names = group.names.map(n => n === old ? name.value : n)
            if (group.active === old) group.active = name.value
        }
        for (const entry of data.value.entries) if (entry.presetName === old) entry.presetName = name.value
        emit('select-preset', name.value)
        presets.deletePreset(old)
    } else if (naming.value === 'rename') {
        updatePresetExclusion(data.value, row.value.key, 'saved:' + selectedConfig.value.name, 'saved:' + name.value)
        selectedConfig.value.name = name.value
        state.value.active = name.value
    } else {
        state.value.configs.push({ name: name.value, ids: [...worn.value] })
        state.value.draft = null
        state.value.active = name.value
    }
    naming.value = ''
}
async function startNaming(mode) {
    naming.value = mode
    name.value = mode === 'rename' ? selectedSaved.value.label : ''
    await nextTick()
    nameInput.value?.focus()
    nameInput.value?.select()
}
const requestedIds = computed(() => requested.value === 'current' ? state.value?.original
    : configs.value.find(c => 'saved:' + c.name === requested.value)?.ids)
const conflicts = computed(() => {
    const owners = new Map()
    if (requested.value !== 'current') return []
    requestedIds.value?.forEach((id, i) => {
        if (id < 0) return
        for (const owner of rosterArtifactOwners(data.value.entries, presets.presets.value, row.value.uid, POSITIONS[i]).get(id) || [])
            if (owner.key !== row.value.key) owners.set(owner.key, owner.label)
    })
    return [...owners.values()]
})
function choose(value) {
    if (value === selection.value) return
    if (value.startsWith('role:')) {
        emit('select-preset', value.slice(5))
        return
    }
    requested.value = value
    error.value = ''
    if (conflicts.value.length) confirmOpen.value = true
    else apply()
}
function apply() {
    confirmOpen.value = false
    const ids = requestedIds.value
    if (requested.value === 'draft' || (requested.value === 'current' && !ids)) {
        if (requested.value === 'current' && state.value) {
            state.value.active = null
            state.value.draft = null
        }
        if (props.entry.characterVariant) emit('select-preset', null)
        return
    }
    const pieces = ids.map(id => inventory.artifacts.value.get(id))
    if (ids.some((id, i) => id >= 0 && pieces[i]?.position !== POSITIONS[i])) {
        error.value = '预设中的圣遗物已从仓库移除。'
        return
    }
    const original = state.value.original ?? currentIds()
    if (requested.value === 'current' && !ids.every((id, i) => id === worn.value[i])) {
        const equipped = POSITIONS.map(slot => props.baseEntry.equipped.find(piece => piece.position === slot))
        for (const [i, position] of POSITIONS.entries()) {
            equipRosterArtifact(data.value, presets, row.value, position, pieces[i], equipped)
            equipped[i] = pieces[i]
        }
    }
    state.value.active = requested.value === 'current' ? null : requested.value.slice(6)
    state.value.original = state.value.active ? original : null
    state.value.draft = null
    if (props.entry.characterVariant) emit('select-preset', null)
    naming.value = ''
}
</script>
<style scoped>
.loadout { display: grid; gap: 10px; }
.trigger-label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.loadout header, .loadout form { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.loadout small { color: var(--cx-dim); }
.delete-action { border-top: 1px solid var(--cx-step-2); padding-top: 8px; }
.delete-action button { border-color: transparent; background: transparent; }
.rename-action { justify-self: start; border-color: transparent; background: transparent; }
.loadout input { min-width: 0; flex: 1; font: inherit; color: var(--cx-letter); background: var(--cx-step); border: 1px solid var(--cx-step-2); border-radius: 8px; padding: 7px; }
.accept { margin-left: 8px; }
</style>
