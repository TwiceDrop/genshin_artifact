<template>
    <section class="gain-curve">
        <div class="intro">
            <div class="eyebrow">培养规划 · 当前角色</div>
            <h2>每一条，提升多少？</h2>
        </div>

        <div class="controls">
            <div class="curve-field"><span>伤害类型</span><UiSelect v-model="reaction" label="曲线伤害类型" :options="reactionOptions" /></div>
            <div class="curve-field"><span>每条强化档位</span><UiSelect v-model="tier" label="每条强化档位" :options="tierOptions" /></div>
            <UiButton v-if="!running" variant="primary" :disabled="!selectedStats.length || !reaction || tooMany" @click="start">{{ points.length ? '重新计算' : '计算 0～20 条' }}</UiButton>
            <UiButton v-else @click="cancel">停止计算</UiButton>
        </div>
        <div class="stat-selector">
            <span class="field-label">参与最优分配的属性</span>
            <div class="curve-stat-options" role="group" aria-label="参与分配的属性">
                <UiCheckbox v-for="stat in STATS" :key="stat.key" :label="`${stat.label} +${formatRoll(stat)}`" :model-value="selectedStats.includes(stat.key)"
                    @update:model-value="checked => toggleStat(stat.key, checked)">
                    {{ stat.label }} <span class="roll-value">+{{ formatRoll(stat) }}</span>
                </UiCheckbox>
            </div>
        </div>
        <p v-if="error" class="curve-error" role="alert">{{ error }}</p>
        <div class="progress-line" role="status" aria-live="polite">
            <span>{{ status }}</span><span>{{ evaluations.toLocaleString() }} / {{ combinations.toLocaleString() }} 种组合</span>
        </div>
        <ProgressRoot v-if="running" class="curve-progress" :model-value="stepsComplete" :max="20" aria-label="最优收益曲线">
            <ProgressIndicator class="curve-progress-fill" :style="{ width: `${stepsComplete * 5}%` }" />
        </ProgressRoot>

        <template v-if="points.length">
            <div class="summary">
                <div><span>当前期望伤害</span><strong>{{ number(points[0].damage) }}</strong></div>
                <div><span>增加 {{ activePoint.rolls }} 条后</span><strong>{{ number(activePoint.damage) }}</strong></div>
                <div><span>累计提升</span><strong class="accent">{{ percent(activePoint.gain) }}</strong></div>
                <div><span>相比少一条的最优伤害</span><strong>{{ signed(activePoint.marginal) }}</strong></div>
            </div>
            <div class="chart-heading">
                <span>最优收益曲线</span>
                <UiSegmentedControl v-model="metric" label="纵轴显示" :options="metricOptions" />
            </div>
            <v-chart class="main-chart" :option="chartOptions" autoresize @click="selectChartPoint" />
            <div class="chart-heading"><span>多投入一条的收益</span></div>
            <v-chart class="marginal-chart" :option="marginalOptions" autoresize @click="selectChartPoint" />

            <div class="allocation">
                <div class="chart-heading"><strong>增加 {{ activePoint.rolls }} 条 · 最优分配</strong></div>
                <UiSlider v-if="points.length > 1" v-model="activeBudget" label="查看词条预算" :min="0" :max="points.length - 1" :step="1"
                    class="curve-budget-slider" :style="{ '--curve-budget-step': `${100 / (points.length - 1)}%` }" />
                <div class="allocation-tags">
                    <span v-for="stat in activeStats" :key="stat.key" class="allocation-tag">{{ stat.label }} × {{ activePoint.allocation[stat.key] }}（+{{ formatRoll(stat, activePoint.allocation[stat.key]) }}）</span>
                    <span v-if="!activeStats.length">当前配装，尚未增加词条。</span>
                </div>
                <div class="panel-table-scroll" tabindex="0" aria-label="面板属性">
                    <table class="curve-panel-table">
                        <thead><tr><th scope="col">面板属性</th><th scope="col">当前</th><th scope="col">增加后</th></tr></thead>
                        <tbody><tr v-for="row in panelRows" :key="row.label"><th scope="row">{{ row.label }}</th><td>{{ row.before }}</td><td>{{ row.after }}</td></tr></tbody>
                    </table>
                </div>
            </div>
            <div class="footer"><UiButton :disabled="!complete" @click="exportResults">导出完整结果 JSON</UiButton></div>
        </template>
    </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ProgressIndicator, ProgressRoot } from 'radix-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkPointComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { STATS, combinationCount, rollValue } from '@/algorithms/stat-gain/curve.mjs'
