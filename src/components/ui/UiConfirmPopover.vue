<script setup lang="ts">
import { ref } from 'vue'
import UiButton from './UiButton.vue'
import UiPopover from './UiPopover.vue'

withDefaults(defineProps<{
    title: string
    confirmText: string
    cancelText: string
    side?: 'left' | 'right' | 'top' | 'bottom'
}>(), { side: 'top' })
const emit = defineEmits<{ (event: 'confirm'): void }>()
const open = ref(false)

function confirm() {
    open.value = false
    emit('confirm')
}
</script>

<template>
    <UiPopover v-model:open="open" :label="title" :side="side" content-class="ui-confirm-popover">
        <template #trigger><slot /></template>
        <p class="confirmation-text">
            <i-ep-question-filled aria-hidden="true" />
            <span>{{ title }}</span>
        </p>
        <div class="confirmation-actions">
            <UiButton size="small" @click="open = false">{{ cancelText }}</UiButton>
            <UiButton size="small" variant="primary" @click="confirm">{{ confirmText }}</UiButton>
        </div>
    </UiPopover>
</template>

<style scoped>
.confirmation-text { display: flex; align-items: flex-start; gap: 6px; margin: 0 0 8px; font-size: 13px; }
.confirmation-text svg { margin-top: 2px; flex: none; color: var(--cx-gold); }
.confirmation-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>

<style>
.mona-popover.ui-confirm-popover { width: max-content; min-width: 150px; max-width: min(310px, var(--radix-popover-content-available-width)); }
</style>
