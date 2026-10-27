<template>
    <section class="selected-buff-groups" aria-label="已添加的 BUFF">
        <el-collapse v-if="groups.length" v-model="expanded">
            <el-collapse-item v-for="group in groups" :key="group.character" :name="group.character">
                <template #title>
                    <div class="selected-buff-title">
                        <img :src="group.badge" alt="" />
                        <strong>{{ group.label }}</strong>
                        <span>{{ group.buffs.length }}项 BUFF · {{ group.buffs.filter(b => !b.lock).length }}项启用</span>
                    </div>
                </template>
                <slot v-for="buff in group.buffs" :key="buff.id" :buff="buff" />
            </el-collapse-item>
        </el-collapse>
        <div v-if="partition.other.length" class="other-selected-buffs">
            <slot v-for="buff in partition.other" :key="buff.id" :buff="buff" />
        </div>
    </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { buffData } from '@/assets/buff'
import characters from '@/assets/_gen_character'
import { useI18n } from '@/i18n/i18n'
import rules from '@/algorithms/buff-groups/ownership.json'
import { groupSelectedBuffs } from '@/algorithms/buff-groups/index.mjs'

const props = defineProps({ buffs: { type: Array, default: () => [] } })
const { ta } = useI18n()
const partition = computed(() => groupSelectedBuffs(props.buffs,buffData,rules))
const groups = computed(() => partition.value.characters.map(group => ({
    ...group,
    label: characters[group.character] ? ta(characters[group.character].nameLocale) : '旅行者 · 通用',
    badge: buffData[group.buffs[0].name].badge,
})))
const expanded = ref([])
watch(() => groups.value.map(g => g.character), (names, previous = []) => {
    expanded.value = [...expanded.value.filter(name => names.includes(name)), ...names.filter(name => !previous.includes(name))]
}, { immediate: true })
</script>
<style scoped>
.selected-buff-groups{min-width:0}.selected-buff-title{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;line-height:1.5;padding:8px 0}.selected-buff-title img{width:36px;height:36px;object-fit:contain}.selected-buff-title strong{font-size:14px}.selected-buff-title span{font-size:12px;color:#8b94a2}.selected-buff-groups :deep(.el-collapse-item__header){height:auto;min-height:56px}.selected-buff-groups :deep(.el-collapse-item__content){padding:8px 0 0}.other-selected-buffs{margin-top:12px}
</style>
