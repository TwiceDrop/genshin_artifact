<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import { useI18n } from '@/i18n/i18n'

type GroupItem = { id: number; label: string; characters: { name: string; label: string; avatar: string }[] }
type GroupSection = { id: number; label: string; children: GroupItem[] }
const props = defineProps<{ groups: GroupSection[]; modelValue: number[]; query: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number[]): void; (event: 'update:query', value: string): void }>()
const { t, locale } = useI18n()
const search = computed(() => props.query.trim().toLowerCase())
const selected = computed(() => new Set(props.modelValue))
const expanded = ref(new Set<number>())
const visible = computed(() => props.groups.flatMap(group => {
    const matchesGroup = group.label.toLowerCase().includes(search.value)
    const items = matchesGroup ? group.children : group.children.filter(item =>
        `${item.label} ${item.characters.map(role => `${role.name} ${role.label}`).join(' ')}`.toLowerCase().includes(search.value))
    return matchesGroup || items.length ? [{ group, items }] : []
}))

watch([search, visible], () => {
    if (search.value) expanded.value = new Set([...expanded.value, ...visible.value.map(({ group }) => group.id)])
}, { immediate: true })

function toggleGroup(id: number, open: boolean) {
    if (open) expanded.value.add(id)
    else expanded.value.delete(id)
}

function selectedCount(group: GroupSection) {
    return group.children.filter(item => selected.value.has(item.id)).length
}

function checkedState(group: GroupSection) {
    const count = selectedCount(group)
    return count === 0 ? false : count === group.children.length ? true : 'indeterminate'
}

function setChecked(items: GroupItem[], checked: boolean) {
    const next = new Set(props.modelValue)
    for (const item of items) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
    }
    emit('update:modelValue', [...next])
}
</script>

<template>
    <div class="group-filter">
        <UiSearchInput :model-value="query" :placeholder="t('misc.search')" @update:model-value="emit('update:query', $event)" />
        <CollapsibleRoot v-for="{ group, items } in visible" :key="group.id" class="group-section" :open="expanded.has(group.id)"
            @update:open="toggleGroup(group.id, $event)">
            <div class="group-heading">
                <UiCheckbox class="group-check" :model-value="checkedState(group)" @update:model-value="setChecked(group.children, $event)">
                    <strong>{{ group.label }}</strong>
                </UiCheckbox>
                <span class="group-count">{{ selectedCount(group) }}/{{ group.children.length }}</span>
                <CollapsibleTrigger as-child>
                    <UiButton size="small" class="group-expand" :aria-label="group.label"><i-ep-arrow-down aria-hidden="true" /></UiButton>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent class="group-items">
                <UiCheckbox v-for="item in items" :key="item.id" class="group-item" :model-value="selected.has(item.id)"
                    @update:model-value="setChecked([item], $event)">
                    <img v-for="role in item.characters" :key="role.name" :src="role.avatar" :alt="role.label" />
                    <span>{{ item.label }}</span>
                </UiCheckbox>
            </CollapsibleContent>
        </CollapsibleRoot>
        <p v-if="!visible.length" class="group-empty">{{ locale === 'en' ? 'No Data' : '暂无数据' }}</p>
    </div>
</template>

<style scoped>
.group-filter { display: grid; gap: 8px; }
.group-section { min-width: 0; overflow: hidden; border: 1px solid var(--cx-step-2); border-radius: 9px; }
.group-heading { display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: var(--cx-step); }
.group-check { flex: 1; min-height: 30px; overflow-wrap: anywhere; }
.group-count { color: var(--cx-dim); font-size: 12px; font-variant-numeric: tabular-nums; }
.group-expand[data-slot="button"] { width: 28px; flex: none; padding: 0; }
.group-expand[data-state="open"] svg { transform: rotate(180deg); }
.group-items { display: grid; padding: 4px 8px 4px 16px; border-top: 1px solid var(--cx-step-2); }
.group-items[hidden] { display: none; }
.group-item { min-height: 34px; padding: 4px; border-radius: 6px; overflow-wrap: anywhere; }
.group-item:hover { background: var(--cx-step); }
.group-item img { width: 22px; height: 22px; border-radius: 50%; }
.group-empty { margin: 0; padding: 14px 0; text-align: center; color: var(--cx-dim); font-size: 13px; }
</style>
