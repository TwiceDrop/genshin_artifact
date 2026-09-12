<template>
    <div class="attribute-item">
        <el-tooltip>
            <span class="title">{{ title }}</span>
            <template #content>
<!--                <div slot="content">-->
                    <attribute-composition :composition="composition"></attribute-composition>
<!--                </div>-->
            </template>
        </el-tooltip>
        <span class="value">
            <span v-if="comparison.before !== null" class="before-value">{{ comparison.before }} →</span>
            <span :class="comparison.direction">{{ comparison.current }}<span v-if="comparison.before !== null">（{{ comparison.delta }}）</span></span>
        </span>
    </div>
</template>

<script>
import AttributeComposition from "./AttributeComposition"
import { attributeComparison } from '@/algorithms/attribute-comparison.mjs'

export default {
    name: "AttributeItem",
    components: {
        AttributeComposition
    },
    props: {
        composition: {},
        baseline: {},
        title: {},
        percentage: {
            default: false
        }
    },
    computed: {
        comparison() { return attributeComparison(this.composition, this.baseline, this.percentage) },
        sum() {
            let temp = 0
            for (const key in this.composition) {
                temp += this.composition[key]
            }
            return temp
        },

        displayValue() {
            if (this.percentage) {
                return `${(this.sum * 100).toFixed(1)}%`
            } else {
                return Math.round(this.sum)
            }
        }
    }
}
</script>

<style lang="scss" scoped>
.attribute-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: default;
    font-size: 14px;
    padding: 4px;
    gap: 12px;
    .value { display: flex; justify-content: flex-end; gap: 4px; flex-wrap: wrap; text-align: right; }
    .value > span { white-space: nowrap; }
    .before-value { color: #000; }
    .increase { color: #d93025; }
    .decrease { color: #188038; }

    .title {
        flex-shrink: 0;
        white-space: nowrap;
        color: #909399;
        font-weight: bold;
    }
}
</style>
