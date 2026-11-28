<template>
    <div class="attribute-item" :class="{ 'calculator-attribute': shadcn }">
        <UiHoverDetails v-if="shadcn" enabled :tap-label="title">
            <template #trigger><button class="title stat-details-trigger" type="button">{{ title }}</button></template>
            <attribute-composition :composition="composition" :percentage="percentage" />
        </UiHoverDetails>
        <el-tooltip v-else>
            <span class="title">{{ title }}</span>
            <template #content>
<!--                <div slot="content">-->
                    <attribute-composition :composition="composition" :percentage="percentage"></attribute-composition>
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
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import { attributeComparison } from '@/algorithms/attribute-comparison.mjs'

export default {
    name: "AttributeItem",
    components: {
        AttributeComposition,
        UiHoverDetails,
    },
    props: {
        shadcn: Boolean,
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
.calculator-attribute {
    padding: 6px 4px;
    border-bottom: 1px solid var(--cx-step-2);
    background: transparent;
    .stat-details-trigger {
        min-width: 0;
        padding: 2px 4px;
        max-width: 55%;
        white-space: normal;
        overflow-wrap: anywhere;
        flex-shrink: 1;
        text-align: start;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--cx-dim);
        font: inherit;
        font-weight: 600;
        cursor: help;
    }
    .stat-details-trigger:hover { color: var(--cx-gold); }
    .stat-details-trigger:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
    .value { font-variant-numeric: tabular-nums; }
    .before-value { color: var(--cx-dim); }
    .increase { color: var(--cx-up); }
    .decrease { color: var(--cx-down); }
}
</style>
