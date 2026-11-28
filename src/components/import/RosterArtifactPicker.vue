<template>
    <UiDialog :model-value="modelValue" :title="entry.label + ' · ' + t('misc', position)" width="min(94vw, 1760px)"
        :return-focus="returnFocus" @update:model-value="emit('update:modelValue', $event)">
        <div class="filters">
            <span>{{ filtered.length }} 件</span>
            <button ref="filterTrigger" type="button" aria-haspopup="dialog" @click="openFilters">筛选{{ filterCount ? ' · '+filterCount : '' }}</button>
            <UiSelect v-model="sort" label="圣遗物排序" :options="sortOptions" />
        </div>
        <div v-if="filterCount" class="filter-chips applied">
            <template v-for="group in groups" :key="group.key">
                <button v-for="key in active[group.key]" :key="key" type="button" :aria-label="'移除' + group.name + group.options.get(key).label"
                    @click="removeAppliedFilter(group.key, key)">
                    {{ group.key === 'subs' && active.exclude ? '排除 · ' : '' }}{{ group.options.get(key).label }} <span aria-hidden="true">×</span>
                </button>
            </template>
        </div>
        <UiDialog v-model="filtersOpen" :title="editing ? '筛选圣遗物 · ' + editing.name : '筛选圣遗物'" width="min(94vw, 700px)" :return-focus="() => filterTrigger?.focus()" @escape-key-down="onFilterEscape">
            <div v-if="!editing" class="filter-overview filter-page" :class="{ 'filter-backward': returningToOverview }">
                <section v-for="group in groups" :key="group.key" class="filter-section">
                    <h4>{{ group.name }}</h4>
                    <div class="filter-field">
                        <div v-if="pending[group.key].length" class="filter-chips">
                            <button v-for="key in pending[group.key]" :key="key" type="button" :aria-label="'移除' + group.options.get(key).label"
                                @click="removeFilter(pending, group.key, key)">
                                <img v-if="group.options.get(key).icon" :src="group.options.get(key).icon" alt="" />
                                {{ group.options.get(key).label }} <span aria-hidden="true">×</span>
                            </button>
                        </div>
                        <button :ref="el => groupButtons[group.key] = el" type="button" class="choose-group" :aria-label="'选择' + group.name"
                            @click="editGroup(group.key)">
                            <span>{{ pending[group.key].length ? '继续选择' : '点击选择' }}</span><b aria-hidden="true">＋</b>
                        </button>
                        <small v-if="group.key === 'subs' && pending.subs.length">{{ pending.exclude ? '排除任一所选词条' : '至少命中 ' + requiredSubs(pending) + ' 条' }}</small>
                    </div>
                </section>
            </div>
            <div v-else class="filter-page filter-forward">
                <div v-if="editing.key === 'subs'" class="sub-rule">
                    <div class="mode-switch" aria-label="副词条规则">
                        <button v-for="mode in [false, true]" :key="String(mode)" type="button" :aria-pressed="pending.exclude === mode" @click="pending.exclude = mode">
                            {{ mode ? '排除' : '包含' }}
                        </button>
                    </div>
                    <div v-if="!pending.exclude && pending.subs.length" class="minimum-rule">至少命中
                        <UiSelect label="至少命中" :model-value="String(pending.minimum ?? 'all')" :options="minimumOptions"
                            @update:model-value="pending.minimum = $event === 'all' ? null : Number($event)" />
                    </div>
                </div>
                <div ref="optionsElement" class="filter-options">
                    <label v-for="[key, option] in editing.options" :key="key" :class="{ chosen: pending[editing.key].includes(key) }">
                        <img v-if="option.icon" :src="option.icon" alt="" loading="lazy" />
                        <span>{{ option.label }}</span><small>{{ option.count }} 件</small>
                        <input type="checkbox" :checked="pending[editing.key].includes(key)" @change="toggleOption(editing.key, key)" />
                    </label>
                </div>
            </div>
            <template #footer>
                <div class="filter-actions">
                    <UiButton v-if="editing" class="filter-back" aria-label="返回上一级" @click="finishGroup"><span aria-hidden="true">←</span> 返回</UiButton>
                    <UiButton @click="clearDraft">{{ editing ? '清除此项' : '全部清除' }}</UiButton>
                    <UiButton variant="primary" @click="editing ? finishGroup() : applyFilters()">确认</UiButton>
                </div>
            </template>
        </UiDialog>
        <UiHoverPreview target="button.art-card" class="choices art-hover-grid">
            <div v-for="piece in filtered.slice(0, limit)" :key="piece.id" class="choice" :class="{picked: selected === piece.id}">
                <ArtifactCard :item="piece" :icon-src="pieceIcon(piece)" :highlight-tags="highlightTags" :selected="selected === piece.id" @open="selected = piece.id" />
                <span v-if="!entry.characterVariant && owners.has(piece.id)" class="wearers">
                    <span v-for="row in owners.get(piece.id)" :key="row.key" :title="row.label + '已装备'" :aria-label="row.label + '已装备'">
                        <UiAvatar class="wearer" :src="rosterByKey.get(row.key)?.avatar">
                            <CharacterPortrait v-if="rosterByKey.get(row.key)?.splash" :character-name="rosterByKey.get(row.key).characterName"
                                :splash="rosterByKey.get(row.key).splash" alt="" />
                            <template v-else>{{ row.label.slice(0, 1) }}</template>
                        </UiAvatar>
                    </span>
                </span>
            </div>
        </UiHoverPreview>
        <p v-if="!filtered.length">仓库里没有符合条件的{{ t('misc', position) }}</p>
        <button v-if="filtered.length > limit" type="button" @click="limit += 24">显示更多</button>
        <template #footer>
            <button v-if="current?.item" type="button" @click="apply(null)">卸下</button>
            <button class="confirm" type="button" :disabled="!candidate || current?.item?.id === selected" @click="apply(candidate)">
                {{ otherOwners.length ? '从' + otherOwners.map(row => row.label).join('、') + '身上换过来' : '穿戴' }}
            </button>
        </template>
    </UiDialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiHoverPreview from '@/components/ui/UiHoverPreview.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
