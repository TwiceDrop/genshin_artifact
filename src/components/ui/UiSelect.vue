<script setup lang="ts">
import { SelectRoot, SelectTrigger, SelectValue, SelectIcon, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'radix-vue'

defineProps<{ modelValue: string; label: string; options: { value: string; label: string }[] }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
</script>

<template>
    <SelectRoot :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
        <SelectTrigger class="select-trigger" :aria-label="label">
            <SelectValue /><SelectIcon class="chevron" aria-hidden="true" />
        </SelectTrigger>
        <SelectPortal>
            <SelectContent data-slot="ui-select-menu" position="popper" align="end" :side-offset="5" :collision-padding="8">
                <SelectViewport>
                    <SelectItem v-for="option in options" :key="option.value" class="select-item" :value="option.value">
                        <SelectItemText>{{ option.label }}</SelectItemText>
                        <SelectItemIndicator class="check" aria-hidden="true">✓</SelectItemIndicator>
                    </SelectItem>
                </SelectViewport>
            </SelectContent>
        </SelectPortal>
    </SelectRoot>
</template>

<style scoped>
.select-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 34px; padding: 6px 12px; border: 1px solid var(--cx-step-2); border-radius: 8px; color: var(--cx-letter); background: var(--cx-step); font: inherit; cursor: pointer; }
.select-trigger:is(:hover, [data-state="open"]) { border-color: var(--cx-gold); }
.select-trigger:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.chevron { font-size: 0; width: 6px; height: 6px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: translateY(-2px) rotate(45deg); }
.select-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 34px; padding: 4px 10px; box-sizing: border-box; border-radius: 8px; font-size: 14px; cursor: pointer; outline: none; }
.select-item[data-highlighted] { background: var(--cx-step); }
.select-item[data-state="checked"] { color: var(--cx-gold); background: color-mix(in srgb, var(--cx-gold) 13%, var(--cx-card)); font-weight: 600; }
.check { font-size: 13px; }
</style>

<style>
[data-slot="ui-select-menu"] { z-index: 2402; min-width: max(104px, var(--radix-select-trigger-width)); max-height: var(--radix-select-content-available-height); overflow: hidden; box-sizing: border-box; padding: 4px; border: 1px solid var(--cx-step-2); border-radius: 12px; background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 6px 20px rgb(0 0 0 / 18%); }
@media (prefers-reduced-motion: no-preference) {
    [data-slot="ui-select-menu"][data-state="open"] { transform-origin: var(--radix-select-content-transform-origin); animation: mona-select-enter 130ms ease-out; }
    @keyframes mona-select-enter { from { opacity: 0; transform: scale(.97); } }
}
</style>
