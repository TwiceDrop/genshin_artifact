<template>
    <section class="mys-character-picker">
        <section v-if="roster" class="cx-panel" aria-labelledby="roster-heading">
            <header class="cx-panel-heading cx-panel-heading--page">
                <h2 id="roster-heading" class="cx-panel-title">{{ t("misc.character") }}</h2>
                <slot name="heading-actions" />
            </header>
            <div class="roster-body cx-panel-body">
                <div ref="strip" class="roster-avatars" role="group" aria-label="已保存的角色"
                    :class="{ 'is-dragging': dragging }" @pointerdown="startDrag" @pointermove="moveDockPointer"
                    @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag" @pointerleave="leaveDock"
                    @click.capture="ignoreDragClick" @dragstart.prevent @scroll.passive="positionDock"
                    @wheel.passive="stopCoasting" @keydown="stopCoasting">
                    <button v-for="entry in rosterEntries" :key="entry.key" type="button" class="roster-avatar"
                        :title="entry.label" :aria-label="entry.label" :aria-pressed="selectedKey === entry.key"
                        :tabindex="selectedKey === entry.key ? 0 : -1"
                        :disabled="disabled" @click="choose(entry)">
                        <UiAvatar class="roster-face" :src="entry.avatar">
                            {{ entry.label?.slice(0, 2) }}
                        </UiAvatar>
                    </button>
                </div>
                <div class="roster-actions">
                    <UiButton ref="browseTrigger" aria-haspopup="dialog" @click="allOpen = true">全部角色 · {{ rosterEntries.length }}</UiButton>
                    <slot name="actions" :open-manual="() => manualOpen = true" />
                </div>
            </div>
        </section>
        <CharacterRosterDetail v-if="roster && detailEntry" :key="detailEntry.key" :entry="detailEntry" :base-entry="selectedEntry" :roster="uidEntries"
            :character-presets="characterPresets" @select-preset="selectCharacterPreset" @created-preset="activateNewPreset"
            @remove="requestRemoval([selectedEntry.key])" />
        <UiDialog v-if="roster" v-model="manualOpen" title="手动添加角色" width="min(1000px, 94vw)">
            <DefaultCharacterPicker v-if="manualOpen" :added="addedNames" @select="addManual" />
        </UiDialog>
        <component :is="roster ? UiDialog : 'div'" v-bind="roster ? dialogProps : {}"
            @update:model-value="allOpen = $event">
            <div class="saved-character-grid" :class="{ 'roster-dialog-grid': roster }">
                <div v-if="uidGroups.length > 1" class="character-uid-list" aria-label="已保存角色的 UID">
                    <button v-for="group in uidGroups" :key="group.uid" type="button" class="character-uid"
                        :class="{ active: selectedUid === group.uid }" :aria-pressed="selectedUid === group.uid"
                        :disabled="disabled" @click="selectUid(group.uid)">
                        <strong>{{ group.uid ? group.nickname + ' · UID ' + group.uid : '本地角色' }}</strong>
                        <span>{{ group.regionName }} · {{ group.count }} 名角色</span>
                    </button>
                </div>
                <p v-if="uidGroups.length > 1 && selectedUid" class="character-uid-summary">UID {{ selectedUid }} · 已保存 {{ uidEntries.length }} 名角色</p>
                <div v-if="roster" class="manage-characters">
                    <input v-model="search" type="search" aria-label="搜索角色名" placeholder="搜索角色名" />
                    <UiButton size="small" @click="manage = !manage; checked = []">{{ manage ? '完成' : '管理' }}</UiButton>
                    <template v-if="manage">
                        <UiButton size="small" :disabled="!visibleEntries.length" @click="toggleVisible">{{ allChecked ? '取消全选' : '全选' }}</UiButton>
                        <UiButton size="small" variant="danger" :disabled="!checked.length" @click="requestRemoval(checked)">删除 {{ checked.length }}</UiButton>
                    </template>
                </div>
                <CharacterElementFilter v-model="element" />
                <div class="character-picker-list">
                    <button v-for="entry in visibleEntries" :key="entry.key" type="button" class="character-picker-row"
                        :disabled="disabled || (!roster && !!entry.error)" :aria-label="`选择${entry.label}，${entry.uid}`"
                        :aria-pressed="manage ? checked.includes(entry.key) : roster ? entry.key === selectedKey : undefined" @click="manage ? toggleEntry(entry.key) : choose(entry)">
                        <span v-if="manage" class="manage-check" aria-hidden="true">{{ checked.includes(entry.key) ? '✓' : '' }}</span>
                        <span class="character-art-frame"><CharacterPortrait v-if="entry.splash" thumbnail :character-name="entry.characterName" :splash="entry.splash" :avatar="entry.avatar" :alt="`${entry.label}立绘`" loading="lazy" /></span>
                        <span class="character-body">
                            <span class="character-identity-line"><strong>{{ entry.label }}</strong><span class="character-element"><img v-if="elementIcons[entry.element]" :src="elementIcons[entry.element]" :alt="`${entry.elementLabel}元素`" />{{ entry.elementLabel }}</span></span>
                            <span class="character-tags"><b>{{ entry.constellation }}命</b><span>{{ entry.weaponType }}</span></span>
                            <small v-if="multipleUids">UID {{ entry.uid }}</small>
                            <small v-if="entry.error" class="character-warning">{{ entry.error }}</small>
                            <small v-else-if="entry.warning" class="character-warning">{{ entry.warning }}</small>
                            <span class="character-equipment">
                                <span>{{ entry.weapon }}</span>
                                <span>圣遗物套装：{{ entry.set }}</span>
                                <span>{{ entry.talents }}</span>
                                <span v-if="!roster && entry.choices.length" class="preset-names"><span :title="entry.presetNames">预设：{{ entry.presetNames }}</span><small>共{{ entry.choices.length }}套</small></span>
                            </span>
                        </span>
                    </button>
                    <p v-if="!visibleEntries.length" class="character-picker-empty">{{ entries.length ? '暂无该元素的已导入角色' : '暂无已导入角色，请先同步账号或恢复角色快照' }}</p>
                </div>
            </div>
        </component>
        <UiDialog v-if="!roster && shadcn" :model-value="!!choosingFor" @update:model-value="open => { if (!open) choosingFor = null }"
            title="使用哪一套预设计算？" width="min(720px, 94vw)">
            <CharacterPresetOptions v-if="choosingFor" shadcn :entry="choosingFor" @select="applyChoice" />
        </UiDialog>
        <el-dialog v-else-if="!roster" :model-value="!!choosingFor" @update:model-value="open => { if (!open) choosingFor = null }"
            title="使用哪一套预设计算？" width="min(720px, 94vw)" custom-class="cx-scope viewport-dialog" append-to-body destroy-on-close>
            <CharacterPresetOptions v-if="choosingFor" :entry="choosingFor" @select="applyChoice" />
        </el-dialog>
        <UiDialog v-if="roster" v-model="confirmOpen" title="删除角色" width="400px">
            <p>删除{{ removal.length === 1 ? '「' + removal[0].label + '」' : '选中的 ' + removal.length + ' 名角色' }}？已穿戴的圣遗物会留在该 UID 的仓库中。</p>
            <p>{{ removal.length === 1 ? '该角色' : '所选角色' }}的所有预设都会删除。</p>
            <template #footer><UiButton @click="confirmOpen = false">取消</UiButton>
                <UiButton class="confirm-delete" variant="danger" @click="confirmRemoval">确认删除</UiButton></template>
        </UiDialog>
    </section>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, onDeactivated } from 'vue'
