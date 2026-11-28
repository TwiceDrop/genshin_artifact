<template>
    <div class="character-element-tabs" role="group" aria-label="按元素筛选">
        <UiButton :aria-pressed="modelValue === 'all'" @click="emit('update:modelValue', 'all')">全部</UiButton>
        <UiButton v-for="(label, element) in ELEMENT_NAMES" :key="element"
            :aria-pressed="modelValue === element" @click="emit('update:modelValue', element)">
            <img :src="elementIcons[element]" alt="" />{{ label }}
        </UiButton>
    </div>
</template>

<script setup>
import UiButton from '@/components/ui/UiButton.vue'
import { ELEMENT_NAMES } from '@/import/character-summary.mjs'
import elementIcons from '@/assets/element-icons'

defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.character-element-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.character-element-tabs button { display: inline-flex; align-items: center; gap: 5px; flex: none; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--cx-step); color: var(--cx-dim); font: inherit; font-size: 13px; cursor: pointer; }
.character-element-tabs button:hover { background: var(--cx-step-2); color: var(--cx-letter); }
.character-element-tabs button[aria-pressed=true] { background: var(--cx-gold); color: var(--cx-gold-on); font-weight: 600; }
.character-element-tabs button:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.character-element-tabs button[aria-pressed=true]:focus-visible { outline-color: var(--cx-gold-on); }
.character-element-tabs img { width: 18px; height: 18px; object-fit: contain; }
</style>
