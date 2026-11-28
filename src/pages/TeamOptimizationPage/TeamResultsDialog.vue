<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { IArtifact } from '@/types/artifact'
import { artifactsData } from '@/assets/artifacts'
import { characterData } from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import { displayedTagParts } from '@/utils/artifacts'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import TeamDialog from './TeamDialog.vue'
import TeamResultArtifactPreview from './TeamResultArtifactPreview.vue'
import { teamResultDamageDelta, teamResultSets, teamResultSlots } from './team-results-presentation.mjs'

type Metric = 'expectation' | 'critical' | 'non_critical'
type Damage = Record<Metric, number>
type BuildSlots = Parameters<typeof teamResultSlots>[0]
type Candidate = {
    index: number
    rank: number
    result: Damage & {
        duration: number
        artifacts: readonly BuildSlots[]
        character_damage: readonly Damage[]
    }
}

const props = defineProps<{
    visible: boolean
    sortMetric: Metric
    damageModes: readonly (readonly [Metric, string])[]
    results: readonly Candidate[]
    selectedIndex: number
    roles: readonly (keyof typeof characterData)[]
    labels: readonly string[]
    items?: ReadonlyMap<number, IArtifact>
    elementColors: Record<string, string>
}>()

const emit = defineEmits<{
    (event: 'update:visible', value: boolean): void
    (event: 'update:sortMetric', value: Metric): void
    (event: 'select', index: number): void
}>()

const slotLabels = {
    flower: ['花', '生之花'],
    feather: ['羽', '死之羽'],
    sand: ['沙', '时之沙'],
    goblet: ['杯', '空之杯'],
    head: ['头', '理之冠'],
}

const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
const showDifferences = ref(true)
const preview = ref<InstanceType<typeof TeamResultArtifactPreview> | null>(null)
const selectedRank = computed(() => props.results.find(row => row.index + 1 === props.selectedIndex)?.rank)
const metricOptions = computed(() => props.damageModes.map(([value, label]) => ({ value, label })))
const primaryLabel = computed(() => props.damageModes.find(([key]) => key === props.sortMetric)?.[1])
const secondaryMetrics = computed(() => props.damageModes.filter(([key]) => key !== props.sortMetric))
const members = computed(() => props.roles.map((role, index) => {
    const character = characterData[role]
    return { label: props.labels[index], avatar: character.avatar, element: props.elementColors[character.element] }
}))

const setTitle = (name: string) => locale[artifactsData[name]?.nameLocale] || name
const cards = computed(() => {
    const first = props.results[0]?.result
    const metric = props.sortMetric
    const slotDetails = new Map<IArtifact, { name: string; icon: string | undefined; main: string }>()

    return props.results.map(row => {
        const total = row.result[metric]
        return {
            ...row,
            total,
            delta: row.rank > 1 && first ? teamResultDamageDelta(total, first[metric]) : null,
            dps: row.result.duration > 0 ? number.format(total / row.result.duration) : '—',
            members: members.value.map((member, index) => {
                const damage = row.result.character_damage[index][metric]
                const slots = teamResultSlots(row.result.artifacts[index], props.items, first?.artifacts[index])
                const sets = teamResultSets(slots.map(slot => slot.item))
                return {
                    ...member,
                    damage,
                    share: total > 0 ? damage / total * 100 : 0,
                    sets: sets.filter(set => set.effect).map(set => ({ ...set, label: setTitle(set.name) })),
                    setSummary: sets.map(set => `${setTitle(set.name)} ×${set.count}`).join(' / '),
                    slots: slots.map(slot => {
                        const [short, full] = slotLabels[slot.key]
                        const item = slot.item
                        if (!item) return { ...slot, short, full, detail: null }
                        let detail = slotDetails.get(item)
                        if (!detail) {
                            const [main, value] = displayedTagParts(item.mainTag.name, item.mainTag.value)
                            detail = {
                                name: setTitle(item.setName),
                                icon: artifactsData[item.setName]?.[item.position]?.url,
                                main: main + (value.endsWith('%') && /^(life|attack|defend)Percentage$/.test(item.mainTag.name) ? '%' : ''),
                            }
                            slotDetails.set(item, detail)
                        }
                        return {
                            ...slot,
                            short,
                            full,
                            detail,
                            unmaxed: item.level < (item.star >= 5 ? 20 : item.star === 4 ? 16 : 12),
                            showMain: slot.key !== 'flower' && slot.key !== 'feather',
                        }
                    }),
                }
            }),
        }
    })
})

