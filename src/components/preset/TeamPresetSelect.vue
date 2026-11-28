<script setup lang="ts">
import { computed, ref } from 'vue'
import { ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxItemIndicator, ComboboxPortal, ComboboxRoot, ComboboxTrigger, ComboboxViewport } from 'radix-vue'
import { useOverlayZIndex } from '@/composables/overlay-z-index'
import { useI18n } from '@/i18n/i18n'

type Option = { value: string; label: string }
const props = defineProps<{ modelValue: string[]; options: Option[]; selected: Option[]; label: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>()
const { locale } = useI18n()
const open = ref(false)
const queryInput = ref<InstanceType<typeof ComboboxInput> | null>(null)
const zIndex = useOverlayZIndex(open)
const portalTarget = computed(() => queryInput.value?.$el.closest('[data-slot="dialog-content"]') ?? 'body')
const labels = computed(() => new Map(props.options.map(({ value, label }) => [value, label])))

function filter(values: string[], term: string) {
    const query = term.toLowerCase()
    return values.filter(value => labels.value.get(value)?.toLowerCase().includes(query))
}

function remove(value: string) {
    emit('update:modelValue', props.modelValue.filter(preset => preset !== value))
    queryInput.value?.$el.focus()
}

function toggle(value: string) {
    if (props.modelValue.includes(value)) remove(value)
    else emit('update:modelValue', [...props.modelValue, value])
}

function clear() {
    emit('update:modelValue', [])
    queryInput.value?.$el.focus()
}
</script>

<template>
    <ComboboxRoot v-model:open="open" multiple :model-value="modelValue" :filter-function="filter">
        <ComboboxAnchor class="team-preset-select">
            <span v-for="option in selected" :key="option.value" class="team-preset-chip">
                {{ option.label }}
                <button type="button" :aria-label="option.label + ' · ×'" @click="remove(option.value)"><i-ep-close aria-hidden="true" /></button>
            </span>
            <ComboboxInput ref="queryInput" class="team-preset-query" :aria-label="label" :placeholder="modelValue.length ? undefined : label" />
            <button v-if="modelValue.length" type="button" class="team-preset-clear" aria-label="清除队友预设" @click="clear"><i-ep-close aria-hidden="true" /></button>
            <ComboboxTrigger class="team-preset-trigger" :aria-label="label"><i-ep-arrow-down aria-hidden="true" /></ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal :to="portalTarget">
            <ComboboxContent class="team-preset-options" position="popper" align="start" :style="{ zIndex }">
                <ComboboxViewport>
                    <div v-if="!options.length" class="team-preset-empty">{{ locale === 'en' ? 'No data' : '无数据' }}</div>
                    <ComboboxEmpty v-else class="team-preset-empty">{{ locale === 'en' ? 'No matching data' : '无匹配数据' }}</ComboboxEmpty>
                    <ComboboxItem v-for="option in options" :key="option.value" :value="option.value" class="team-preset-option" @select.prevent="toggle(option.value)">
                        {{ option.label }}
                        <ComboboxItemIndicator><i-ep-check aria-hidden="true" /></ComboboxItemIndicator>
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </ComboboxPortal>
    </ComboboxRoot>
</template>

<style scoped>
.team-preset-select { display:flex; align-items:center; flex-wrap:wrap; gap:4px; min-height:32px; border:1px solid var(--cx-step-2); border-radius:8px; padding:3px 8px; background:var(--cx-card); box-sizing:border-box; }
.team-preset-select:focus-within { outline:2px solid var(--cx-gold); outline-offset:-2px; }
.team-preset-query { flex:1; min-width:5em; max-width:100%; border:0; padding:0 2px; outline:0; color:var(--cx-letter); background:transparent; font:inherit; }
.team-preset-query::placeholder { color:var(--cx-dim); }
.team-preset-chip { display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:100%; overflow-wrap:anywhere; padding:3px 5px; border-radius:5px; background:var(--cx-step); color:var(--cx-letter); font-size:12px; }
.team-preset-select button { display:grid; place-items:center; padding:1px; border:0; background:transparent; color:var(--cx-dim); cursor:pointer; }
.team-preset-select button:focus-visible { outline:2px solid var(--cx-gold); outline-offset:1px; }
.team-preset-clear { margin-inline-start:auto; }
.team-preset-options { min-width:var(--radix-combobox-trigger-width); max-width:calc(100vw - 16px); max-height:min(240px, var(--radix-combobox-content-available-height)); overflow:auto; padding:4px; border:1px solid var(--cx-step-2); border-radius:10px; background:var(--cx-card); color:var(--cx-letter); }
.team-preset-option { display:flex; justify-content:space-between; gap:8px; padding:6px 10px; border-radius:6px; cursor:pointer; }
.team-preset-option[data-highlighted] { background:var(--cx-step); }
.team-preset-option[data-state="checked"] { color:var(--cx-gold); }
.team-preset-empty { padding:8px 10px; color:var(--cx-dim); text-align:center; }
</style>
