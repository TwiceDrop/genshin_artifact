<script setup lang="ts">
import { computed, ref } from 'vue'
import { DropdownMenuCheckboxItem, DropdownMenuItemIndicator } from 'radix-vue'
import UiButton from './UiButton.vue'
import UiDropdownMenu from './UiDropdownMenu.vue'

const props = defineProps<{
    modelValue: string[]
    label: string
    options: { value: string; label: string; icon?: string }[]
    disabled?: boolean
    limit?: number
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string[]): void }>()
const trigger = ref<InstanceType<typeof UiButton> | null>(null)
const selectedOptions = computed(() => props.modelValue.flatMap(value => props.options.filter(option => option.value === value)))

function setChecked(value: string, checked: boolean) {
    emit('update:modelValue', checked ? [...props.modelValue, value] : props.modelValue.filter(item => item !== value))
}

function remove(value: string) {
    setChecked(value, false)
    trigger.value?.$el.focus()
}
</script>

<template>
    <div class="multi-select" data-slot="multi-select">
        <UiDropdownMenu content-class="ui-multi-select-menu" align="start">
            <template #trigger>
                <UiButton ref="trigger" class="multi-trigger" :aria-label="label" :disabled="disabled">
                    <span v-if="!modelValue.length">{{ label }}</span><span v-else />
                    <i-ep-arrow-down aria-hidden="true" />
                </UiButton>
            </template>
            <DropdownMenuCheckboxItem v-for="option in options" :key="option.value" class="multi-option"
                :checked="modelValue.includes(option.value)"
                :disabled="limit !== undefined && modelValue.length >= limit && !modelValue.includes(option.value)"
                @select.prevent @update:checked="setChecked(option.value, $event)">
                <img v-if="option.icon" :src="option.icon" alt="" />
                <span>{{ option.label }}</span>
                <DropdownMenuItemIndicator><i-ep-check aria-hidden="true" /></DropdownMenuItemIndicator>
            </DropdownMenuCheckboxItem>
        </UiDropdownMenu>
        <UiButton v-for="option in selectedOptions" :key="option.value" size="small" class="multi-chip" :disabled="disabled"
            :aria-label="option.label + ' · ×'" @click="remove(option.value)">
            {{ option.label }} <i-ep-close aria-hidden="true" />
        </UiButton>
    </div>
</template>

<style scoped>
.multi-select { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; min-height: 34px; box-sizing: border-box; padding: 4px 30px 4px 7px; }
.multi-trigger { position: absolute; inset: 0; width: 100%; height: 100%; justify-content: space-between; border-radius: 8px; background: var(--cx-card); color: var(--cx-dim); font-weight: 400; }
.multi-chip { z-index: 1; min-width: 0; max-width: 100%; min-height: 24px; height: auto; padding: 2px 4px; overflow-wrap: anywhere; }
.multi-chip svg { flex: none; }
.multi-option { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 4px 9px; border-radius: 6px; cursor: pointer; outline: none; }
.multi-option[data-highlighted] { background: var(--cx-step); }
.multi-option[data-state="checked"] { color: var(--cx-gold); }
.multi-option[data-disabled] { opacity: .5; cursor: default; }
.multi-option img { width: 26px; height: 26px; object-fit: contain; }
.multi-option > span:first-of-type { margin-inline-end: auto; }
</style>

<style>
.ui-menu.ui-multi-select-menu { min-width: var(--radix-dropdown-menu-trigger-width); max-width: calc(100vw - 16px); }
</style>
