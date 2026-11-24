<template>
    <UiHoverDetails :enabled="!!composition" :tap-label="label" :side="side">
        <template #trigger>
            <button type="button" class="stat-row" :class="{ 'highlight-stat': composition && highlighted }" :disabled="!composition">
                <span class="stat-label">{{ label }}</span>
                <span class="stat-numbers">
                    <strong>{{ total }}</strong>
                </span>
            </button>
        </template>
        <div v-if="composition" class="stat-detail">
            <header><strong>{{ label }}</strong><b>{{ total }}</b></header>
            <dl v-if="sources.length">
                <div v-for="[source, amount] in sources" :key="source">
                    <dt>{{ source }}</dt><dd>{{ amount }}</dd>
                </div>
            </dl>
            <span v-else>无加成</span>
        </div>
    </UiHoverDetails>
</template>

<script setup>
import { computed } from 'vue'
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import { attributeComparison } from '@/algorithms/attribute-comparison.mjs'

const props = defineProps({ label: String, percentage: Boolean, composition: Object, highlighted: Boolean, side: String })
const total = computed(() => props.composition ? attributeComparison(props.composition, null, props.percentage).current : '—')
const signed = value => value > 0 ? '+' + value : String(value)
const sources = computed(() => Object.entries(props.composition || {}).map(([source, value]) => {
    const amount = props.percentage ? signed(Number((value * 100).toFixed(2))) + '%' : signed(Number(value.toFixed(2)))
    return [source, amount]
}))
</script>

<style scoped>
.stat-row { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; min-width: 0; width: 100%; padding: 6px 0; border: 0; border-top: 1px solid var(--cx-step-2); background: transparent; color: var(--cx-letter); font: inherit; text-align: start; cursor: pointer; }
.stat-row:disabled { cursor: default; }
.stat-row:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 1px; }
.stat-row:enabled:hover { background: var(--cx-step); }
.stat-label { color: var(--cx-dim); font-size: 12px; }
.stat-numbers { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: end; gap: 2px 6px; margin-inline-start: auto; font-variant-numeric: tabular-nums; }
.stat-numbers strong { font-size: 14px; }
.highlight-stat :is(.stat-label, strong) { color: var(--cx-gold); }
.stat-detail header, .stat-detail dl div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.stat-detail header { padding-bottom: 6px; border-bottom: 1px solid var(--cx-step-2); margin-bottom: 6px; }
.stat-detail dl { display: grid; gap: 4px; margin: 0; }
.stat-detail dt, .stat-detail > span { color: var(--cx-dim); font-size: 12px; overflow-wrap: anywhere; }
.stat-detail dd { margin: 0; white-space: nowrap; font-size: 13px; font-variant-numeric: tabular-nums; }
</style>
