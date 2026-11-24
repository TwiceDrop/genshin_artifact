<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean, label: string }>()
const emit = defineEmits<{ (event: 'update:open', value: boolean): void }>()
const sheet = ref<HTMLDialogElement | null>(null)
watch([() => props.open, sheet], () => {
    if (props.open && sheet.value && !sheet.value.open) sheet.value.showModal()
    else if (!props.open && sheet.value?.open) sheet.value.close()
}, { flush: 'post' })
</script>

<template>
    <dialog ref="sheet" class="sidebar-sheet" data-slot="sheet-content" :aria-label="label"
            @close="emit('update:open', false)" @click.self="sheet?.close()">
        <div class="sidebar-sheet-body">
            <slot />
            <button type="button" class="sidebar-sheet-close" aria-label="关闭侧栏" @click="sheet?.close()">
                <i-ep-close aria-hidden="true" />
            </button>
        </div>
    </dialog>
</template>