function setMetric(value: string) {
    emit('update:sortMetric', value as Metric)
}

type PreviewTrigger = 'pointer' | 'focus'
function slotAnchor(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLButtonElement>('button[data-preview]') : null
}

function showPreview(anchor: HTMLButtonElement, trigger: PreviewTrigger) {
    const [row, role, slot] = anchor.dataset.preview!.split(':').map(Number)
    const entry = cards.value[row].members[role].slots[slot]
    if (entry.item && entry.detail) {
        preview.value?.show(anchor, {
            item: entry.item,
            name: entry.detail.name,
            slotLabel: entry.full,
            different: showDifferences.value && entry.different,
        }, trigger)
    }
}

function onPointerDown(event: PointerEvent) {
    if (!slotAnchor(event.target)) preview.value?.dismiss()
}

function onPointerOver(event: PointerEvent) {
    const anchor = slotAnchor(event.target)
    if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && anchor && anchor !== slotAnchor(event.relatedTarget)) showPreview(anchor, 'pointer')
}

function onPointerOut(event: PointerEvent) {
    const anchor = slotAnchor(event.target)
    if (anchor && anchor !== slotAnchor(event.relatedTarget)) preview.value?.dismiss(anchor, 'pointer')
}

function onFocusIn(event: FocusEvent) {
    const anchor = slotAnchor(event.target)
    if (anchor?.matches(':focus-visible')) showPreview(anchor, 'focus')
}

function onFocusOut(event: FocusEvent) {
    const anchor = slotAnchor(event.target)
    if (anchor) preview.value?.dismiss(anchor, 'focus')
}

function chooseRow(event: MouseEvent, index: number) {
    const anchor = slotAnchor(event.target)
    if (anchor && event.detail === 0) {
        showPreview(anchor, 'focus')
        return
    }
    selectResult(index)
}

function selectResult(index: number) {
    preview.value?.dismiss()
    emit('select', index)
}

function moveSlot(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const target = event.target as HTMLElement
    const row = target.closest<HTMLElement>('.team-row')
    const current = slotAnchor(target)
    if (!row || (!current && target !== row)) return
    const slots = Array.from(row.querySelectorAll<HTMLButtonElement>('button[data-preview]'))
    const index = current ? slots.indexOf(current) : event.key === 'ArrowLeft' ? slots.length : -1
    const next = slots[index + (event.key === 'ArrowLeft' ? -1 : 1)]
    if (next) {
        event.preventDefault()
        next.focus()
    }
}

watch([() => props.visible, () => props.sortMetric, () => props.results, showDifferences], () => {
    preview.value?.dismiss()
})
</script>

