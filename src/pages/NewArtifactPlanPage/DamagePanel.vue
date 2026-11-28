<template>
    <div>
        <!-- 计算器伤害卡用的大字布局：第一行（直伤或治疗）放大，其余反应行列在下面 -->
        <div v-if="layout === 'feature' && tableData.length" class="damage-feature">
            <div class="feature-main">
                <span class="feature-label">{{ t('dmg.expect') }}</span>
                <span v-if="tableData[0].expectation.before !== null" class="feature-before">{{ tableData[0].expectation.before }} →</span>
                <span class="feature-number" :class="tableData[0].expectation.direction">{{ tableData[0].expectation.current }}</span>
                <span v-if="tableData[0].expectation.before !== null" class="feature-change" :class="tableData[0].expectation.direction">{{ tableData[0].expectation.delta }}（{{ tableData[0].expectation.percent }}）</span>
                <span class="feature-tag" :class="{ 'direct-reaction-tag': isDirectDamageReaction(tableData[0].key) }">{{ tableData[0].name }}</span>
            </div>
            <div class="feature-sub">
                <div v-for="key in ['critical', 'nonCritical']" :key="key">
                    <span>{{ t(key === 'critical' ? 'dmg.crit' : 'dmg.nonCrit') }}</span>
                    <b :class="tableData[0][key].direction"><template v-if="tableData[0][key].before !== null"><s>{{ tableData[0][key].before }}</s> → </template>{{ tableData[0][key].current }}</b>
                </div>
            </div>
            <div v-for="row in tableData.slice(1)" :key="row.name" class="feature-row">
                <span class="feature-row-name" :class="{ 'feature-tag direct-reaction-tag': isDirectDamageReaction(row.key) }">{{ row.name }}</span>
                <span v-for="column in damageColumns" :key="column.key"><small>{{ t(column.label) }}</small><b :class="row[column.key].direction"><template v-if="row[column.key].before !== null"><s>{{ row[column.key].before }}</s> → </template>{{ row[column.key].current }}</b></span>
            </div>
        </div>
        <div v-else class="damage-table-wrap" tabindex="0" role="region" :aria-label="t('misc.dmg')">
            <table class="damage-table">
                <thead><tr>
                    <th scope="col">{{ t('misc.type1') }}</th>
                    <th v-for="column in damageColumns" :key="column.key" scope="col">{{ t(column.label) }}</th>
                </tr></thead>
                <tbody><tr v-for="row in tableData" :key="row.key">
                    <th scope="row">{{ row.name }}</th>
                    <td v-for="column in damageColumns" :key="column.key">
                        <span class="damage-values" :class="{ expected: column.key === 'expectation' && row[column.key].before === null }">
                        <span class="value-line">
                            <span v-if="row[column.key].before !== null" class="before-value">{{ row[column.key].before }} →</span>
                            <span class="damage-number" :class="row[column.key].direction">{{ row[column.key].current }}</span>
                        </span>
                        <span v-if="row[column.key].before !== null" class="change-line" :class="row[column.key].direction">
                            <span class="damage-number">{{ row[column.key].delta }}</span>
                            <span class="damage-number">（{{ row[column.key].percent }}）</span>
                        </span>
                        </span>
                    </td>
                </tr></tbody>
            </table>
        </div>
    </div>
</template>

<script>
import {sameHitBaseline} from '@/algorithms/single-result-comparison.mjs'
import { damageComparison } from '@/algorithms/damage-comparison.mjs'
import { visibleDamageReactionKeys, damageReactionLabel, isDirectDamageReaction } from '@/algorithms/reaction-labels.mjs'
import {useI18n} from "@/i18n/i18n";