import ArtifactCard from '@/components/display/ArtifactCard.vue'
import artifacts from '@/assets/_gen_artifact'
import { useI18n } from '@/i18n/i18n'
import { useArtifactStore } from '@/store/pinia/artifact'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { selectUidInventory } from '@/import/uid-inventory.mjs'
import { rosterArtifactOwners } from '@/import/roster-equipment.mjs'
import { defaultArtifactSortFunction } from '@/utils/artifacts'
import { artifactTags } from '@/constants/artifact'

const props = defineProps(['modelValue', 'entry', 'roster', 'position', 'slots', 'highlightTags', 'pieceIcon', 'returnFocus'])
const emit = defineEmits(['update:modelValue', 'equip'])
const { t, ta } = useI18n()
const inventory = useArtifactStore(), presets = usePresetStore(), { data } = useMiyousheStore()
const selected = ref(null), limit = ref(24), sort = ref('level')
const sortOptions = [{ value: 'level', label: '等级从高到低' }, { value: 'older', label: '最早在前' }, { value: 'newer', label: '最新在前' }]
const emptyFilters = () => ({ sets: [], main: [], subs: [], exclude: false, minimum: null })
const active = ref(emptyFilters()), pending = ref(emptyFilters()), filtersOpen = ref(false), filterTrigger = ref(null)
const minimumOptions = computed(() => [{ value: 'all', label: '全部' },
    ...Array.from({ length: Math.min(4, pending.value.subs.length) }, (_, i) => ({ value: String(i + 1), label: (i + 1) + ' 条' }))])