import CharacterRosterDetail from './CharacterRosterDetail.vue'
import CharacterElementFilter from '@/components/select/CharacterElementFilter.vue'
import DefaultCharacterPicker from '@/components/select/DefaultCharacterPicker.vue'
import CharacterPresetOptions from './CharacterPresetOptions.vue'
import { characterPresetChoices } from '@/import/role-presets'
import { addManualRosterCharacter } from '@/import/manual-roster-character'
import UiDialog from '@/components/ui/UiDialog.vue'
import { useI18n } from '@/i18n/i18n'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { useArtifactStore } from '@/store/pinia/artifact'
import { removeRosterCharacters } from '@/import/roster-equipment.mjs'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
import { characterSummary, isPickerCharacter } from '@/import/character-summary.mjs'
import elementIcons from "@/assets/element-icons"
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
const props = defineProps({ disabled: Boolean, roster: Boolean, shadcn: Boolean })
const emit = defineEmits(['apply'])
const { t } = useI18n()
const element = ref('all')
const store = useMiyousheStore(), presets = usePresetStore(), inventory = useArtifactStore()
const { uidGroups, selectedUid } = store
function selectUid(uid) { selectedUid.value = uid; element.value = 'all' }
const entries = computed(() => store.data.value.entries.map(entry => {
    const raw = store.data.value.snapshots[entry.uid]?.characters.find(c => `${entry.uid}:${c.base?.id}:${c.base?.element || ''}` === entry.key)
    const summary = characterSummary(entry, { preset: presets.getPreset(entry.presetName)?.item, raw, characters, weapons, artifacts, locale, inventory: inventory.artifacts.value })
    if (props.roster) return summary
    const choices = characterPresetChoices(entry, store.data.value, presets.presets.value)
    return { ...summary, choices, presetNames: choices.map(choice => choice.name).join('、') }
}))
const multipleUids = computed(() => new Set(entries.value.map(e => e.uid)).size > 1)
const uidEntries = computed(() => entries.value.filter(e => String(e.uid) === selectedUid.value))
const rosterEntries = computed(() => uidEntries.value.filter(e => isPickerCharacter(e.characterName, e.label)))
const addedNames = computed(() => new Set(rosterEntries.value.map(entry => entry.characterName)))
const manualOpen = ref(false)
function addManual(name) {
    if (!addedNames.value.has(name)) chosenKey.value = addManualRosterCharacter(name, store, presets)
    manualOpen.value = false
}
const search = ref(''), manage = ref(false), checked = ref([]), removal = ref([]), confirmOpen = ref(false)
const visibleEntries = computed(() => rosterEntries.value.filter(e => (element.value === 'all' || e.element === element.value)
    && e.label.includes(search.value.trim())))
