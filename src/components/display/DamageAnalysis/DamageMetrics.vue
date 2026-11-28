<script setup>
defineProps({ result: Object, format: Function })
const metrics = [
    ['expectation', '期望伤害'],
    ['critical', '暴击伤害'],
    ['non_critical', '非暴击伤害'],
]
</script>

<template>
    <dl class="damage-metrics">
        <div v-for="[metric, label] in metrics" :key="metric">
            <dt>{{ label }}</dt>
            <dd>{{ format(result[metric]) }}</dd>
        </div>
    </dl>
</template>

<style scoped>
.damage-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(94px, 100%), 1fr)); gap: 8px; margin: 0; }
.damage-metrics > div { min-width: 0; padding: 10px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); }
.damage-metrics dt { color: var(--cx-dim); font-size: 13px; }
.damage-metrics dd { margin: 3px 0 0; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
</style>
