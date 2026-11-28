<template>
    <div class="artifact-comparison-controls" :class="{ inline }">
        <div class="comparison-actions">
            <span>{{ inline ? '对比：' : '圣遗物对比' }}</span>
            <UiSwitch :model-value="enabled" aria-label="开启圣遗物对比" @update:model-value="emit('update:enabled', $event)" />
            <UiSegmentedControl v-if="enabled" :model-value="mode" :options="modes" label="圣遗物对比" class="comparison-modes"
                @update:model-value="emit('update:mode', $event)" />
            <UiButton size="small" @click="emit('save')">保存当前配装到历史</UiButton>
        </div>
        <div v-if="enabled && mode === 'history'" class="comparison-history">
            <UiSelect :model-value="historyId" :options="historyOptions" label="选择历史配装" placeholder="选择历史配装"
                @update:model-value="emit('update:historyId', $event)" />
        </div>
    </div>
</template>
<script setup>
import { computed } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'

const props = defineProps({ inline: Boolean, enabled: Boolean, mode: String, history: Array, historyId: String })
const emit = defineEmits(['update:enabled', 'update:mode', 'update:historyId', 'save'])
const modes = [
    { value: 'game', label: '游戏内穿戴' },
    { value: 'session', label: '此次计算前' },
    { value: 'history', label: '对比历史' },
]
const historyOptions = computed(() => props.history.map(row => ({
    value: row.id,
    label: `${new Date(row.time).toLocaleString()} · ${row.label}`,
})))
</script>
<style scoped>
.artifact-comparison-controls{border:1px solid var(--cx-step-2);border-radius:8px;padding:12px;margin-bottom:12px}
.comparison-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px}
.comparison-history{width:100%;margin-top:10px}
.comparison-history :deep(.select-trigger){width:100%}
.artifact-comparison-controls.inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;padding:0;margin:0;border:0}
.inline .comparison-actions{display:contents}
.inline .comparison-history{width:min(220px,100%);margin-top:0}
.comparison-modes{max-width:100%}
@media(max-width:767px){
    .artifact-comparison-controls:not(.inline) .comparison-modes{width:100%;box-sizing:border-box}
    .artifact-comparison-controls:not(.inline) .comparison-modes :deep(button){flex:1 1 auto;padding-inline:5px;min-height:36px}
    .artifact-comparison-controls:not(.inline) .comparison-actions > [data-slot="button"]{width:100%;min-height:36px}
}
</style>