const allChecked = computed(() => visibleEntries.value.length > 0 && visibleEntries.value.every(e => checked.value.includes(e.key)))
function toggleEntry(key) {
    checked.value = checked.value.includes(key) ? checked.value.filter(k => k !== key) : [...checked.value, key]
}
function toggleVisible() {
    const keys = visibleEntries.value.map(e => e.key)
    checked.value = allChecked.value ? checked.value.filter(k => !keys.includes(k)) : [...new Set([...checked.value, ...keys])]
}
function requestRemoval(keys) {
    removal.value = uidEntries.value.filter(entry => keys.includes(entry.key))
    confirmOpen.value = removal.value.length > 0
}
function confirmRemoval() {
    if (removal.value.length) removeRosterCharacters(store.data.value, presets, inventory, removal.value[0].uid, removal.value.map(e => e.key))
    checked.value = []
    confirmOpen.value = false
}
const browseTrigger = ref(null)
const allOpen = ref(false), strip = ref(null), chosenKey = ref('')
const dragging = ref(false)
let coastFrame = 0
function stopCoasting() {
    cancelAnimationFrame(coastFrame)
    coastFrame = 0
}
function coast(rail, speed) {
    if (Math.abs(speed) < 0.1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const initialSpeed = Math.max(-2, Math.min(2, speed))
    const start = performance.now(), origin = rail.scrollLeft
    const decayTime = 180 // milliseconds; integrate velocity from release to avoid rounding each step
    function advance(now) {
        const decay = Math.exp(-(now - start) / decayTime)
        const next = origin + initialSpeed * decayTime * (1 - decay)
        rail.scrollLeft = next
        if (next <= 0 || next >= rail.scrollWidth - rail.clientWidth || Math.abs(initialSpeed) * decay < 0.02) {
            stopCoasting()
        } else {
            coastFrame = requestAnimationFrame(advance)
        }
    }
    coastFrame = requestAnimationFrame(advance)
}
let dragStart = null, suppressClick = false
const dockMotion = window.matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)')
let pointerX = null, followX = null, strength = 0, dockFrame = 0, previousFrame = 0
function positionDock() {
    if (!dockFrame && dockMotion.matches && (pointerX !== null || strength > 0)) {
        dockFrame = requestAnimationFrame(paintDock)
    }
}
function paintDock(now) {
    dockFrame = 0
    const rail = strip.value
    if (!rail?.firstElementChild || !dockMotion.matches) return resetDock()
    const frames = previousFrame ? Math.min(now - previousFrame, 48) / (1000 / 60) : 1
    previousFrame = now
    const target = pointerX === null ? 0 : 1
    if (target) {
        if (followX === null || strength < .02) followX = pointerX
        followX += (pointerX - followX) * (1 - .65 ** frames)
        if (Math.abs(pointerX - followX) < .1) followX = pointerX
    }
    strength += (target - strength) * (1 - .75 ** frames)
    if (Math.abs(target - strength) < .002) strength = target
    if (!strength) return resetDock()

    // Fixed hit areas keep the cursor stable as the portraits grow and make room.
    const first = rail.firstElementChild.getBoundingClientRect()
    const faceWidth = rail.firstElementChild.firstElementChild.offsetWidth
    const buttons = rail.children, scales = []
    let leftGrowth = 0, totalGrowth = 0
    for (let i = 0; i < buttons.length; i++) {
        const left = first.left + i * first.width
        const distance = Math.min(1, Math.abs(followX - left - first.width / 2) / 110)
        const scale = 1 + .18 * strength * (1 + Math.cos(Math.PI * distance))
        scales.push(scale)
        const extra = (scale - 1) * faceWidth
        totalGrowth += extra
        leftGrowth += extra * Math.max(0, Math.min(1, (followX - left) / first.width))
    }
    const bounds = rail.getBoundingClientRect(), inset = (first.width - faceWidth) / 2
    const rightSpace = bounds.right - (first.left + buttons.length * first.width - inset)
    if (rightSpace >= 0) leftGrowth = Math.max(leftGrowth, totalGrowth - rightSpace)
    const leftSpace = first.left + inset - bounds.left
    if (leftSpace >= 0) leftGrowth = Math.min(leftGrowth, leftSpace)
    let displacement = -leftGrowth
    for (let i = 0; i < buttons.length; i++) {
        const extra = (scales[i] - 1) * faceWidth
        buttons[i].style.setProperty('--dock-shift', (displacement + extra / 2).toFixed(2) + 'px')
        buttons[i].style.setProperty('--dock-scale', scales[i].toFixed(4))
        displacement += extra
    }
    if (strength !== target || (target && followX !== pointerX)) positionDock()
    else previousFrame = 0
}
function resetDock() {
    cancelAnimationFrame(dockFrame)
    dockFrame = previousFrame = strength = 0
    followX = pointerX = null
    for (const button of strip.value?.children || []) {
        button.style.removeProperty('--dock-shift')
        button.style.removeProperty('--dock-scale')
    }
}
function stopMotion() {
    stopCoasting()
    resetDock()
}
onBeforeUnmount(stopMotion)
onDeactivated(stopMotion)
function moveDockPointer(event) {
    if (event.pointerType !== 'mouse') return
    moveDrag(event)
    pointerX = dragging.value ? null : event.clientX
    positionDock()
}
function startDrag(event) {
    stopCoasting()
    suppressClick = false
    const rail = event.currentTarget
    if (event.pointerType === 'mouse' && event.button === 0 && rail.scrollWidth > rail.clientWidth) {
        dragStart = { id: event.pointerId, x: event.clientX, scroll: rail.scrollLeft,
            samples: [{ x: event.clientX, time: event.timeStamp }] }
    }
}
function moveDrag(event) {
    if (dragStart?.id !== event.pointerId) return
    const delta = event.clientX - dragStart.x
    if (!dragging.value) {
        if (Math.abs(delta) < 5) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragging.value = true
        suppressClick = true
    }
    event.currentTarget.scrollLeft = dragStart.scroll - delta
    dragStart.samples.push({ x: event.clientX, time: event.timeStamp })
    while (dragStart.samples.length > 1 && event.timeStamp - dragStart.samples[0].time > 100) {
        dragStart.samples.shift()
    }
}
function endDrag(event) {
    if (dragStart?.id !== event.pointerId) return
    const samples = dragStart.samples
    if (dragging.value && event.type === 'pointerup' && event.timeStamp - samples[samples.length - 1].time < 90) {
        const first = samples[0], elapsed = event.timeStamp - first.time
        if (elapsed > 0) coast(event.currentTarget, (first.x - event.clientX) / elapsed)
    }
    dragStart = null
    if (!dragging.value && event.type === 'pointerup') {
        pointerX = event.clientX
        positionDock()
    }
    dragging.value = false
}
function leaveDock(event) {
    pointerX = null
    positionDock()
    if (!dragging.value) endDrag(event)
}
function ignoreDragClick(event) {
    if (suppressClick && event.detail > 0) {
        event.stopPropagation()
        suppressClick = false
    }
}
const selectedEntry = computed(() => rosterEntries.value.find(e => e.key === chosenKey.value) ?? rosterEntries.value[0])
const selectedKey = computed(() => selectedEntry.value?.key)
const variants = computed(() => store.data.value.rosterCharacterPresets?.[selectedKey.value])
const characterPresets = computed(() => (variants.value?.names || []).filter(name => {
    const item = presets.getPreset(name)?.item
    return item && !item.miyousheKey && item.character.name === selectedEntry.value.characterName
}))
const detailEntry = computed(() => {
    const base = selectedEntry.value
    const name = variants.value?.active
    if (!base || !characterPresets.value.includes(name)) return base
    const preset = presets.getPreset(name).item
    const view = characterSummary({ ...base, presetName: name, equippedArtifacts: [] }, {
        preset, raw: base.raw, characters, weapons, artifacts, locale, inventory: inventory.artifacts.value,
    })
    return { ...view, characterVariant: true }
})
function selectCharacterPreset(name) {
    variants.value.active = name
}
function activateNewPreset(name) {
    store.linkCharacterPreset(selectedKey.value, name).active = name
}
const dialogProps = computed(() => ({
    modelValue: allOpen.value, title: '全部角色', width: 'min(1440px, 95vw)', returnFocus: () => browseTrigger.value?.$el.focus(),
}))
const choosingFor = ref(null)
function applyChoice(choice) {
    choosingFor.value = null
    emit('apply', choice.presetName ?? choice.name, choice.loadout)
}
function choose(entry) {
    if (!props.roster) {
        if (entry.choices.length === 1) applyChoice(entry.choices[0])
        else choosingFor.value = entry
        return
    }
    chosenKey.value = entry.key
    allOpen.value = false
}
function switchByArrow(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const rail = strip.value
    if (!rail?.isConnected || props.disabled || allOpen.value || dragging.value || rosterEntries.value.length < 2) return
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target
    if (target.isContentEditable || target.closest?.('input, textarea, select, [role="textbox"], [role="slider"], [role="combobox"], [role="listbox"], [role="tablist"], [role="menu"], [role="dialog"], [role="alertdialog"]')) return
    const list = rosterEntries.value
    const index = list.indexOf(selectedEntry.value)
    const next = (index + (event.key === 'ArrowLeft' ? -1 : 1) + list.length) % list.length
    event.preventDefault()
    stopCoasting()
    choose(list[next])
    if (rail.contains(target)) rail.children[next].focus({ preventScroll: true })
}
onMounted(() => { if (props.roster) window.addEventListener('keydown', switchByArrow) })
onBeforeUnmount(() => window.removeEventListener('keydown', switchByArrow))
watch([allOpen, selectedUid], stopMotion)
watch([allOpen, selectedUid], () => { checked.value = []; manage.value = false; search.value = '' })
watch(selectedKey, () => {
    const rail = strip.value, avatar = rail?.querySelector('[aria-pressed="true"]')
    if (!avatar) return
    const row = rail.getBoundingClientRect(), item = avatar.getBoundingClientRect()
    if (item.left < row.left) rail.scrollLeft += item.left - row.left
    else if (item.right > row.right) rail.scrollLeft += item.right - row.right
}, { flush: 'post' })
</script>
<style scoped src="../select/character-picker.css"></style>

