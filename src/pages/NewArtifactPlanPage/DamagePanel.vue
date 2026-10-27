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
                <template #default="{ row }">
                    <span>{{ row.name }}</span>
                </template>
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
import { visibleDamageReactionKeys, damageReactionLabel } from '@/algorithms/reaction-labels.mjs'
import {useI18n} from "@/i18n/i18n";

export default {
    name: "DamageList",
    props: {
        analysisFromWasm: {},
        baseline: {}
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
            return this.visibleKeys.map(key => ({
                expectation: damageComparison(this.analysisFromWasm[key].expectation, this.baseline?.[key]?.expectation),
                critical: damageComparison(this.analysisFromWasm[key].critical, this.baseline?.[key]?.critical),
                nonCritical: damageComparison(this.analysisFromWasm[key].non_critical, this.baseline?.[key]?.non_critical),
                name: (key === 'normal' ? this.normalDamageTitle : damageReactionLabel(key)),
            }))
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
