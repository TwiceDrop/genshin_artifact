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
        <p>{{ description }}</p>
        <small v-if="enabled && mode === 'history'">按 UID 和角色保存最近 50 份配装；自动记录计算前穿戴及查看过的计算结果。选择历史只改变对比标记。</small>
    </div>
</template>
<script setup>
defineProps({ enabled: Boolean, mode: String, history: Array, historyId: String, description: String })
const emit = defineEmits(['update:enabled', 'update:mode', 'update:historyId', 'save'])
</script>
<style scoped>
.artifact-comparison-controls{border:1px solid var(--el-border-color-light);border-radius:6px;padding:12px;margin-bottom:12px}
.comparison-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px}
.artifact-comparison-controls p,.artifact-comparison-controls small{font-size:12px;color:var(--el-text-color-secondary);line-height:1.6;margin:8px 0 0;display:block}
.comparison-history{width:100%;margin-top:10px}
</style>
