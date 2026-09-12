<template>
    <section class="gain-curve">
        <div class="intro">
            <div class="eyebrow">培养规划 · 当前角色</div>
            <h2>每一条，提升多少？</h2>
            <p>固定当前配装、套装、技能、敌人和已配置的增益，为每个预算独立寻找最高期望伤害。</p>
        </div>

        <div class="controls">
            <label>伤害类型
                <el-select v-model="reaction" aria-label="曲线伤害类型">
                    <el-option v-for="item in reactions" :key="item.key" :value="item.key" :label="item.label" />
                </el-select>
            </label>
            <label>每条强化档位
                <el-select v-model="tier" aria-label="每条强化档位">
                    <el-option value="average" label="五星平均档位" />
                    <el-option value="max" label="五星最高档位" />
                </el-select>
            </label>
            <el-button v-if="!running" type="primary" :disabled="!selectedStats.length || !reaction || tooMany" @click="start">{{ points.length ? '重新计算' : '计算 0～20 条' }}</el-button>
            <el-button v-else @click="cancel">停止计算</el-button>
        </div>
        <div class="stat-selector">
            <span class="field-label">参与最优分配的属性</span>
            <el-checkbox-group v-model="selectedStats" aria-label="参与分配的属性">
                <el-checkbox v-for="stat in STATS" :key="stat.key" :label="stat.key">
                    {{ stat.label }} <span class="roll-value">+{{ formatRoll(stat) }}</span>
                </el-checkbox>
            </el-checkbox-group>
        </div>
        <p class="scope-note">理论额外增加副词条，不消耗或修改库存；不限制实际强化次数、主副词条冲突。队友增益沿用当前手动配置，不自动重新配装。</p>
        <el-alert v-if="tooMany" type="warning" :closable="false" title="组合超过 100 万，请减少参与分配的属性；不会用截断搜索冒充最优结果。" />
        <el-alert v-if="error" type="error" :closable="false" :title="error" />
        <div class="progress-line" role="status" aria-live="polite">
            <span>{{ status }}</span><span>{{ evaluations.toLocaleString() }} / {{ combinations.toLocaleString() }} 种组合</span>
        </div>
        <el-progress v-if="running" :percentage="Math.round((points.length - 1) / 20 * 100)" :show-text="false" />

        <template v-if="points.length">
            <div class="summary">
                <div><span>当前期望伤害</span><strong>{{ number(points[0].damage) }}</strong></div>
                <div><span>增加 {{ activePoint.rolls }} 条后</span><strong>{{ number(activePoint.damage) }}</strong></div>
                <div><span>累计提升</span><strong class="accent">{{ percent(activePoint.gain) }}</strong></div>
                <div><span>相比少一条的最优伤害</span><strong>{{ signed(activePoint.marginal) }}</strong></div>
            </div>
            <div class="chart-heading">
                <span>最优收益曲线</span>
                <el-radio-group v-model="metric" size="small" aria-label="纵轴显示">
                    <el-radio-button label="gain">提升百分比</el-radio-button>
                    <el-radio-button label="damage">期望伤害</el-radio-button>
                </el-radio-group>
            </div>
            <p v-if="points[0].damage === 0" class="scope-note">当前伤害为 0，无法定义百分比提升，请切换到期望伤害查看。</p>
            <v-chart class="main-chart" :option="chartOptions" autoresize @click="selectChartPoint" />
            <div class="chart-heading"><span>多投入一条的收益</span><small>相邻预算的最优伤害差</small></div>
            <v-chart class="marginal-chart" :option="marginalOptions" autoresize @click="selectChartPoint" />

            <div class="allocation">
                <div class="chart-heading"><strong>增加 {{ activePoint.rolls }} 条 · 最优分配</strong><small>点击曲线或拖动滑块查看</small></div>
                <el-slider v-model="activeBudget" :min="0" :max="points.length - 1" :step="1" show-stops aria-label="查看词条预算" />
                <div class="allocation-tags">
                    <el-tag v-for="stat in activeStats" :key="stat.key" size="large">{{ stat.label }} × {{ activePoint.allocation[stat.key] }}（+{{ formatRoll(stat, activePoint.allocation[stat.key]) }}）</el-tag>
                    <span v-if="!activeStats.length">当前配装，尚未增加词条。</span>
                </div>
                <p class="scope-note">每个预算独立求最优。下一点的最佳分配可能重新调整已有分配，并非上一点只追加一条。</p>
                <el-table :data="panelRows" size="small">
                    <el-table-column prop="label" label="面板属性" />
                    <el-table-column prop="before" label="当前" />
                    <el-table-column prop="after" label="增加后" />
                </el-table>
            </div>
            <div class="footer"><span>仅对勾选属性、当前技能和已配置条件保证枚举最优。</span><el-button :disabled="!complete" @click="exportResults">导出完整结果 JSON</el-button></div>
        </template>
        <el-empty v-else-if="!running && !error" description="选择参与分配的属性，查看 0～20 条的培养收益。" />
    </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkPointComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { STATS, combinationCount, rollValue } from '@/algorithms/stat-gain/curve.mjs'

