<script setup lang="ts">
import { computed, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiPopover from '@/components/ui/UiPopover.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import { useI18n } from '@/i18n/i18n'

const props = defineProps<{
    modelValue: string | string[]
    label: string
    placeholder?: string
    options: { value: string; label: string }[]
    disabled?: boolean
    limit?: number
}>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string | string[]): void }>()
const { t, locale } = useI18n()
const open = ref(false), query = ref('')
const selected = computed(() => props.options.filter(option =>
    Array.isArray(props.modelValue) ? props.modelValue.includes(option.value) : props.modelValue === option.value))
const visible = computed(() => {
    const term = query.value.trim().toLowerCase()
    return props.options.filter(option => option.label.toLowerCase().includes(term))
})

function changeOpen(value: boolean) {
    open.value = value
    query.value = ''
}

function select(value: string) {
    if (!Array.isArray(props.modelValue)) {
        emit('update:modelValue', value)
        changeOpen(false)
    } else if (props.modelValue.includes(value)) {
        emit('update:modelValue', props.modelValue.filter(item => item !== value))
    } else {
        emit('update:modelValue', [...props.modelValue, value])
    }
}

function atLimit(value: string) {
    const values = props.modelValue
    return Array.isArray(values) && props.limit !== undefined && values.length >= props.limit && !values.includes(value)
}
</script>

<template>
    <div class="team-search-choice">
        <UiPopover :open="open" :label="label" @update:open="changeOpen">
            <template #trigger>
                <UiButton class="team-choice-trigger" :aria-label="label" :disabled="disabled">
                    <span v-if="!selected.length">{{ placeholder || label }}</span>
                    <span v-else-if="typeof modelValue === 'string'">{{ selected[0].label }}</span>
                    <span v-else aria-hidden="true">&nbsp;</span>
                    <i-ep-arrow-down aria-hidden="true" />
                </UiButton>
            </template>
            <UiSearchInput v-model="query" :placeholder="t('misc.search')" />
            <div class="team-choice-list">
                <template v-if="Array.isArray(modelValue)">
                    <UiCheckbox v-for="option in visible" :key="option.value" class="team-choice-item"
                        :model-value="modelValue.includes(option.value)" :disabled="atLimit(option.value)"
                        @update:model-value="select(option.value)">{{ option.label }}</UiCheckbox>
                </template>
                <template v-else>
                    <UiButton v-for="option in visible" :key="option.value" class="team-choice-item"
                        :aria-pressed="modelValue === option.value" @click="select(option.value)">{{ option.label }}</UiButton>
                </template>
                <p v-if="!visible.length" class="team-choice-empty">{{ locale === 'en' ? 'No Data' : '暂无数据' }}</p>
            </div>
        </UiPopover>
        <template v-if="Array.isArray(modelValue)">
            <UiButton v-for="option in selected" :key="option.value" class="team-choice-chip" size="small"
                :disabled="disabled" :aria-label="option.label + ' · ×'" @click="select(option.value)">
                {{ option.label }} <i-ep-close aria-hidden="true" />
            </UiButton>
        </template>
    </div>
</template>

<style scoped>
.team-search-choice { display: flex; flex: 1; position: relative; align-items: center; flex-wrap: wrap; min-width: 0; gap: 4px; }
.team-search-choice:has(.team-choice-chip) { min-height: 36px; box-sizing: border-box; padding: 4px 30px 4px 7px; }
.team-search-choice:has(.team-choice-chip) .team-choice-trigger { position: absolute; inset: 0; }
.team-choice-trigger[data-slot="button"] { width: 100%; min-width: 0; text-align: left; justify-content: space-between; font-weight: 400; }
.team-choice-trigger > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.team-choice-trigger svg, .team-choice-chip svg { flex: none; }
.team-choice-chip[data-slot="button"] { min-height: 24px; height: auto; padding: 2px 6px; z-index: 1; max-width: 100%; white-space: normal; }
.team-choice-list { display: grid; gap: 3px; margin-top: 6px; }
.team-choice-item { min-width: 0; justify-content: flex-start; text-align: left; white-space: normal; }
.team-choice-item:has([role="checkbox"]) { padding: 5px 7px; }
.team-choice-item[aria-pressed="true"] { border-color: var(--cx-gold); color: var(--cx-gold); }
.team-choice-empty { margin: 8px 0; color: var(--cx-dim); font-size: 13px; }
</style>
