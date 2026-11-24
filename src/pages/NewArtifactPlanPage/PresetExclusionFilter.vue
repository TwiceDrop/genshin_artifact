<template>
    <el-button @click="openFilter">圣遗物替换设置</el-button>
    <el-dialog v-model="open" append-to-body destroy-on-close class="cx-scope"
        title="圣遗物替换设置" width="min(700px, 94vw)" top="8vh">
        <div class="filter-tools">
            <el-input v-model="query" placeholder="搜索角色或预设" aria-label="搜索角色或预设" clearable />
            <el-radio-group v-model="source" aria-label="预设来源" size="small">
                <el-radio-button label="all">全部</el-radio-button>
                <el-radio-button label="game">游戏内</el-radio-button>
                <el-radio-button label="custom">自定义</el-radio-button>
            </el-radio-group>
        </div>
        <div class="selection-tools">
            <span>排除预设（{{ selectedCount }} 套）</span>
            <el-button size="small" :disabled="!visible.length" @click="selectVisible(true)">全选筛选结果</el-button>
            <el-button size="small" :disabled="!visible.length" @click="selectVisible(false)">取消全选</el-button>
        </div>
        <div class="role-list">
            <section v-for="role in visible" :key="role.key" class="role-row">
                <div class="role-name"><img :src="role.avatar" alt="" loading="lazy" /><b>{{ role.label }}</b></div>
                <div class="presets">
                    <label v-for="choice in role.choices" :key="choice.key">
                        <input type="checkbox" :checked="draft[role.key]?.includes(choice.key)"
                            @change="setSelected(role.key, choice.key, $event.target.checked)" />
                        <span>{{ choice.name }}</span>
                    </label>
                </div>
            </section>
            <el-empty v-if="!visible.length" description="没有匹配的预设" :image-size="48" />
        </div>
        <template #footer>
            <el-button @click="open = false">取消</el-button>
            <el-button type="primary" @click="apply">确定</el-button>
        </template>
    </el-dialog>
</template>
<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ groups: { type: Array, required: true }, modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const open = ref(false), query = ref(''), source = ref('all'), draft = ref({})
const visible = computed(() => {
    const needle = query.value.trim().toLowerCase()
    return props.groups.flatMap(role => {
        const roleMatches = role.label.toLowerCase().includes(needle)
        const choices = role.choices.filter(choice =>
            (source.value === 'all' || choice.game === (source.value === 'game')) &&
            (roleMatches || choice.name.toLowerCase().includes(needle)))
        return choices.length ? [{ ...role, choices }] : []
    })
})
const selectedCount = computed(() => Object.values(draft.value).reduce((sum, keys) => sum + keys.length, 0))
function openFilter() {
    draft.value = {}
    for (const role of props.groups) {
        const keys = role.choices.map(c => c.key).filter(key => props.modelValue?.[role.key]?.includes(key))
        if (keys.length) draft.value[role.key] = keys
    }
    query.value = ''
    source.value = 'all'
    open.value = true
}
function setSelected(role, key, checked) {
    const keys = new Set(draft.value[role])
    if (checked) keys.add(key)
    else keys.delete(key)
    if (keys.size) draft.value[role] = [...keys]
    else delete draft.value[role]
}
function selectVisible(checked) {
    for (const role of visible.value) {
        for (const choice of role.choices) setSelected(role.key, choice.key, checked)
    }
}
function apply() {
    emit('update:modelValue', draft.value)
    open.value = false
}
</script>
<style scoped>
.filter-tools, .selection-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filter-tools .el-input { flex: 1 1 200px; }
.selection-tools { margin: 12px 0; color: var(--cx-dim); font-size: 13px; }
.selection-tools span { margin-right: auto; }
.selection-tools .el-button { margin-left: 0; }
.role-list { max-height: 49dvh; overflow-y: auto; }
.role-row { display: grid; grid-template-columns: minmax(90px, 27%) 1fr; align-items: start; gap: 12px; padding: 10px 4px; border-top: 1px solid var(--cx-step-2); }
.role-name, .presets label { display: flex; align-items: center; gap: 8px; color: var(--cx-letter); }
.role-name img { width: 28px; height: 28px; object-fit: cover; border-radius: 50%; background: var(--cx-step); }
.presets { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.presets label { min-height: 28px; cursor: pointer; overflow-wrap: anywhere; }
.presets input { margin: 0; accent-color: var(--cx-gold); }
</style>