<style scoped>
.character-equipment .preset-names { display: flex; align-items: baseline; gap: 6px; }
.character-equipment .preset-names > span { color: var(--cx-gold); }
.preset-names small { flex: none; }
.manage-characters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.manage-characters input { flex: 1 1 160px; min-width: 0; padding: 8px 12px; font: inherit; color: var(--cx-letter); background: var(--cx-step); border: 1px solid var(--cx-step-2); border-radius: 8px; }
.character-picker-row:has(.manage-check) { position: relative; }
.manage-check { position: absolute; top: 7px; left: 7px; z-index: 1; display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid var(--cx-dim); border-radius: 50%; background: var(--cx-card); }
[aria-pressed="true"] > .manage-check { background: var(--cx-gold); color: var(--cx-gold-on); border-color: var(--cx-gold); }
.confirm-delete { margin-left: 8px; }
.saved-character-grid { display: grid; gap: 12px; min-width: 0; color: var(--cx-letter); }
.mys-character-picker:has(.roster-body) { container: roster / inline-size; }
.roster-body { display: flex; align-items: center; gap: 12px; }
.roster-avatars { flex: 1; min-width: 0; display: flex; padding-inline: 6px; overflow-x: auto; scrollbar-width: none; user-select: none; }
.roster-avatars::-webkit-scrollbar { display: none; }
.roster-avatars.is-dragging, .roster-avatars.is-dragging .roster-avatar { cursor: grabbing; }
.roster-avatar {
    position: relative; flex: 0 0 62px; display: grid; place-items: center;
    height: 76px; padding: 0; border: 0; background: transparent; cursor: grab;
}
.roster-avatar .roster-face {
    display: flex; box-sizing: border-box; width: 42px; height: 42px;
    border: 2px solid transparent; color: var(--cx-letter); background: var(--cx-step-2); font-size: 12px;
    pointer-events: none;
}
.roster-avatar[aria-pressed="true"] .roster-face { border-color: var(--cx-gold); }
.roster-avatar[aria-pressed="true"]::after {
    content: ''; position: absolute; bottom: 3px; width: 4px; height: 4px; left: calc(50% - 2px);
    border-radius: 50%; background: var(--cx-gold);
}
.roster-avatar:focus-visible { outline: none; }
.roster-avatar:focus-visible .roster-face { outline: 2px solid var(--cx-letter); outline-offset: 2px; }
@media (any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference) {
    .roster-avatar .roster-face { transform: translateX(var(--dock-shift, 0px)) scale(var(--dock-scale, 1)); }
    .roster-avatar::after { transform: translateX(var(--dock-shift, 0px)); }
}
.roster-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.character-picker-row[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--cx-gold); }
.roster-dialog-grid .character-picker-list { overflow-y: auto; max-height: min(58dvh, 42rem); padding: 3px; }
@container roster (max-width: 680px) {
    .roster-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
    .roster-avatars:empty { display: none; }
}
@media (hover: none) and (pointer: coarse) {
    .roster-avatars { padding-inline: 2px; }
    .roster-avatar { flex-basis: 50px; height: 54px; }
    .roster-avatar .roster-face { width: 38px; height: 38px; }
}
</style>
