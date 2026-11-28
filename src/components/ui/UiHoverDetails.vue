<script setup>
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from 'radix-vue'
import { ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useOverlayZIndex } from '@/composables/overlay-z-index'
import UiPopover from './UiPopover.vue'
const props = defineProps({ enabled: Boolean, tapLabel: String, side: String })
const touch = useMediaQuery('(hover: none), (pointer: coarse)')
const open = ref(false)
const zIndex = useOverlayZIndex(() => open.value && !(props.tapLabel && touch.value))
function changeOpen(next) { open.value = props.enabled && next }
watch(() => props.enabled, enabled => { if (!enabled) open.value = false })
defineExpose({ dismiss: () => changeOpen(false) })
</script>
<template>
    <UiPopover v-if="tapLabel && touch" :open="open" @update:open="changeOpen" :label="tapLabel" :side="side || 'right'">
        <template #trigger><slot name="trigger" /></template>
        <slot />
    </UiPopover>
    <TooltipProvider v-else :delay-duration="0" disable-hoverable-content>
        <TooltipRoot :open="open" @update:open="changeOpen">
            <TooltipTrigger as-child><slot name="trigger" /></TooltipTrigger>
            <TooltipPortal>
                <TooltipContent v-if="enabled" class="mona-hover-details mona-hover-enter" :style="{ zIndex }"
                    :side="side || 'right'" align="start" :side-offset="8" :collision-padding="12">
                    <slot />
                </TooltipContent>
            </TooltipPortal>
        </TooltipRoot>
    </TooltipProvider>
</template>
<style>
/* Radix portals the content to body outside the component's scoped root. */
.mona-hover-details { width: min(340px, calc(100vw - 24px)); box-sizing: border-box; max-height: min(65vh, var(--radix-tooltip-content-available-height)); overflow-y: auto; padding: 14px 16px; border: 1px solid var(--cx-step-2); border-radius: 12px; background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 6px 24px rgba(0,0,0,.2); }
[data-radix-popper-content-wrapper]:has(> .mona-hover-details), .mona-hover-details { pointer-events: none; }
</style>