<template>
    <TeamDialog :model-value="visible" title="四人圣遗物搭配结果" width="94%" viewport
        content-class="team-dps-results cx-scope"
        @update:model-value="emit('update:visible', $event)">
        <div class="tr-layout" :style="{ '--tr-azure': elementColors.Hydro }">
            <div class="sort-bar">
                <div class="tr-controls">
                    <div class="tr-sort">
                        <span>排序</span>
                        <UiSelect :model-value="sortMetric" label="排序" :options="metricOptions" @update:model-value="setMetric" />
                    </div>
                    <UiCheckbox v-if="results.length > 1" v-model="showDifferences">
                        高亮与第1套差异
                    </UiCheckbox>
                    <div v-if="results.length" class="tr-legend">
                        <span><i class="tr-warn-swatch" aria-hidden="true" />未满级（&lt; +20）</span>
                        <span v-if="results.length > 1 && showDifferences"><i class="tr-diff-swatch" aria-hidden="true" />与第1套不同</span>
                    </div>
                </div>
                <div class="tr-count">
                    <span>共{{ results.length }}套</span>
                    <span v-if="selectedRank">当前选中：<strong>第{{ selectedRank }}套</strong></span>
                </div>
            </div>
            <p v-if="!results.length" class="tr-empty">暂无搭配结果</p>
            <div v-else class="tr-results-list"
                @pointerdown="onPointerDown" @pointerover="onPointerOver" @pointerout="onPointerOut" @pointerleave="preview?.dismiss(undefined, 'pointer')"
                @focusin="onFocusIn" @focusout="onFocusOut" @keydown="moveSlot">
                <article v-for="(row, rowIndex) in cards" :key="row.index" class="team-row"
                    :class="{ chosen: selectedIndex === row.index + 1 }" tabindex="0"
                    :aria-labelledby="'team-result-rank-' + row.index"
                    aria-keyshortcuts="Enter ArrowLeft ArrowRight"
                    @click="chooseRow($event, row.index)" @keydown.enter.self.prevent="selectResult(row.index)">
                    <header class="tr-card-head">
                        <div class="tr-metrics">
                            <div class="tr-rank">
                                <strong :id="'team-result-rank-' + row.index" class="tr-rank-pill" :class="{ 'is-first': row.rank === 1 }">第{{ row.rank }}套</strong>
                                <span v-if="selectedIndex === row.index + 1" class="tr-chosen">当前已选</span>
                            </div>
                            <div class="tr-damage-primary">
                                <span>{{ primaryLabel }}</span><strong class="tr-value">{{ number.format(row.total) }}</strong>
                                <span v-if="row.rank === 1 || row.delta !== null" class="tr-delta" :class="{ 'is-first': row.rank === 1 }">{{ row.rank === 1 ? '最高' : row.delta }}</span>
                            </div>
                            <div class="tr-dps"><span>DPS</span><strong class="tr-value">{{ row.dps }}</strong></div>
                            <div class="tr-secondary">
                                <span v-for="[key, label] in secondaryMetrics" :key="key">{{ label }} <strong>{{ number.format(row.result[key]) }}</strong></span>
                            </div>
                        </div>
                        <UiButton class="tr-details" :variant="selectedIndex === row.index + 1 ? 'primary' : 'outline'" @keydown.enter.stop @click.stop="selectResult(row.index)">查看详情</UiButton>
                    </header>
                    <div v-for="(member, memberIndex) in row.members" :key="memberIndex" class="tr-member" :style="{ '--tr-member': member.element }">
                        <div class="tr-person"><img :src="member.avatar" alt="" loading="lazy" /><strong :title="member.label">{{ member.label }}</strong></div>
                        <div class="tr-contribution">
                            <div class="tr-contribution-values"><strong>{{ number.format(member.damage) }}</strong><span>{{ number.format(member.share) }}%</span></div>
                            <div class="tr-share-track" aria-hidden="true"><span :style="{ width: Math.min(100, member.share) + '%' }" /></div>
                        </div>
                        <div class="tr-sets" :title="member.setSummary">
                            <span v-for="set in member.sets" :key="set.name" class="tr-set-pill" :class="{ 'is-four': set.effect === 4 }">
                                <span>{{ set.label }}</span><b>{{ set.effect }}件</b>
                            </span>
                            <span v-if="!member.sets.length" class="tr-set-pill is-loose">散件</span>
                        </div>
                        <div class="tr-slots">
                            <template v-for="(slot, slotIndex) in member.slots" :key="slot.key">
                                <button v-if="slot.item && slot.detail" type="button" tabindex="-1" class="tr-slot"
                                    :class="{ 'is-unmaxed': slot.unmaxed, 'is-diff': showDifferences && slot.different }"
                                    :data-preview="`${rowIndex}:${memberIndex}:${slotIndex}`"
                                    :aria-label="`${slot.full} ${slot.detail.name} +${slot.item.level}`">
                                    <span class="tr-slot-icon"><img v-if="slot.detail.icon" :src="slot.detail.icon" alt="" width="24" height="24" loading="lazy" decoding="async" /></span>
                                    <span class="tr-slot-copy">
                                        <span class="tr-slot-top"><span class="tr-slot-name">{{ slot.detail.name }}</span><strong class="tr-level">+{{ slot.item.level }}</strong></span>
                                        <span class="tr-slot-sub">{{ slot.short }}<template v-if="slot.showMain"> · {{ slot.detail.main }}</template></span>
                                    </span>
                                </button>
                                <div v-else class="tr-slot is-missing" :class="{ 'is-diff': showDifferences && slot.different }">
                                    <span>{{ slot.short }}</span><span>缺失</span>
                                </div>
                            </template>
                        </div>
                    </div>
                </article>
            </div>
        </div>
        <TeamResultArtifactPreview ref="preview" :azure="elementColors.Hydro" />
    </TeamDialog>