const filterCount = computed(() => active.value.sets.length + active.value.main.length + active.value.subs.length)
const editingKey = ref(null), groupButtons = {}
const returningToOverview = ref(false)
const editing = computed(() => groups.value.find(group => group.key === editingKey.value))
const requiredSubs = rule => rule.minimum ?? rule.subs.length
function openFilters() {
    const rule = active.value
    pending.value = { ...rule, sets: [...rule.sets], main: [...rule.main], subs: [...rule.subs] }
    editingKey.value = null
    returningToOverview.value = false
    filtersOpen.value = true
}
const optionsElement = ref(null)
async function editGroup(key) {
    editingKey.value = key
    await nextTick()
    optionsElement.value?.querySelector('input')?.focus()
}
async function finishGroup() {
    const key = editingKey.value
    returningToOverview.value = true
    editingKey.value = null
    await nextTick()
    groupButtons[key]?.focus()
}
function onFilterEscape(event) {
    if (editing.value) {
        event.preventDefault()
        finishGroup()
    }
}
function clearDraft() {
    if (!editing.value) { pending.value = emptyFilters(); return }
    pending.value[editingKey.value] = []
    if (editingKey.value === 'subs') { pending.value.minimum = null; pending.value.exclude = false }
}
function removeFilter(rule, group, key) {
    rule[group] = rule[group].filter(value => value !== key)
    if (group === 'subs' && rule.minimum > rule.subs.length) rule.minimum = null
}
function removeAppliedFilter(group, key) {
    removeFilter(active.value, group, key)
    if (!active.value.subs.length) active.value.exclude = false
    selected.value = null
    limit.value = 24
}
function toggleOption(group, key) {
    if (pending.value[group].includes(key)) removeFilter(pending.value, group, key)
    else pending.value[group].push(key)
}
function applyFilters() {
    active.value = pending.value
    selected.value = null; limit.value = 24; filtersOpen.value = false
}
const current = computed(() => props.slots.find(slot => slot.position === props.position))
const pool = computed(() => selectUidInventory(props.entry.uid, data.value, presets.presets.value, inventory.artifacts.value)
    .filter(item => item.position === props.position).sort(defaultArtifactSortFunction))
const owners = computed(() => rosterArtifactOwners(data.value.entries, presets.presets.value, props.entry.uid, props.position))
const rosterByKey = computed(() => new Map(props.roster.map(row => [row.key, row])))
const groups = computed(() => {
    const sets = new Map(), main = new Map(), subs = new Map()
    for (const item of pool.value) {
        addOption(sets, item.setName, ta(artifacts[item.setName].nameLocale), props.pieceIcon(item) || artifacts[item.setName][item.position]?.url)
        addOption(main, item.mainTag.name, artifactTags[item.mainTag.name].chs)
        for (const tag of item.normalTags) addOption(subs, tag.name, artifactTags[tag.name].chs)
    }
    return [{key:'sets', name:'套装', options:sets}, {key:'main', name:'主词条', options:main}, {key:'subs', name:'副词条', options:subs}]
})
function addOption(options, key, label, icon) {
    if (!options.has(key)) options.set(key, { label, icon, count: 0 })
    options.get(key).count++
}
const filtered = computed(() => {
    const { sets, main, subs, exclude } = active.value
    const result = pool.value.filter(item => (!sets.length || sets.includes(item.setName))
        && (!main.length || main.includes(item.mainTag.name)) && matchesSubs(item))
    function matchesSubs(item) {
        const matches = item.normalTags.filter(tag => subs.includes(tag.name)).length
        return exclude ? matches === 0 : matches >= requiredSubs(active.value)
    }
    if (sort.value !== 'level') result.sort((a,b) => sort.value === 'older' ? a.id-b.id : b.id-a.id)
    return result
})
const candidate = computed(() => filtered.value.find(item => item.id === selected.value))
const otherOwners = computed(() => props.entry.characterVariant ? [] : (owners.value.get(selected.value) || []).filter(row => row.key !== props.entry.key))
watch(() => props.modelValue, open => {
    if (open) { selected.value = null; active.value = emptyFilters(); limit.value = 24 }
}, { immediate: true })

