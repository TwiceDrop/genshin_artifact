<template>
    <section class="selected-buff-groups" aria-label="已添加的 BUFF" tabindex="0" :style="{ '--buff-tracks': desktopColumnTracks }">
        <section v-for="column in columns" :key="column.key" class="buff-column" :data-source="column.key" :aria-label="column.label + ' BUFF'">
            <header class="buff-column-heading"><h4>{{ column.label }}</h4><span>{{ column.buffs.length }}</span></header>
            <template v-if="column.key === 'Character'">
                <slot name="character-controls" />
                <component v-if="groups.length" :is="shadcn ? AccordionRoot : ElCollapse" v-model="expanded"
                    :type="shadcn ? 'multiple' : undefined">
                    <component :is="shadcn ? AccordionItem : ElCollapseItem" v-for="group in groups" :key="group.character"
                        v-bind="shadcn ? { value: group.character, class: 'selected-buff-accordion-item' } : { name: group.character }">
                        <template v-if="!shadcn" #title>
                            <div class="selected-buff-title">
                                <img :src="group.badge" alt="" />
                                <strong>{{ group.label }}</strong>
                                <span>{{ group.buffs.length }}项 BUFF · {{ group.buffs.filter(b => !b.lock).length }}项启用</span>
                            </div>
                        </template>
                        <template v-if="shadcn">
                            <AccordionHeader as="div">
                                <AccordionTrigger class="selected-buff-trigger">
                                    <span class="selected-buff-title">
                                        <img :src="group.badge" alt="" />
                                        <strong>{{ group.label }}</strong>
                                        <span>{{ group.buffs.length }}项 BUFF · {{ group.buffs.filter(b => !b.lock).length }}项启用</span>
                                    </span>
                                    <i-ep-arrow-down class="selected-buff-chevron" aria-hidden="true" />
                                </AccordionTrigger>
                            </AccordionHeader>
                            <AccordionContent class="selected-buff-content">
                                <slot v-for="buff in group.buffs" :key="buff.id" :buff="buff" />
                            </AccordionContent>
                        </template>
                        <template v-else><slot v-for="buff in group.buffs" :key="buff.id" :buff="buff" /></template>
                    </component>
                </component>
                <section v-if="resonanceBuffs.length" class="selected-resonance">
                    <header class="buff-column-heading"><h4>{{ t('buffGenre', 'Resonance') }}</h4><span>{{ resonanceBuffs.length }}</span></header>
                    <slot v-for="buff in resonanceBuffs" :key="buff.id" :buff="buff" />
                </section>
                <slot v-for="buff in ungroupedBuffs" :key="buff.id" :buff="buff" />
            </template>
            <template v-else>
                <slot v-for="buff in column.buffs" :key="buff.id" :buff="buff" />
                <p v-if="!column.buffs.length" class="buff-empty">无BUFF</p>
            </template>
        </section>
    </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'radix-vue'
import { ElCollapse, ElCollapseItem } from 'element-plus'
import { buffData } from '@/assets/buff'
import characters from '@/assets/_gen_character'
import { useI18n } from '@/i18n/i18n'
import rules from '@/algorithms/buff-groups/ownership.json'
import { groupSelectedBuffs, buffColumnKey, BUFF_COLUMNS } from '@/algorithms/buff-groups/index.mjs'