</template>

<style>
.team-dps-results.ui-dialog > header { flex: none; }
.team-dps-results.ui-dialog > .ui-dialog-body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 8px 20px 18px;
}

@media (max-width: 850px) {
    .team-dps-results.ui-dialog > .ui-dialog-body { padding: 6px 10px 12px; }
}
</style>

<style scoped>
.tr-layout {
    --tr-warn: var(--cx-gold);
    --tr-warn-wash: color-mix(in srgb, var(--tr-warn) 12%, var(--cx-card));
    --tr-diff-ring: color-mix(in srgb, var(--tr-azure) 56%, var(--cx-letter));
    --tr-diff-wash: color-mix(in srgb, var(--tr-azure) 12%, var(--cx-card));
    --tr-choice: color-mix(in srgb, var(--cx-gold) 5%, var(--cx-step));
    --tr-choice-ring: color-mix(in srgb, var(--cx-gold) 39%, var(--cx-step-2));
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    color: var(--cx-letter);
}

.sort-bar, .tr-controls, .tr-count, .tr-legend, .tr-legend > span, .tr-sort {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}
.sort-bar {
    justify-content: space-between;
    padding-bottom: 12px;
    gap: 10px 16px;
    color: var(--cx-dim);
    font-size: 13px;
}
.tr-controls, .tr-count, .tr-legend { gap: 8px 14px; }
.tr-count strong { color: var(--cx-gold); }
.tr-legend i { width: 9px; height: 9px; border: 1px solid; border-radius: 3px; }
.tr-warn-swatch { color: var(--tr-warn); background: var(--tr-warn-wash); }
.tr-diff-swatch { color: var(--tr-diff-ring); background: var(--tr-diff-wash); }

.tr-results-list {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 0;
    padding: 3px 5px 5px 3px;
    overflow: auto;
    overscroll-behavior: contain;
}
.tr-empty { padding: 18px 4px; margin: 0; color: var(--cx-dim); text-align: center; }
.team-row {
    min-width: 0;
    padding: 14px 16px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: var(--cx-step);
    cursor: pointer;
}
.team-row:hover { background: color-mix(in srgb, var(--cx-step) 68%, var(--cx-step-2)); }
.team-row.chosen {
    border-color: var(--tr-choice-ring);
    background: var(--tr-choice);
    box-shadow: inset 3px 0 0 var(--cx-gold);
}
:is(.team-row, .tr-slot):focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

.tr-card-head, .tr-metrics, .tr-rank, .tr-damage-primary, .tr-dps, .tr-secondary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
}
.tr-card-head {
    justify-content: space-between;
    gap: 8px 14px;
    padding-bottom: 10px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--cx-step-2);
}
.tr-metrics { flex: 1; gap: 6px 14px; min-width: 0; font-variant-numeric: tabular-nums; }
.tr-damage-primary, .tr-dps { align-items: baseline; font-size: 13px; color: var(--cx-dim); }
.tr-damage-primary .tr-value { font-size: 20px; color: var(--cx-letter); }
.tr-dps { border-inline-start: 1px solid var(--cx-step-2); padding-inline-start: 12px; }
.tr-dps .tr-value { font-size: 17px; color: var(--cx-gold); }
.tr-secondary { color: var(--cx-dim); font-size: 12px; }
.tr-secondary > span { white-space: nowrap; }
.tr-secondary strong { color: var(--cx-letter); }
.tr-details { margin-inline-start: auto; flex: none; }
.tr-rank-pill, .tr-chosen, .tr-delta {
    padding: 3px 8px;
    border-radius: 7px;
    background: var(--cx-step-2);
    white-space: nowrap;
}
.tr-rank-pill { font-size: 13px; }
.tr-rank-pill.is-first { background: var(--cx-gold); color: var(--cx-gold-on); }
.tr-chosen, .tr-delta { font-size: 11px; }
.tr-chosen, .tr-delta.is-first { color: var(--cx-gold); background: var(--tr-choice); }
.tr-chosen { box-shadow: inset 0 0 0 1px var(--tr-choice-ring); }

