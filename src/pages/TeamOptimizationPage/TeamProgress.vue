<script setup lang="ts">
import { ProgressIndicator, ProgressRoot } from 'radix-vue'
defineProps<{ modelValue: number | null; label: string }>()
</script>

<template>
    <div class="team-progress-meter">
        <ProgressRoot class="team-progress-track" :model-value="modelValue" :aria-label="label">
            <ProgressIndicator class="team-progress-fill"
                :style="modelValue === null ? undefined : { width: modelValue + '%' }" />
        </ProgressRoot>
        <span v-if="modelValue !== null" aria-hidden="true">{{ modelValue }}%</span>
    </div>
</template>

<style scoped>
.team-progress-meter { display: flex; align-items: center; gap: 8px; color: var(--cx-dim); font-size: 14px; font-variant-numeric: tabular-nums; }
.team-progress-meter :deep(.team-progress-track) { flex: 1; height: 6px; overflow: hidden; border-radius: 999px; background: var(--cx-step-2); }
.team-progress-meter :deep(.team-progress-fill) { height: 100%; border-radius: inherit; background: var(--cx-gold); }
.team-progress-meter :deep(.team-progress-fill[data-state="indeterminate"]) { position: relative; width: 35%; }
@media (prefers-reduced-motion: no-preference) {
    .team-progress-meter :deep(.team-progress-fill) { transition: width 150ms ease-out; }
    .team-progress-meter :deep(.team-progress-fill[data-state="indeterminate"]) { animation: team-progress-indeterminate 1.5s ease-in-out infinite; }
}
@keyframes team-progress-indeterminate { from { left: -35%; } to { left: 100%; } }
</style>
