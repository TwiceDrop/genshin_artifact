<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'radix-vue'
import { useOverlayZIndex } from '@/composables/overlay-z-index'

defineProps<{ message: string }>()
const zIndex = useOverlayZIndex(() => true)
let previousFocus: HTMLElement | null = null

function rememberFocus() {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
}

function restoreFocus(event: Event) {
    if (!previousFocus?.isConnected) return
    event.preventDefault()
    previousFocus.focus({ preventScroll: true })
}
</script>

<template>
    <DialogRoot open>
        <DialogPortal>
            <DialogOverlay class="loading-backdrop" :style="{ zIndex }" />
            <DialogContent class="loading-panel" :style="{ zIndex }" :aria-describedby="undefined"
                @escape-key-down.prevent @pointer-down-outside.prevent
                @open-auto-focus="rememberFocus" @close-auto-focus="restoreFocus">
                <div class="loading-spinner" aria-hidden="true"></div>
                <DialogTitle class="loading-label">{{ message }}</DialogTitle>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped>
.loading-backdrop { position: fixed; inset: 0; background: color-mix(in srgb, var(--cx-card) 85%, transparent); }
.loading-panel { position: fixed; top: 50%; left: 50%; display: grid; justify-items: center; gap: 8px; transform: translate(-50%, -50%); color: var(--cx-letter); outline: none; }
.loading-label { margin: 0; font-size: 14px; font-weight: 400; }
.loading-spinner { width: 32px; height: 32px; border: 3px solid var(--cx-step-2); border-top-color: var(--cx-gold); border-radius: 50%; animation: loading-spin .85s linear infinite; }
@keyframes loading-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none; } }
</style>