import { damageReactionOptions, defaultDamageReaction } from '@/algorithms/reaction-labels.mjs'
import { statGainCache } from '@/store/stat-gain-cache'
import { darkMode } from '@/styles/color-mode.mjs'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSlider from '@/components/ui/UiSlider.vue'

use([LineChart, BarChart, GridComponent, TooltipComponent, MarkPointComponent, CanvasRenderer])
const props = defineProps({ input: { type: Object, required: true }, analysis: { type: Object, required: true }, fumo: { type: String, default: 'None' }, accountId: { type: Number, required: true } })
const reactionOptions = computed(() => damageReactionOptions(props.analysis).map(({ key, label }) => ({ value: key, label })))
const tierOptions = [
    { value: 'average', label: '五星平均档位' },
    { value: 'max', label: '五星最高档位' },
]
const metricOptions = [
    { value: 'gain', label: '提升百分比' },
    { value: 'damage', label: '期望伤害' },
]
const reaction = ref('')
function chooseReaction() {
    reaction.value = defaultDamageReaction(props.analysis)
}
chooseReaction()
const tier = ref('average')
const selectedStats = ref(['CriticalRate', 'CriticalDamage', 'ATKPercentage', 'ElementalMastery'])
const points = ref([]), evaluations = ref(0), running = ref(false), complete = ref(false), error = ref(''), status = ref('准备计算')
const stepsComplete = computed(() => Math.max(0, points.value.length - 1))
const activeBudget = ref(0), metric = ref('gain')
let worker = null, snapshot = null, generation = 0
const combinations = computed(() => combinationCount(20, selectedStats.value.length))
const tooMany = computed(() => combinations.value > 1000000)
const activePoint = computed(() => points.value[Math.min(activeBudget.value, points.value.length - 1)])
const activeStats = computed(() => STATS.filter(s => activePoint.value?.allocation[s.key] > 0))
const number = value => Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'
const signed = value => `${value > 0 ? '+' : ''}${number(value)}`
const percent = value => value === null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
const formatRoll = (stat, count = 1) => `${number(rollValue(stat, tier.value) * count * (stat.percent ? 100 : 1))}${stat.percent ? '%' : ''}`
function toggleStat(key, checked) {
    selectedStats.value = checked ? [...selectedStats.value, key] : selectedStats.value.filter(stat => stat !== key)
}
const allocationText = point => STATS.filter(s => point.allocation[s.key]).map(s => `${s.label} × ${point.allocation[s.key]}`).join('、') || '当前配装'
function stopWorker() { generation++; worker?.terminate(); worker = null; running.value = false }
function cancel() { stopWorker(); complete.value = false; status.value = `已停止 · 已完成 ${Math.max(0, points.value.length - 1)}/20 条预算` }
function invalidate() {
    stopWorker(); points.value = []; evaluations.value = 0; activeBudget.value = 0; complete.value = false; error.value = ''; status.value = '配置已变更，请重新计算'
}
watch([selectedStats, tier, reaction], invalidate, { deep: true, flush: 'sync' })
watch(() => [props.input, props.fumo, props.accountId], () => { invalidate(); chooseReaction() }, { deep: true })
async function start() {
    invalidate()
    if (!selectedStats.value.length || !reaction.value || tooMany.value) return
    snapshot = JSON.parse(JSON.stringify({ input: props.input, reaction: reaction.value, fumo: props.fumo, options: { stats: selectedStats.value, tier: tier.value, maxRolls: 20 } }))
    const key = JSON.stringify(snapshot)
    const request = generation
    running.value = true; status.value = '正在载入计算核心…'
    let cache
    try { cache = await statGainCache.open(props.accountId) }
    catch (e) { if (request === generation) { error.value = e.message || String(e); status.value = '计算失败'; stopWorker() }; return }
    if (request !== generation) return
    const cached = cache.get(key)
    if (cached) {
        points.value = JSON.parse(JSON.stringify(cached.points)); evaluations.value = cached.evaluations; activeBudget.value = 20
        complete.value = true; status.value = '计算完成 · 0～20 条均已完整枚举'
        stopWorker()
        return
    }
    const currentWorker = new Worker(new URL('../../workers/stat_gain.worker.js', import.meta.url))
    worker = currentWorker
    currentWorker.onmessage = ({ data }) => {
        if (worker !== currentWorker) return
        if (data.type === 'progress') {
            points.value.push(data.point); evaluations.value = data.evaluations; activeBudget.value = data.point.rolls
            status.value = `正在计算 · 已完成 ${data.point.rolls}/20 条预算`
        } else if (data.type === 'done') {
            evaluations.value = data.evaluations; complete.value = true; status.value = '计算完成 · 0～20 条均已完整枚举'; stopWorker()
            try { cache.set(key, { points: JSON.parse(JSON.stringify(points.value)), evaluations: data.evaluations }) }
            catch (e) { error.value = e.message || String(e) }
        } else if (data.type === 'error') {
            error.value = data.message; status.value = '计算失败，结果不完整'; stopWorker()
        }
    }
    currentWorker.onerror = event => { if (worker === currentWorker) { error.value = event.message || '计算线程加载失败'; status.value = '计算失败'; stopWorker() } }
    currentWorker.postMessage(snapshot)
}
onMounted(start)
onBeforeUnmount(stopWorker)
function selectChartPoint(event) { if (Number.isInteger(event.dataIndex)) activeBudget.value = event.dataIndex }
const readChartGold = () => getComputedStyle(document.documentElement).getPropertyValue('--cx-gold').trim()
const chartGold = ref(readChartGold())
watch(darkMode, () => { chartGold.value = readChartGold() }, { flush: 'post' })
const chartOptions = computed(() => ({
    animation: false,
    grid: { left: 70, right: 32, top: 36, bottom: 40 },
    tooltip: { trigger: 'axis', formatter: params => {
        const point = points.value[params[0]?.dataIndex]
        return point ? `增加 ${point.rolls} 条<br/>最高期望伤害：${number(point.damage)}<br/>累计提升：${percent(point.gain)}<br/>${allocationText(point)}` : ''
    } },
    xAxis: { type: 'category', data: points.value.map(p => p.rolls), name: '词条', boundaryGap: false },
    yAxis: { type: 'value', name: metric.value === 'gain' ? '累计提升 (%)' : '期望伤害', axisLabel: { formatter: value => number(value) } },
    series: [{ name: '最优收益', type: 'line', smooth: false, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: 3, color: chartGold.value }, itemStyle: { color: chartGold.value }, areaStyle: { color: chartGold.value, opacity: .09 },
        data: points.value.map(p => metric.value === 'gain' ? (p.gain === null ? null : p.gain * 100) : p.damage) }],
}))
const marginalOptions = computed(() => ({
    animation: false, grid: { left: 70, right: 32, top: 28, bottom: 30 },
    tooltip: { trigger: 'axis', formatter: params => { const p = points.value[params[0]?.dataIndex]; return p ? `第 ${p.rolls} 条的边际收益：${signed(p.marginal)}` : '' } },
    xAxis: { type: 'category', data: points.value.map(p => p.rolls) },
    yAxis: { type: 'value', name: '额外伤害' },
    series: [{ type: 'bar', data: points.value.map(p => p.marginal), itemStyle: { color: chartGold.value, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 24 }],
}))
const panelRows = computed(() => {
    if (!activePoint.value) return []
    const labels = { atk: '攻击力', hp: '生命值', def: '防御力', elemental_mastery: '元素精通', critical: '暴击率', critical_damage: '暴击伤害', recharge: '元素充能效率' }
    return Object.entries(labels).map(([key, label]) => {
        const percentage = ['critical', 'critical_damage', 'recharge'].includes(key)
        const format = value => percentage ? `${number(value * 100)}%` : number(value)
        return { label, before: format(points.value[0].panel?.[key]), after: format(activePoint.value.panel?.[key]) }
    })
})
function exportResults() {
    if (!complete.value) return
    const blob = new Blob([JSON.stringify({ ...snapshot, points: points.value, evaluations: evaluations.value, model: 'theoretical-extra-substats', exactWithinSelectedStats: true }, null, 2)], { type: 'application/json' })
    import('@/platform/native.mjs').then(async ({ saveText }) => saveText(await blob.text(), 'application/json', 'mona-stat-gain-curve.json')).catch(e => { error.value = e.message })
}
</script>

<style scoped lang="scss">
.gain-curve { color: var(--cx-letter); }
.intro { margin-bottom: 24px; h2 { margin: 6px 0 10px; font-size: 26px; font-weight: 650; } p { margin: 0; color: var(--cx-dim); line-height: 1.7; } }
.eyebrow { color: var(--cx-gold); font-size: 12px; letter-spacing: 2px; }
.controls { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.curve-field { display: grid; gap: 8px; min-width: 0; max-width: 100%; font-size: 13px; }
.curve-field :deep(.select-trigger) { min-width: 0; }
.stat-selector { margin-top: 20px; padding: 16px; border: 1px solid var(--cx-step-2); border-radius: 8px; }
.curve-stat-options { display: flex; flex-wrap: wrap; gap: 10px 16px; }
.field-label { display: block; font-size: 13px; margin-bottom: 6px; font-weight: 600; }
.roll-value { color: var(--cx-dim); font-size: 11px; }
.curve-error { overflow-wrap: anywhere; padding: 10px 12px; border: 1px solid var(--cx-up); border-radius: 8px; color: var(--cx-up); }
.progress-line, .chart-heading, .footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.progress-line { font-size: 12px; color: var(--cx-dim); margin: 18px 0 8px; }
.curve-progress { height: 5px; overflow: hidden; border-radius: 999px; background: var(--cx-step-2); }
.curve-progress-fill { height: 100%; background: var(--cx-gold); }
.summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0; div { background: var(--cx-step); border-radius: 8px; padding: 16px; } span { display: block; color: var(--cx-dim); font-size: 12px; margin-bottom: 10px; } strong { font-size: 23px; overflow-wrap: anywhere; } .accent { color: var(--cx-gold); } }
.chart-heading { font-size: 14px; font-weight: 600; small { font-size: 12px; color: var(--cx-dim); font-weight: normal; } }
.main-chart { height: 310px; }
.marginal-chart { height: 170px; }
.allocation { border-top: 1px solid var(--cx-step-2); padding-top: 20px; margin-top: 16px; }
.curve-budget-slider :deep(.ui-slider-track) { background-image: repeating-linear-gradient(to right, var(--cx-dim) 0 1px, transparent 1px var(--curve-budget-step)); }
.allocation-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.allocation-tag { padding: 4px 8px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); color: var(--cx-gold); font-size: 13px; }
.panel-table-scroll { overflow: auto; border: 1px solid var(--cx-step-2); border-radius: 8px; }
.panel-table-scroll:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.curve-panel-table { width: 100%; border-collapse: collapse; min-width: 260px; font-size: 13px; }
.curve-panel-table :is(th, td) { padding: 8px 10px; border-bottom: 1px solid var(--cx-step-2); text-align: start; }
.curve-panel-table thead { background: var(--cx-step); }
.curve-panel-table tbody tr:last-child > * { border-bottom: 0; }
.curve-panel-table td { font-variant-numeric: tabular-nums; }
.footer { border-top: 1px solid var(--cx-step-2); padding-top: 16px; margin-top: 20px; font-size: 12px; color: var(--cx-dim); }
@media (max-width: 700px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .controls { gap: 10px; } .footer, .chart-heading { flex-wrap: wrap; } }
</style>
