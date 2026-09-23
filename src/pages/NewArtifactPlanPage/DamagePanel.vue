<template>
    <div>
        <el-table
            :data="tableData"
        >
            <el-table-column
                prop="name"
                min-width="90"
                :label="t('misc.type1')"
            >
            </el-table-column>
            <el-table-column v-for="column in damageColumns" :key="column.key" :label="t(column.label)" min-width="120">
                <template #default="{ row }">
                    <span class="damage-values">
                        <span v-if="row[column.key].before !== null" class="before-value">{{ row[column.key].before }} → </span>
                        <span :class="row[column.key].direction"><span class="damage-number">{{ row[column.key].current }}</span><span v-if="row[column.key].before !== null">（<span class="damage-number">{{ row[column.key].delta }}</span>，<span class="damage-number">{{ row[column.key].percent }}</span>）</span></span>
                    </span>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script>
import { damageComparison } from '@/algorithms/damage-comparison.mjs'
import { ADDITIONAL_DAMAGE_REACTIONS, damageReactionLabel } from '@/algorithms/reaction-labels.mjs'
import {useI18n} from "@/i18n/i18n";

export default {
    name: "DamageList",
    props: {
        analysisFromWasm: {},
        baseline: {}
    },
    data: () => ({ damageColumns: [{ key: "expectation", label: "dmg.expect" }, { key: "critical", label: "dmg.crit" }, { key: "nonCritical", label: "dmg.nonCrit" }] }),
    computed: {
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
            let temp = []
            const NO_DATA = "无数据"

            const r = (x) => Number.isFinite(x) ? Math.round(x) : NO_DATA

            const push = (name, title) => {
                temp.push({
                    expectation: damageComparison(this.analysisFromWasm[name]?.expectation, this.baseline?.[name]?.expectation),
                    critical: damageComparison(this.analysisFromWasm[name]?.critical, this.baseline?.[name]?.critical),
                    nonCritical: damageComparison(this.analysisFromWasm[name]?.non_critical, this.baseline?.[name]?.non_critical),
                    name: title,
                })
            }

            // temp.push({
            //     expectation: r(this.analysisFromWasm.normal?.expectation) ?? NO_DATA,
            //     critical: r(this.analysisFromWasm.normal?.critical) ?? NO_DATA,
            //     nonCritical: r(this.analysisFromWasm.normal?.non_critical) ?? NO_DATA,
            //     name: this.normalDamageTitle
            //     // name: t("dmg", this.element)
            // })

            if (!this.analysisFromWasm.beta2_model) push("normal", this.normalDamageTitle)

            if (this.analysisFromWasm.melt) {
                push("melt", this.t("dmg.melt"))
                // temp.push({
                //     expectation: r(this.analysisFromWasm.melt?.expectation) ?? NO_DATA,
                //     critical: r(this.analysisFromWasm.melt?.critical) ?? NO_DATA,
                //     nonCritical: r(this.analysisFromWasm.melt?.non_critical) ?? NO_DATA,
                //     name: this.t("dmg.melt")
                // })
            }
            if (this.analysisFromWasm.vaporize) {
                push("vaporize", this.t("dmg.vaporize"))
                // temp.push({
                //     expectation: r(this.analysisFromWasm.vaporize?.expectation) ?? NO_DATA,
                //     critical: r(this.analysisFromWasm.vaporize?.critical) ?? NO_DATA,
                //     nonCritical: r(this.analysisFromWasm.vaporize?.non_critical) ?? NO_DATA,
                //     name: this.t("dmg.vaporize")
                // })
            }
            if (this.analysisFromWasm.spread) {
                push("spread", this.t("dmg.spread"))
            }
            if (this.analysisFromWasm.aggravate) {
                push("aggravate", this.t("dmg.aggravate"))
            }
            if (this.analysisFromWasm.moonfall) {
                push("moonfall", "月绽放")
            }
            if (this.analysisFromWasm.moonelectro) {
                push("moonelectro", "月感电")
            }
            if (this.analysisFromWasm.direct_moonelectro) {
                push("direct_moonelectro", "直接月感电")
            }
            for (const key of ADDITIONAL_DAMAGE_REACTIONS) {
                if (Number.isFinite(this.analysisFromWasm[key]?.expectation)) push(key, damageReactionLabel(key))
            }

            return temp
        }
    },
    setup() {
        const { t } = useI18n()

        return {
            t
        }
    }
}
</script>

<style scoped lang="scss">
.damage-values { color: #000; white-space: normal; }
.damage-values > span { display: inline-block; }
.damage-number { white-space: nowrap; word-break: normal; }
.before-value { color: #000; }
.increase { color: #d93025; }
.decrease { color: #188038; }
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