use([LineChart, BarChart, GridComponent, TooltipComponent, MarkPointComponent, CanvasRenderer])
const props = defineProps({ input: { type: Object, required: true }, analysis: { type: Object, required: true }, fumo: { type: String, default: 'None' } })
const reactionLabels = { normal: '普通伤害 / 治疗', melt: '融化', vaporize: '蒸发', spread: '蔓激化', aggravate: '超激化', moonfall: '月落', moonelectro: '月感电', mooncrystallize: '月结晶', direct_moonelectro: '直接月感电', direct_moonbloom: '直接月绽放', direct_mooncrystallize: '直接月结晶', direct_stellarconduct: '星超导', direct_stellarswirl: '星扩散' }
const reactions = computed(() => Object.entries(props.analysis).filter(([, v]) => v && typeof v === 'object' && Number.isFinite(v.expectation)).map(([key]) => ({ key, label: reactionLabels[key] || key })))
const reaction = ref('')
function chooseReaction() {
    const positive = reactions.value.filter(r => props.analysis[r.key].expectation > 0)
    reaction.value = positive.find(r => r.key === 'direct_stellarconduct')?.key || positive[0]?.key || reactions.value[0]?.key || ''
}
chooseReaction()
const tier = ref('average')
const selectedStats = ref(['CriticalRate', 'CriticalDamage', 'ATKPercentage', 'ElementalMastery'])
const points = ref([]), evaluations = ref(0), running = ref(false), complete = ref(false), error = ref(''), status = ref('准备计算')
const activeBudget = ref(0), metric = ref('gain')
let worker = null, snapshot = null
const combinations = computed(() => combinationCount(20, selectedStats.value.length))
const tooMany = computed(() => combinations.value > 1000000)
const activePoint = computed(() => points.value[Math.min(activeBudget.value, points.value.length - 1)])
const activeStats = computed(() => STATS.filter(s => activePoint.value?.allocation[s.key] > 0))
const number = value => Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'
const signed = value => `${value > 0 ? '+' : ''}${number(value)}`
const percent = value => value === null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
const formatRoll = (stat, count = 1) => `${number(rollValue(stat, tier.value) * count * (stat.percent ? 100 : 1))}${stat.percent ? '%' : ''}`
const allocationText = point => STATS.filter(s => point.allocation[s.key]).map(s => `${s.label} × ${point.allocation[s.key]}`).join('、') || '当前配装'
function stopWorker() { worker?.terminate(); worker = null; running.value = false }
function cancel() { stopWorker(); complete.value = false; status.value = `已停止 · 已完成 ${Math.max(0, points.value.length - 1)}/20 条预算` }
function invalidate() {
    stopWorker(); points.value = []; evaluations.value = 0; activeBudget.value = 0; complete.value = false; error.value = ''; status.value = '配置已变更，请重新计算'
}
watch([selectedStats, tier, reaction], invalidate, { deep: true, flush: 'sync' })
watch(() => [props.input, props.fumo], () => { invalidate(); chooseReaction() }, { deep: true })
function start() {
    invalidate()
    if (!selectedStats.value.length || !reaction.value || tooMany.value) return
    snapshot = JSON.parse(JSON.stringify({ input: props.input, reaction: reaction.value, fumo: props.fumo, options: { stats: selectedStats.value, tier: tier.value, maxRolls: 20 } }))
    running.value = true; status.value = '正在载入计算核心…'
    const currentWorker = new Worker(new URL('../../workers/stat_gain.worker.js', import.meta.url))
    worker = currentWorker
    currentWorker.onmessage = ({ data }) => {
        if (worker !== currentWorker) return
        if (data.type === 'progress') {
            points.value.push(data.point); evaluations.value = data.evaluations; activeBudget.value = data.point.rolls
            status.value = `正在计算 · 已完成 ${data.point.rolls}/20 条预算`
        } else if (data.type === 'done') {
            evaluations.value = data.evaluations; complete.value = true; status.value = '计算完成 · 0～20 条均已完整枚举'; stopWorker()
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
        lineStyle: { width: 3, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: '#3b82f6', opacity: .09 },
        data: points.value.map(p => metric.value === 'gain' ? (p.gain === null ? null : p.gain * 100) : p.damage) }],
}))
const marginalOptions = computed(() => ({
    animation: false, grid: { left: 70, right: 32, top: 28, bottom: 30 },
    tooltip: { trigger: 'axis', formatter: params => { const p = points.value[params[0]?.dataIndex]; return p ? `第 ${p.rolls} 条的边际收益：${signed(p.marginal)}` : '' } },
    xAxis: { type: 'category', data: points.value.map(p => p.rolls) },
    yAxis: { type: 'value', name: '额外伤害' },
    series: [{ type: 'bar', data: points.value.map(p => p.marginal), itemStyle: { color: '#79b5f8', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 24 }],
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
.gain-curve { color: #24344b; }
.intro { margin-bottom: 24px; h2 { margin: 6px 0 10px; font-size: 26px; font-weight: 650; } p { margin: 0; color: #67788d; line-height: 1.7; } }
.eyebrow { color: #3b82f6; font-size: 12px; letter-spacing: 2px; }
.controls { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 16px; label { display: flex; flex-direction: column; gap: 8px; font-size: 13px; } }
.stat-selector { margin-top: 20px; padding: 16px; border: 1px solid #e6edf5; border-radius: 8px; }
.field-label { display: block; font-size: 13px; margin-bottom: 6px; font-weight: 600; }
.roll-value { color: #8592a3; font-size: 11px; }
.scope-note { font-size: 12px; color: #7a8797; line-height: 1.7; }
.progress-line, .chart-heading, .footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.progress-line { font-size: 12px; color: #7a8797; margin: 18px 0 8px; }
.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 22px 0; div { background: #f5f8fd; border-radius: 8px; padding: 16px; } span { display: block; color: #7a8797; font-size: 12px; margin-bottom: 10px; } strong { font-size: 23px; } .accent { color: #287bdb; } }
.chart-heading { font-size: 14px; font-weight: 600; small { font-size: 12px; color: #8b97a6; font-weight: normal; } }
.main-chart { height: 310px; }
.marginal-chart { height: 170px; }
.allocation { border-top: 1px solid #e6edf5; padding-top: 20px; margin-top: 16px; }
.allocation-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.footer { border-top: 1px solid #e6edf5; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #8b97a6; }
@media (max-width: 700px) { .summary { grid-template-columns: repeat(2, 1fr); } .controls { gap: 10px; } .footer, .chart-heading { flex-wrap: wrap; } }
</style>
