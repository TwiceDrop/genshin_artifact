<template>
    <div class="root">
        <div class="chart-div">
            <v-chart :option="chartOptionForEChart" :autoresize="true"></v-chart>
        </div>
        <div class="table-div">
            <div class="stats-table-scroll" tabindex="0" :aria-label="t('misc.stat')">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th scope="col"><UiCheckbox :label="t('misc.stat')" :model-value="selectionState"
                                :disabled="!rows.length" @update:model-value="toggleAllRows" /></th>
                            <th scope="col">{{ t('misc.stat') }}</th>
                            <th scope="col">{{ t('misc.value') }}</th>
                            <th scope="col">{{ t('misc.stat1') }}</th>
                            <th scope="col">{{ t('misc.rollCount') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in rows" :key="row.name" :class="{ selected: selection.includes(row) }">
                            <td><UiCheckbox :label="row.title" :model-value="selection.includes(row)"
                                @update:model-value="checked => selectRow(row, checked)" /></td>
                            <th scope="row">{{ row.title }}</th>
                            <td>{{ row.percentage ? `${(row.value * 100).toFixed(1)}%` : row.value.toFixed(0) }}</td>
                            <td>{{ row.eff.toFixed(3) }}</td>
                            <td>[{{ row.upgradeCount[0] }}, {{ row.upgradeCount[1] }}]</td>
                        </tr>
                        <tr v-if="!rows.length"><td colspan="5" class="empty-stats">{{ locale === 'en' ? 'No Data' : '暂无数据' }}</td></tr>
                    </tbody>
                </table>
            </div>
            <p class="selection-summary">{{ t("misc.selected") }}: {{ selectedEff.toFixed(1) }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { howManyUpgradeCount } from "@/utils/artifacts"
import { artifactTags, artifactEff } from "@/constants/artifact"
import {useArtifactStore} from "@/store/pinia/artifact"
import type {IArtifact} from "@/types/artifact"
import {useI18n} from "@/i18n/i18n"
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import { use } from "echarts/core"
import { PieChart } from "echarts/charts"
import {
    TooltipComponent,
    VisualMapComponent,
    LegendComponent,
    TitleComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

use([
    CanvasRenderer,
    PieChart,
    VisualMapComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
])
import VChart from "vue-echarts"


const { t, locale } = useI18n()

interface Props {
    artifactIds: number[]
}

const props = defineProps<Props>()


interface StatData {
    name: string,
    upgradeCount: [number, number],
    value: number,
    title: string,
    eff: number,
    percentage: boolean
}

const artifactStore = useArtifactStore()

const artifacts = computed((): IArtifact[] => {
    const arr = []
    for (let id of props.artifactIds) {
        let maybeArtifact = artifactStore.artifacts.value.get(id)
        if (maybeArtifact) {
            arr.push(maybeArtifact)
        }
    }

    return arr
})

const statData = computed((): Record<string, StatData> => {
    let result: Record<string, StatData> = {}

    for (let artifact of artifacts.value) {
        const star = artifact.star ?? 5
        if (star <= 3) {
            continue
        }

        for (let stat of artifact.normalTags) {
            const name = stat.name
            const value = stat.value

            const [min, max] = howManyUpgradeCount(value, name, star)
            const eff = value / artifactEff[star][name][3]

            if (!Object.prototype.hasOwnProperty.call(result, name)) {
                result[name] = {
                    name,
                    upgradeCount: [min, max],
                    value,
                    // chs: artifactTags[name].chs,
                    title: t("stat", name),
                    eff,
                    percentage: artifactTags[name].percentage
                }
            } else {
                let temp = result[name]
                temp.upgradeCount[0] += min
                temp.upgradeCount[1] += max
                temp.value += value
                temp.eff += eff
            }
        }
    }

    return result
})

const chartOptionForEChart = computed(() => {
    let data = [];
    for (let name in statData.value) {
        data.push({
            value: statData.value[name].eff,
            // name: statData.value[name].chs
            name: statData.value[name].title
        })
    }
    data.sort((a, b) => a.value - b.value)

    return {
        tooltip: {
            trigger: "item",
            formatter: (params: any) => {
                // console.log(params)
                const value = params.value
                const p = params.percent

                return `${value.toFixed(1)}/${p.toFixed(0)}%`
            },
            // backgroundColor: 'rgb(236, 245, 255)'
        },
        visualMap: {
            show: false,
            min: 0,
            max: 25,
            inRange: {
                colorLightness: [0.3, 1]
            }
        },
        // roseType: 'area',
        // radius: "55%",
        // legend: {
        //     orient: "vertical",
        //     left: "left",
        // },
        series: [
            {
                name: "有效词条分布",
                type: "pie",
                // radius: ["40%", "70%"],
                label: {
                    // show: false
                },
                // itemStyle: {
                //     borderRadius: 5,
                //     borderColor: '#fff',
                //     borderWidth: 2
                // },
                itemStyle: {
                    color: '#c23531',
                    // shadowBlur: 200,
                    // shadowColor: 'rgba(0, 0, 0, 0.5)'
                },
                data,
            }
        ]
    }
})

const rows = computed((): StatData[] => {
    let data = []

    for (let key in statData.value) {
        data.push(statData.value[key])
    }

    data.sort((a, b) => b.eff - a.eff)
    // data.sort((a, b) => a.chs.localeCompare(b.chs))

    return data
})

const selection = ref<StatData[]>([])
const selectionState = computed(() => {
    if (!selection.value.length) return false
    return selection.value.length === rows.value.length ? true : 'indeterminate'
})

watch(rows, () => { selection.value = [] })

function selectRow(row: StatData, checked: boolean) {
    selection.value = checked ? [...selection.value, row] : selection.value.filter(item => item !== row)
}

function toggleAllRows() {
    selection.value = selectionState.value === true ? [] : [...rows.value]
}

const selectedEff = computed(() => {
    let sum = 0
    for (let row of selection.value) {
        sum += row.eff
    }
    return sum
})


</script>

<style scoped lang="scss">
.table-div { min-width: 0; }
.stats-table-scroll { overflow: auto; border: 1px solid var(--cx-step-2); border-radius: 8px; }
.stats-table-scroll:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.stats-table { width: 100%; border-collapse: collapse; min-width: 350px; font-size: 13px; }
.stats-table :is(th, td) { padding: 8px 10px; border-bottom: 1px solid var(--cx-step-2); text-align: start; }
.stats-table thead { background: var(--cx-step); }
.stats-table tbody tr:last-child > * { border-bottom: 0; }
.stats-table tbody tr.selected { background: color-mix(in srgb, var(--cx-gold) 12%, var(--cx-card)); }
.stats-table tbody td:nth-child(n+3) { font-variant-numeric: tabular-nums; }
.stats-table .empty-stats { padding: 24px 10px; text-align: center; color: var(--cx-dim); }
.selection-summary { font-size: 12px; }
@media only screen and (min-width: 992px) {
    .root {
        display: flex;
        gap: 20px;

        .table-div {
            flex-grow: 1;
        }

        .chart-div {
            width: 400px;
            height: 300px;
        }
    }
}

@media only screen and (max-width: 992px) {
    .root {
        .table-div {
            //flex-grow: 1;
        }

        .chart-div {
            width: 100%;
            height: 200px;
        }
    }
}

</style>
