<template>
    <div class="lunar-detail">
        <DamageMetrics v-if="shadcn" :result="calculation.result" :format="format" />
        <el-descriptions v-else :column="3" border>
            <el-descriptions-item v-for="[key, label] in metrics" :key="key" :label="label">
                {{ format(calculation.result[key]) }}
            </el-descriptions-item>
        </el-descriptions>
        <dl v-if="!state.archivedHarmony" class="stages">
            <div v-for="[key, label] in stages" :key="key">
                <dt>{{ label }}</dt><dd>{{ format(calculation[key]) }}</dd>
            </div>
            <div v-if="calculation.observed !== undefined"><dt>本次命中暴击占比</dt><dd>{{ format(calculation.observed * 100) }}%</dd></div>
        </dl>
        <template v-for="section in sections" :key="section.label">
            <section v-if="section.columns.length">
                <h3>{{ section.label }}</h3>
                <div class="columns">
                    <template v-for="column in section.columns" :key="column.title">
                        <div v-if="state.archivedHarmony" class="archive-column">
                            <strong>{{ column.title }}</strong>
                            <div v-for="row in column.rows" :key="row.name">{{ row.name }} · {{ format(row.value) }}</div>
                        </div>
                        <damage-analysis-util v-else :title="column.title" :arr="column.rows" :precision="4" />
                    </template>
                </div>
            </section>
        </template>
        <section v-if="calculation.contributions">
            <h3>月笼谐奏 · 本角色贡献</h3>
            <table><thead><tr><th>结算权重</th><th>额外固定伤害</th><th>排名前期望</th><th>排名后非暴击</th><th>排名后暴击</th><th>排名后期望</th></tr></thead>
                <tbody><tr v-for="(entry, i) in calculation.contributions" :key="i">
                    <td>{{ format(entry.weight * 100) }}%</td><td>{{ format(entry.flat) }}</td>
                    <td>{{ format(entry.own.expectation) }}</td>
                    <td v-for="key in ['non_critical','critical','expectation']" :key="key">{{ format(entry.ranked[key]) }}</td>
                </tr></tbody>
            </table>
            <details v-for="(entry, i) in calculation.contributions" :key="i">
                <summary>参与者贡献 · 权重 {{ format(entry.weight * 100) }}%</summary>
                <table><thead><tr><th>队伍位置</th><th>暴击率</th><th>排名前非暴击</th><th>排名前暴击</th><th>排名后期望</th></tr></thead>
                    <tbody><tr v-for="row in entry.members" :key="row.role">
                        <td>{{ row.role + 1 }} 号位</td><td>{{ format(row.cr * 100) }}%</td>
                        <td>{{ format(row.non_critical) }}</td><td>{{ format(row.critical) }}</td><td>{{ format(row.ranked.expectation) }}</td>
                    </tr></tbody>
                </table>
            </details>
        </section>
    </div>
</template>

<script setup>
import {computed, inject} from 'vue'
import DamageAnalysisUtil from './DamageAnalysisUtil.vue'
import DamageMetrics from './DamageMetrics.vue'
const props = defineProps({state: Object, calculation: Object})
const shadcn = computed(inject('isShadcnDamageAnalysis', () => false))
const metrics = [['expectation', '期望伤害'], ['critical', '暴击伤害'], ['non_critical', '非暴击伤害']]
const stages = [['base', '基础伤害'], ['mastery', '元素精通增伤'], ['amplified', '加成后本体'], ['flat', '固定伤害合计'], ['res', '抗性乘区'], ['elevation', '擢升乘区']]
const layout = [
    ['基础伤害', ['scaling','level','ratio','coefficient','baseFlat','veil','baseBonus']],
    ['伤害加成', ['em','bonus','commonBonus','independent']],
    ['额外固定伤害', ['flat','commonFlat','emRatio','def','defRatio']],
    ['暴击', ['critical','criticalDamage','familyCritical','familyCriticalDamage','moonCritical','moonCriticalDamage']],
    ['抗性与擢升', ['resistance','resMinus','elevation','commonElevation']],
]
const sections = computed(() => layout.map(([label, keys]) => ({
    label, columns: keys.map(key => props.state.groups[key]).filter(group => group?.rows.length),
})))
const format = value => value.toLocaleString('zh-CN', {maximumFractionDigits: 4})
</script>

<style scoped>
.lunar-detail { overflow-x: auto; }
.stages, .columns { display: flex; flex-wrap: wrap; gap: 1px; }
.stages { gap: 16px 24px; margin: 14px 0; }
.stages dt { font-size: .85em; }
.stages dd { margin: 2px 0; font-variant-numeric: tabular-nums; }
h3 { margin: 12px 0 4px; font-size: 1em; }
.columns > div { width: 145px; }
.columns :deep(.input) { color: var(--el-text-color-primary); background: var(--el-fill-color-extra-light); border: 1px solid var(--el-border-color-lighter); }
.columns :deep(.header) { text-align: center; line-height: 32px; }
.columns :deep(.el-checkbox) { height: auto; white-space: normal; }
.columns :deep(.el-checkbox__label) { white-space: normal; overflow-wrap: anywhere; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 4px 10px; text-align: right; }
</style>