function apply(item) {
    emit('equip', item)
    emit('update:modelValue', false)
}
</script>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.filters > span { margin-right: auto; align-self: center; color: var(--cx-dim); }
.filter-overview { display: grid; gap: 10px; }
.filter-section { display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: start; gap: 12px; padding: 14px; border-radius: 10px; background: var(--cx-step); }
.filter-section h4 { margin: 10px 0 0; font-size: 14px; }
.filter-field { display: grid; gap: 7px; }
.filter-field > small, .filter-options small { color: var(--cx-dim); }
.filter-field .choose-group { display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 0 0 0 12px; min-height: 39px; border: 1px dashed var(--cx-dim); background: var(--cx-card); color: var(--cx-letter); }
.choose-group b { display: grid; place-items: center; width: 38px; align-self: stretch; color: var(--cx-gold); font-size: 18px; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.filter-chips.applied { margin-bottom: 12px; }
.filter-chips button { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; padding: 4px 8px; background: var(--cx-card); border-color: var(--cx-dim); border-radius: 20px; }
.filter-chips img { width: 22px; height: 22px; object-fit: contain; }
.filter-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.filter-options label { cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 10px; border: 1px solid var(--cx-step-2); background: var(--cx-step); border-radius: 8px; font-size: 14px; }
.filter-options label.chosen, .filter-options label:hover, .filter-field .choose-group:hover { border-color: var(--cx-gold); }
.filter-options label.chosen { background: color-mix(in srgb, var(--cx-gold) 9%, var(--cx-step)); }
.filter-options img { width: 32px; height: 32px; object-fit: contain; }
.filter-options small { margin-left: auto; white-space: nowrap; font-variant-numeric: tabular-nums; }
.filter-options input { accent-color: var(--cx-gold); flex: none; }
.sub-rule, .minimum-rule, .mode-switch { display: flex; align-items: center; gap: 6px; }
.sub-rule { justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px; }
.mode-switch button[aria-pressed="true"] { border-color: var(--cx-gold); color: var(--cx-gold); }
.filter-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.filter-back { margin-right: auto; }
@media (prefers-reduced-motion: no-preference) {
    .filter-forward { animation: filter-forward 150ms ease-out; }
    .filter-backward { animation: filter-backward 150ms ease-out; }
}
@keyframes filter-forward { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
@keyframes filter-backward { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
:where(button:not([data-slot="button"])) { font: inherit; color: var(--cx-letter); border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); padding: 6px 12px; }
@media (max-width: 600px) {
    .filter-options { grid-template-columns: 1fr; }
    .filter-section { grid-template-columns: 1fr; gap: 8px; padding: 12px; }
    .filter-section h4 { margin: 0; }
}
.choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(310px, 100%), 1fr)); gap: 8px; }
.choice { --artifact-card-surface: transparent; display: flex; flex-direction: column; background: var(--cx-step); border: 1px solid transparent; border-radius: 10px; }
.choice.picked { border-color: var(--cx-gold); }
.choice :deep(.art-card) { width: 100%; height: 100%; background: transparent; }
.choice { position: relative; }
.wearers { position: absolute; top: 7px; right: 8px; display: flex; pointer-events: none; }
.wearer { width: 27px; height: 27px; border: 1px solid var(--cx-gold); background: var(--cx-card); color: var(--cx-letter); font-size: 12px; }
.wearer :deep(span:has(>img)), .wearer :deep(img) { width: 100%; height: 100%; display: block; object-fit: cover; object-position: var(--portrait-focus-x, 50%) 22%; }
button { cursor: pointer; }
.confirm { margin-left: 8px; background: var(--cx-gold); color: var(--cx-card); }
.confirm:disabled { opacity: .5; cursor: default; }
</style>
