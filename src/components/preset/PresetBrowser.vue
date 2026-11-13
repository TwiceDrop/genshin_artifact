<template>
    <div class="preset-browser">
        <el-tabs v-model="source">
            <el-tab-pane label="游戏内" name="game" />
            <el-tab-pane label="自定义" name="custom" />
        </el-tabs>
        <div class="preset-filters">
            <el-select v-if="source === 'game'" v-model="uid" aria-label="UID" placeholder="UID">
                <el-option v-for="entry in uids" :key="entry.uid" :value="entry.uid" :label="entry.label" />
            </el-select>
            <label class="preset-search"><span>搜索角色或预设名称</span><el-input v-model="search" placeholder="搜索角色或预设名称" clearable /></label>
        </div>
        <slot name="actions" :source="source" />
        <div v-if="entries.length" :class="['preset-list', {'preset-grid': !!$slots.default}]">
            <template v-for="entry in entries" :key="entry.name">
                <slot :entry="entry">
                    <button type="button" class="preset-choice" @click="$emit('select', entry.name)">
                        <img :src="characters[entry.item.character.name].avatar" alt="" />
                        <span><strong>{{ entry.name }}</strong><span>{{ characterLabel(entry.item.character.name) }}</span></span>
                        <i-ep-arrow-right aria-hidden="true" />
                    </button>
                </slot>
            </template>
        </div>
        <el-empty v-else description="暂无符合条件的预设" :image-size="64" />
    </div>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {usePresetStore} from '@/store/pinia/preset'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import {filterPresets, presetSource} from '@/utils/preset-workflow.mjs'
import characters from '@/assets/_gen_character'
import {useI18n} from '@/i18n/i18n'

const props = withDefaults(defineProps<{modelValue?: string, character?: string}>(), {modelValue: 'game', character: ''})
const emit = defineEmits(['update:modelValue', 'select'])
const source = computed({get: () => props.modelValue, set: value => emit('update:modelValue', value)})
const presets = usePresetStore(), game = useMiyousheStore(), {ta} = useI18n()
const search = ref(''), uid = ref(game.selectedUid.value)
const characterLabel = (name: string) => ta(characters[name].nameLocale)
const uids = computed(() => {
    const groups = new Map<string, string>(game.uidGroups.value.map(g => [g.uid, `${g.nickname} · ${g.uid}`]))
    for (const {item} of presets.allFlat.value) {
        if (presetSource(item) === 'game') {
            const id = item.miyousheKey!.split(':')[0]
            if (!groups.has(id)) groups.set(id, id)
        }
    }
    return [...groups].map(([uid, label]) => ({uid, label}))
})
watch(uids, groups => {
    if (!groups.some(group => group.uid === uid.value)) uid.value = groups[0]?.uid || ''
}, {immediate: true})
const entries = computed(() => filterPresets(presets.allFlat.value, {
    source: source.value, uid: uid.value, character: props.character, search: search.value,
}, characterLabel))
</script>

<style scoped>
.preset-browser{min-width:0}
.preset-filters{display:flex;gap:10px;margin-bottom:16px}
.preset-filters>.el-select{flex:0 1 240px;min-width:0}
.preset-search{flex:1;min-width:0}
.preset-search>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.preset-list{display:grid;gap:8px}
.preset-grid{grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))}
.preset-choice{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:1px solid var(--el-border-color-light);border-radius:6px;background:var(--el-bg-color);color:var(--el-text-color-primary);text-align:left;cursor:pointer}
.preset-choice:hover,.preset-choice:focus-visible{border-color:var(--el-color-primary);background:var(--el-fill-color-light)}
.preset-choice>img{width:44px;height:44px;object-fit:contain}
.preset-choice>span{display:grid;gap:4px;min-width:0;flex:1}
.preset-choice strong{overflow-wrap:anywhere;font-weight:600}
.preset-choice span span{font-size:12px;color:var(--el-text-color-secondary)}
@media(max-width:600px){.preset-filters{flex-direction:column}.preset-filters>.el-select{flex:auto;width:100%}}
</style>
