<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, PopoverArrow } from 'radix-vue'
import { useOverlayZIndex } from '@/composables/overlay-z-index'

const props = withDefaults(defineProps<{ open: boolean; label: string; contentClass?: string; side?: 'left' | 'right' | 'top' | 'bottom' }>(), { side: 'bottom' })
const emit = defineEmits<{ (event: 'update:open', value: boolean): void }>()
const zIndex = useOverlayZIndex(() => props.open)
</script>
<template>
    <PopoverRoot :open="open" @update:open="emit('update:open', $event)">
        <PopoverTrigger as-child><slot name="trigger" /></PopoverTrigger>
        <PopoverPortal>
            <PopoverContent class="mona-popover" :class="contentClass" :style="{ zIndex }" :aria-label="label" :side="side" align="center" :side-offset="9" :collision-padding="12">
                <div class="mona-popover-body"><slot /></div>
                <PopoverArrow class="mona-popover-arrow" :width="12" :height="6" />
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>
<style>
.mona-popover { box-sizing: border-box; width: min(310px, calc(100vw - 24px)); max-width: var(--radix-popover-content-available-width); border: 1px solid var(--cx-step-2); border-radius: 12px; background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 6px 24px rgba(0, 0, 0, .2); outline: none; }
.mona-popover-body { padding: 12px 14px; max-height: min(52vh, var(--radix-popover-content-available-height)); box-sizing: border-box; overflow-y: auto; }
.mona-popover-arrow { fill: var(--cx-card); }
@media (prefers-reduced-motion: no-preference) {
    .mona-popover[data-state="open"] { transform-origin: var(--radix-popover-content-transform-origin); animation: mona-popover-enter 130ms ease-out; }
    @keyframes mona-popover-enter { from { opacity: 0; transform: scale(.97); } }
}
</style>