.tr-member {
    display: grid;
    grid-template-columns: 120px 168px 160px minmax(0, 1fr);
    align-items: center;
    gap: 8px 14px;
    min-width: 0;
    padding: 7px 8px;
    border-radius: 8px;
}
.tr-member:nth-of-type(even) { background: color-mix(in srgb, var(--cx-card) 55%, transparent); }
.tr-person { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 13px; }
.tr-person img {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    border: 1px solid var(--tr-member);
    border-radius: 50%;
    background: var(--cx-card);
    object-fit: cover;
    box-sizing: border-box;
}
.tr-person strong, .tr-set-pill > span, .tr-slot-name, .tr-slot-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.tr-contribution { display: grid; gap: 5px; min-width: 0; }
.tr-contribution-values {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px 6px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
}
.tr-contribution-values > span { color: var(--cx-dim); font-size: 11px; }
.tr-share-track { height: 5px; overflow: hidden; border-radius: 999px; background: var(--cx-step-2); }
.tr-share-track > span { display: block; height: 100%; border-radius: inherit; background: var(--tr-member); }

.tr-sets { display: flex; flex-wrap: wrap; gap: 3px; min-width: 0; }
.tr-set-pill {
    display: inline-flex;
    gap: 4px;
    max-width: 100%;
    box-sizing: border-box;
    padding: 2px 6px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: var(--cx-step-2);
    font-size: 11px;
    white-space: nowrap;
}
.tr-set-pill.is-four { color: var(--cx-gold); border-color: var(--tr-choice-ring); background: var(--tr-choice); }
.tr-set-pill.is-loose { color: var(--cx-dim); border: 1px dashed var(--cx-dim); background: transparent; }

.tr-slots { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; min-width: 0; }
.tr-slot {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    padding: 4px 5px;
    border: 1px solid var(--cx-step-2);
    border-radius: 7px;
    background: var(--cx-card);
    color: var(--cx-letter);
    font: inherit;
    line-height: 1.35;
    text-align: start;
}
button.tr-slot { cursor: pointer; }
button.tr-slot:hover { border-color: var(--cx-dim); }
.tr-slot.is-unmaxed:not(.is-diff) { border-color: var(--tr-choice-ring); background: var(--tr-warn-wash); }
.tr-slot.is-diff { border-color: var(--tr-diff-ring); background: var(--tr-diff-wash); }
.tr-slot.is-unmaxed .tr-level { color: var(--tr-warn); }
.tr-slot.is-missing { color: var(--cx-dim); font-size: 11px; min-height: 34px; box-sizing: border-box; }
.tr-slot-icon {
    flex: 0 0 24px;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    background: var(--cx-step-2);
}
.tr-slot-icon img { width: 100%; height: 100%; object-fit: contain; }
.tr-slot-copy { display: grid; flex: 1; gap: 2px; min-width: 0; }
.tr-slot-top { display: flex; align-items: baseline; justify-content: space-between; gap: 3px; font-size: 12px; }
.tr-level { flex: none; font-size: 11px; font-variant-numeric: tabular-nums; }
.tr-slot-sub { color: var(--cx-dim); font-size: 11px; }

@media (prefers-reduced-motion: no-preference) {
    .team-row, .tr-slot { transition: background-color 150ms ease, border-color 150ms ease; }
}
@media (851px <= width <= 1200px) {
    .tr-member { grid-template-columns: 108px 146px 136px minmax(0, 1fr); gap: 10px; }
}
@media (851px <= width <= 1120px) {
    .tr-slots { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 850px) {
    .tr-legend { display: none; }
    .tr-results-list { gap: 9px; padding-inline-end: 3px; }
    .team-row { padding: 9px; }
    .tr-card-head { align-items: flex-start; gap: 8px; }
    .tr-metrics { flex-basis: 100%; gap: 5px 10px; }
    .tr-damage-primary .tr-value { font-size: 19px; }
    .tr-dps { border-inline-start: 0; padding-inline-start: 0; }
    .tr-member { grid-template-columns: minmax(0, .85fr) minmax(0, 1fr) minmax(0, 1.05fr); padding: 7px 4px; gap: 6px; }
    .tr-contribution { display: contents; }
    .tr-person { grid-area: 1 / 1; }
    .tr-contribution-values { grid-area: 1 / 2; }
    .tr-sets { grid-area: 1 / 3; }
    .tr-share-track { grid-area: 2 / 1 / 3 / -1; }
    .tr-slots { grid-area: 3 / 1 / 4 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
