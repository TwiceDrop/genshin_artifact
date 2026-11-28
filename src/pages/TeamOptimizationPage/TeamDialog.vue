<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import UiDialog from '@/components/ui/UiDialog.vue'

defineProps<{ modelValue: boolean; title: string; width: string; viewport?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
const mobile = useMediaQuery('(max-width: 767px)')
</script>

<template>
    <UiDialog :model-value="modelValue" :title="title" :width="mobile ? 'calc(100vw - 16px)' : width"
        :max-width="mobile ? 'calc(100vw - 16px)' : '96vw'" :top="mobile ? 'calc(8px + env(safe-area-inset-top))' : viewport ? '10vh' : '15vh'"
        :max-height="mobile ? 'calc(100dvh - 24px)' : viewport ? '80vh' : undefined"
        @update:model-value="emit('update:modelValue', $event)">
        <slot />
        <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </UiDialog>
</template>
