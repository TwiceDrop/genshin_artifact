<template>
    <section class="dps-events">
        <h3>战斗明细</h3>
        <TabsRoot :model-value="channel" @update:model-value="selectChannel">
            <TabsList class="team-tabs-list" aria-label="战斗明细">
                <TabsTrigger v-for="[key, title] in channels" :key="key" :value="key" class="team-tab">{{ title }}</TabsTrigger>
            </TabsList>
            <TabsContent :key="channel" :value="channel">
                <div class="team-table-scroll event-table" tabindex="0" role="region" aria-label="战斗明细">
                    <table class="team-data-table" :style="{ minWidth: tableWidth(eventColumns) }">
                        <colgroup><col v-for="col in eventColumns" :key="col.label" :style="{ width: col.width + 'px' }" /></colgroup>
                        <thead>
                            <tr>
                                <th v-for="col in eventColumns" :key="col.label" scope="col">{{ col.label }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in visibleEvents" :key="row.event.id" class="team-table-action"
                                :aria-selected="selectedId === row.event.id" @click="selectEvent(row.event.id)">
                                <td>{{ number(row.from) }}<template v-if="row.to !== row.from">～{{ number(row.to) }}</template></td>
                                <td>{{ labels[row.role] ?? '全队' }}</td>
                                <td>{{ row.label }}<small v-if="row.event.label">{{ row.event.label }}</small></td>
                                <td>{{ probability(row.event.probability) }}</td>
                                <td>{{ row.event.states.length }}</td>
                                <td v-for="[key] in channel === 'hits' ? damageModes : []" :key="key">{{ number(row.contributions[key]) }}</td>
                                <td class="table-action-col">
                                    <UiButton size="small" :aria-pressed="selectedId === row.event.id" @click.stop="selectEvent(row.event.id)">查看状态</UiButton>
                                </td>
                            </tr>
                            <tr v-if="!visibleEvents.length"><td :colspan="eventColumns.length" class="team-data-empty">{{ locale === 'en' ? 'No Data' : '暂无数据' }}</td></tr>
                        </tbody>
                    </table>
                </div>
                <TeamTablePagination v-if="events.length > pageSize" :model-value="eventPage" :page-size="pageSize" :total="events.length"
                    @update:model-value="changeEventPage" />
                <section v-if="selected" class="event-states">
                    <h4>{{ selected.label }} · 事件状态</h4>
                    <p class="state-context">发生概率 {{ probability(selected.event.probability) }} · 下列概率包含事件发生概率，各行展示同一事件的一种状态。</p>
                    <div class="team-table-scroll state-table" tabindex="0" role="region" aria-label="事件状态">
                        <table class="team-data-table" :style="{ minWidth: tableWidth(stateColumns) }">
                            <colgroup><col v-for="(col, index) in stateColumns" :key="index" :style="{ width: col.width + 'px' }" /></colgroup>
                            <thead>
                                <tr>
                                    <th v-for="(col, index) in stateColumns" :key="index" scope="col">{{ col.label }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in visibleStates" :key="row.state">
                                    <td v-for="(col, index) in stateColumns" :key="index" :class="{ 'table-action-col': !col.value }">
                                        <template v-if="col.value">
                                            {{ col.value(row) }}<small v-if="col.note">{{ col.note(row) }}</small>
                                        </template>
                                        <UiButton v-else size="small" @click="emit('hit-selected', { hit: row.value, probability: row.probability })">伤害构成</UiButton>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <TeamTablePagination v-if="selected.event.states.length > pageSize" v-model="statePage"
                        :page-size="pageSize" :total="selected.event.states.length" />
                </section>
            </TabsContent>
        </TabsRoot>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useI18n } from '@/i18n/i18n'
import TeamTablePagination from './TeamTablePagination.vue'
import { teamEventRows, TEAM_EVENT_CHANNELS, teamProbabilityText } from '../../../beta-data/team-dps-result-view.mjs'

type Column = { label: string; width: number }
type StateColumn = Column & { value?: (row: any) => string | number; note?: (row: any) => string }
const props = defineProps<{ trace: any; labels: string[] }>()
const emit = defineEmits(['hit-selected'])
const { locale } = useI18n()
const channels = TEAM_EVENT_CHANNELS
const channel = ref('hits')
const eventPage = ref(1), statePage = ref(1), selectedId = ref<string | null>(null)
const pageSize = 30
const rows = computed(() => teamEventRows(props.trace))
const events = computed(() => rows.value.filter((row: any) => row.event.channel === channel.value))
const visibleEvents = computed(() => events.value.slice((eventPage.value - 1) * pageSize, eventPage.value * pageSize))
const selected = computed(() => events.value.find((row: any) => row.event.id === selectedId.value))
const visibleStates = computed(() => selected.value?.event.states.slice((statePage.value - 1) * pageSize, statePage.value * pageSize) || [])
const damageModes = [['expectation', '期望贡献'], ['critical', '暴击贡献'], ['non_critical', '非暴击贡献']]
const number = (value: any) => typeof value === 'number' ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'
const expiry = (row: any) => row.stackExpiries ? row.stackExpiries.filter((time: number) => time > row.time).map(number).join(' / ') : number(row.expires)
const probability = teamProbabilityText
const sum = (values: any) => Object.values(values || {}).reduce((n: number, v: any) => n + v, 0)

const eventColumns = computed(() => [
    { label: '时间（秒）', width: 130 }, { label: '角色', width: 100 }, { label: '事件', width: 190 },
    { label: '发生概率', width: 115 }, { label: '状态数', width: 85 },
    ...(channel.value === 'hits' ? damageModes.map(([, label]) => ({ label, width: 115 })) : []),
    { label: '', width: 110 },
])
const stateBaseColumns: StateColumn[] = [
    { label: '状态', width: 75, value: row => row.state + 1 },
    { label: '概率', width: 110, value: row => probability(row.probability) },
    { label: '时间（秒）', width: 105, value: row => number(row.value.time) },
]
const channelColumns = computed<Record<string, StateColumn[]>>(() => ({
    hits: [
        { label: '期望伤害', width: 120, value: row => number(row.value.expectation) },
        { label: '气氛', width: 100, value: row => number(row.value.fanfare) },
        { label: '攻击力 / 生命上限', width: 180, value: row => number(row.value.atk) + ' / ' + number(row.value.hp) },
        { label: '', width: 115 },
    ],
    health: [
        ...props.labels.map((label, role) => ({
            label, width: 175,
            value: (row: any) => number(row.value.hp[role]) + ' / ' + number(row.value.maxHP[role]),
            note: (row: any) => probability(row.value.ratios[role]),
        })),
        { label: '气氛 / 二命溢出', width: 150, value: row => number(row.value.fanfare) + ' / ' + number(row.value.overflow) },
    ],
    heals: [
        { label: '实际治疗', width: 120, value: row => number(row.value.amount) },
        { label: '溢出治疗', width: 120, value: row => number(sum(row.value.overheals)) },
        { label: '清除生命之契', width: 140, value: row => number(sum(row.value.absorbedAmounts)) },
    ],
    effects: [
        { label: '变化', width: 110, value: row => row.value.kind === 'activate' ? '生效 / 刷新' : '消耗' },
        { label: '层数', width: 90, value: row => number(row.value.stacks) },
        { label: '消耗次数', width: 115, value: row => number(row.value.used) },
        { label: '剩余次数', width: 140, value: row => number(row.value.before) + ' → ' + number(row.value.after) },
        { label: '到期时间', width: 120, value: row => expiry(row.value) },
    ],
    resources: [
        { label: '资源', width: 150, value: row => row.value.resource },
        { label: '变化前 / 变化后', width: 160, value: row => number(row.value.before) + ' → ' + number(row.value.after) },
        { label: '变化量', width: 115, value: row => number(row.value.amount) },
    ],
    bonds: [
        { label: '生命之契', width: 140, value: row => number(row.value.amount) },
        { label: '生命上限比例', width: 140, value: row => probability(row.value.ratio) },
    ],
}))
const stateColumns = computed(() => [...stateBaseColumns, ...channelColumns.value[channel.value]])
const tableWidth = (columns: Column[]) => columns.reduce((width, col) => width + col.width, 0) + 'px'

function resetSelection() {
    selectedId.value = null
    eventPage.value = 1
    statePage.value = 1
}
function selectChannel(value: string) {
    channel.value = value
    resetSelection()
}
function changeEventPage(value: number) {
    eventPage.value = value
    selectedId.value = null
}
function selectEvent(id: string) {
    selectedId.value = id
    statePage.value = 1
}
watch(() => props.trace, resetSelection)
</script>

<style scoped>
.dps-events { background: var(--cx-card); border: 1px solid var(--cx-step-2); border-radius: 14px; padding: 18px; min-width: 0; font-variant-numeric: tabular-nums; }
.dps-events h3 { margin: 0 0 8px; }
.dps-events small { display: block; color: var(--cx-dim); margin-top: 4px; }
.event-table { max-height: 440px; }
.state-table { max-height: 430px; }
.team-table-scroll:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.team-data-table { table-layout: fixed; }
.team-data-table td { overflow-wrap: anywhere; }
.table-action-col { white-space: nowrap; }
.table-action-col [aria-pressed="true"] { border-color: var(--cx-gold); }
.event-states { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--cx-step-2); }
.event-states h4 { margin: 0; }
.state-context { color: var(--cx-dim); font-size: 14px; line-height: 1.6; }
@media (max-width: 550px) {
    .dps-events .team-tabs-list { gap: 4px; }
    .dps-events .team-tab { padding-inline: 5px; font-size: 14px; }
}
</style>
