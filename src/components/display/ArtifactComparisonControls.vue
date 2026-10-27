<template>
    <div class="artifact-comparison-controls">
        <div class="comparison-actions">
            <span>圣遗物对比</span><el-switch :model-value="enabled" aria-label="开启圣遗物对比" @update:model-value="v => emit('update:enabled', v)" />
            <el-radio-group v-if="enabled" :model-value="mode" size="small" @update:model-value="v => emit('update:mode', v)">
                <el-radio-button label="game">游戏内穿戴</el-radio-button>
                <el-radio-button label="session">此次计算前</el-radio-button>
                <el-radio-button label="history">对比历史</el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="emit('save')">保存当前配装到历史</el-button>
        </div>
        <el-select v-if="enabled && mode === 'history'" :model-value="historyId" class="comparison-history" placeholder="选择历史配装" @update:model-value="v => emit('update:historyId', v)">
            <el-option v-for="row in history" :key="row.id" :value="row.id" :label="`${new Date(row.time).toLocaleString()} · ${row.label}`" />
        </el-select>
    </div>
</template>
<script setup>
defineProps({ enabled: Boolean, mode: String, history: Array, historyId: String })
const emit = defineEmits(['update:enabled', 'update:mode', 'update:historyId', 'save'])
</script>
<style scoped>
.artifact-comparison-controls{border:1px solid var(--el-border-color-light);border-radius:6px;padding:12px;margin-bottom:12px}
.comparison-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px}
.comparison-history{width:100%;margin-top:10px}
</style>