export default {
    name: "DamageList",
    props: {
        analysisFromWasm: {},
        baseline: {},
        // table：原来的表格；feature：计算器伤害卡的大字布局
        layout: { type: String, default: "table" },
    },
    data: () => ({ damageColumns: [{ key: "expectation", label: "dmg.expect" }, { key: "critical", label: "dmg.crit" }, { key: "nonCritical", label: "dmg.nonCrit" }] }),
    computed: {
        visibleKeys() { return visibleDamageReactionKeys(this.analysisFromWasm) },
        element() {
            return this.analysisFromWasm.element
        },

        normalDamageTitle() {
            // if (this.analysisFromWasm.is_heal) {
            //     return "治疗"
            // } else {
            //     const map = {
            //         "Pyro": "火元素伤害",
            //         "Hydro": "水元素伤害",
            //         "Electro": "雷元素伤害",
            //         "Cryo": "冰元素伤害",
            //         "Dendro": "草元素伤害",
            //         "Geo": "岩元素伤害",
            //         "Anemo": "风元素伤害",
            //         "Physical": "物理伤害",
            //     }
            //     return map[this.element]
            // }

            if (this.analysisFromWasm.is_heal) {
                return this.t("dmg.heal")
            } else {
                return this.t("dmg", this.element)
            }
        },

        tableData() {
            return this.visibleKeys.map(key => {
                const old = sameHitBaseline(this.analysisFromWasm, this.baseline, key) == null ? null : this.baseline[key]
                return {
                    key,
                    expectation: damageComparison(this.analysisFromWasm[key].expectation, old?.expectation),
                    critical: damageComparison(this.analysisFromWasm[key].critical, old?.critical),
                    nonCritical: damageComparison(this.analysisFromWasm[key].non_critical, old?.non_critical),
                    name: key === 'normal' ? this.normalDamageTitle : damageReactionLabel(key),
                }
            })
        }
    },
    setup() {
        const { t } = useI18n()

        return {
            t, isDirectDamageReaction
        }
    }
}
</script>

<style scoped lang="scss">
.damage-feature { display: flex; flex-direction: column; gap: 18px; font-variant-numeric: tabular-nums; }
.feature-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.feature-label { flex-basis: 100%; color: var(--cx-dim); }
.feature-before { color: var(--cx-dim); font-size: 22px; }
.feature-number { font: 800 72px/1 "Noto Serif SC", "Source Han Serif SC", serif; letter-spacing: -.01em; color: var(--cx-letter); }
.feature-change { font-size: 16px; font-weight: 600; }
.feature-tag { align-self: center; height: 26px; padding: 0 10px; display: inline-flex; align-items: center; border-radius: 999px; background: var(--cx-step-2); color: var(--cx-dim); font-size: 12px; }
.direct-reaction-tag {
    box-sizing: border-box;
    border: 1px solid var(--cx-gold);
    background: var(--cx-gold);
    color: var(--cx-gold-on);
}
.feature-sub { display: flex; flex-wrap: wrap; gap: 12px 40px; }
.feature-sub span { display: block; color: var(--cx-dim); font-size: 13px; }
.feature-sub b { font-size: 28px; color: var(--cx-letter); }
.feature-sub s, .feature-row s { color: var(--cx-dim); text-decoration: none; font-weight: 400; font-size: .75em; }
.feature-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 24px; padding: 12px 16px; border-radius: 12px; background: var(--cx-step); }
.feature-row-name { min-width: 6em; font-weight: 600; }
.feature-row small { margin-right: 6px; color: var(--cx-dim); }
.damage-feature .increase { color: var(--cx-up); }
.damage-feature .decrease { color: var(--cx-down); }
.damage-table-wrap { overflow: auto; border: 1px solid var(--cx-step-2); border-radius: 8px; }
.damage-table-wrap:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.damage-table { width: 100%; border-collapse: collapse; }
.damage-table th, .damage-table td { padding: 8px 10px; border-bottom: 1px solid var(--cx-step-2); text-align: right; }
.damage-table th:first-child { text-align: left; }
.damage-table thead { background: var(--cx-step); white-space: nowrap; }
.damage-table tbody tr:last-child > * { border-bottom: 0; }
.damage-values { display: inline-flex; flex-direction: column; max-width: 100%; color: var(--cx-letter); font-variant-numeric: tabular-nums; }
.damage-values.expected { font-weight: 650; color: var(--cx-gold); }
.value-line, .change-line { display: flex; flex-wrap: wrap; gap: 0 4px; align-items: baseline; }
.damage-number { white-space: nowrap; word-break: normal; }
.before-value { color: var(--cx-letter); white-space: nowrap; }
.increase { color: var(--cx-up); }
.decrease { color: var(--cx-down); }
.item {
    height: 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;

    &:hover {
        background-color: rgb(241, 241, 241);
    }

    .name {
        
    }

    .numbers {
        display: flex;
        gap: 4px;
    }

    .number {
        padding: 4px;
        border-radius: 3px;
    }

    .melt {
        color: rgb(63, 63, 63);
        // background-color: rgb(155, 218, 255);
        background-image: url("@image/misc/cryo");
        // background-size: 48px;
        background-position-x: -20px;
        background-position-y: -30px;
        background-repeat: no-repeat;
    }

    .pyro {
        color: rgb(255, 95, 95);
        background-color: rgb(255, 224, 224);
    }

    .physical {
        color: rgb(71, 71, 71);
        background-color: rgb(218, 218, 218);
    }
}
</style>