const props = defineProps({ buffs: { type: Array, default: () => [] }, shadcn: Boolean, compactEmptyColumns: Boolean, collapsedGroups: Array })
const emit = defineEmits(['update:collapsedGroups'])
const { t, ta } = useI18n()
const columns = computed(() => {
    const buckets = { Character: [], Weapon: [], Artifact: [], Common: [] }
    for (const buff of props.buffs) {
        // Keep removed entries visible so their existing delete/disable controls remain available.
        buckets[buffColumnKey(buffData[buff.name]?.genre)].push(buff)
    }
    return BUFF_COLUMNS
        .filter(([key]) => key !== 'Common' || buckets.Common.length)
        .map(([key, label]) => ({ key, label, buffs: buckets[key] }))
})
const desktopColumnTracks = computed(() => {
    const compact = props.compactEmptyColumns && columns.value.some(column => column.buffs.length)
    return columns.value.map(column => compact && !column.buffs.length ? 'minmax(108px,.38fr)' : 'minmax(0,1fr)').join(' ')
})
const partition = computed(() => groupSelectedBuffs(columns.value[0].buffs, buffData, rules))
const resonanceBuffs = computed(() => partition.value.other.filter(buff => buffData[buff.name]?.genre === 'Resonance'))
const ungroupedBuffs = computed(() => partition.value.other.filter(buff => buffData[buff.name]?.genre !== 'Resonance'))
const groups = computed(() => partition.value.characters.map(group => ({
    ...group,
    label: characters[group.character] ? ta(characters[group.character].nameLocale) : '旅行者 · 通用',
    badge: buffData[group.buffs[0].name].badge,
})))
const groupNames = computed(() => groups.value.map(group => group.character))
const localCollapsed = ref([])
const collapsed = computed({
    get: () => props.collapsedGroups ?? localCollapsed.value,
    set: names => {
        if (props.collapsedGroups === undefined) localCollapsed.value = names
        else emit('update:collapsedGroups', names)
    },
})
const expanded = computed({
    get: () => groupNames.value.filter(name => !collapsed.value.includes(name)),
    set: names => { collapsed.value = groupNames.value.filter(name => !names.includes(name)) },
})
watch(groupNames, names => {
    const available = collapsed.value.filter(name => names.includes(name))
    if (available.length !== collapsed.value.length) collapsed.value = available
}, { immediate: true })
</script>
<style scoped>
.selected-buff-accordion-item { border-bottom: 1px solid var(--cx-step-2); }
.selected-buff-trigger { display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; min-height: 44px; padding: 0 6px; border: 0; border-radius: 8px; background: transparent; color: var(--cx-letter); font: inherit; text-align: start; cursor: pointer; }
.selected-buff-trigger:is(:hover, [data-state="open"]) { background: var(--cx-step); }
.selected-buff-trigger:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.selected-buff-chevron { flex: none; color: var(--cx-dim); }
.selected-buff-trigger[data-state="open"] .selected-buff-chevron { transform: rotate(180deg); }
.selected-buff-content { padding-top: 8px; }
.selected-buff-groups { display: grid; grid-template-columns: var(--buff-tracks); gap: 16px; min-width: 0; }
.buff-column { min-width: 0; }
.buff-column + .buff-column { border-left: 1px solid var(--hairline); padding-left: 16px; }
.buff-column-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.buff-column-heading h4 { color: var(--ink); font-size: 15px; font-weight: 650; margin: 0; }
.buff-column-heading > span { color: var(--quiet); font-size: 12px; font-variant-numeric: tabular-nums; }
.selected-resonance { margin-top: 16px; }
.buff-empty { margin: 0; padding: 10px 0; color: var(--quiet); font-size: 13px; }
.selected-buff-title { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; line-height: 1.5; padding: 8px 0; }
.selected-buff-title img { width: 30px; height: 30px; object-fit: contain; }
.selected-buff-title strong { font-size: 14px; }
.selected-buff-title span { font-size: 12px; color: var(--quiet); }
.selected-buff-groups :deep(.el-collapse-item__header) { height: auto; min-height: 48px; }
.selected-buff-groups :deep(.el-collapse-item__content) { padding: 8px 0 0; }
.selected-buff-groups :deep(.buff-root .top) { padding: 4px 0; gap: 6px; }
.selected-buff-groups :deep(.buff-title) { min-width: 0; margin-right: 0; color: var(--ink); overflow-wrap: anywhere; }
.selected-buff-groups :deep(.buff-root .buttons) { flex-shrink: 0; }
.selected-buff-groups :deep(.buff-root .detail) { padding: 8px 0; line-height: 1.6; }
.selected-buff-groups :deep(.buff-root .detail > img) { width: 36px; height: 36px; margin-right: 8px; flex-shrink: 0; }
.selected-buff-groups :deep(.buff-root .detail > div) { min-width: 0; overflow-wrap: anywhere; }
.selected-buff-groups :deep(.el-input-number), .selected-buff-groups :deep(.el-select), .selected-buff-groups :deep(.el-input) { max-width: 100%; min-width: 0; }
.selected-buff-groups :deep(.el-radio-group) { display: flex; flex-wrap: wrap; }
.selected-buff-groups :deep(.el-switch) { max-width: 100%; height: auto; min-height: 32px; }
.selected-buff-groups :deep(.el-switch__label) { height: auto; white-space: normal; line-height: 1.5; }
@container buff-board (max-width: 820px) {
    .selected-buff-groups { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .buff-column:nth-child(odd) { padding-left: 0; border-left: 0; }
}
@container buff-board (max-width: 520px) {
    .selected-buff-groups { grid-template-columns: minmax(0,1fr); gap: 20px; }
    .buff-column + .buff-column { padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--hairline); }
}
</style>
