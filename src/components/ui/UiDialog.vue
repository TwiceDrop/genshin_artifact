<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from 'radix-vue'
defineProps<{ modelValue: boolean; title: string; width?: string; animateWidth?: boolean; preventOutside?: boolean; returnFocus?: () => void }>()
const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'escapeKeyDown', value: KeyboardEvent): void
}>()
</script>
<template>
    <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
        <DialogPortal>
            <DialogOverlay class="ui-dialog-overlay" />
            <DialogContent class="ui-dialog" :class="{ 'ui-dialog-animate-width': animateWidth }" data-slot="dialog-content" :style="{ width }" :aria-describedby="undefined"
                @pointer-down-outside="preventOutside && $event.preventDefault()"
                @escape-key-down="emit('escapeKeyDown', $event)"
                @close-auto-focus="returnFocus && ($event.preventDefault(), returnFocus())">
                <header><DialogTitle class="ui-dialog-title">{{ title }}</DialogTitle>
                    <DialogClose class="ui-dialog-close" aria-label="关闭"><i-ep-close aria-hidden="true" /></DialogClose>
                </header>
                <div class="ui-dialog-body"><slot /></div>
                <footer v-if="$slots.footer"><slot name="footer" /></footer>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
<style scoped>
.ui-dialog-overlay { position: fixed; inset: 0; z-index: 2400; background: rgba(6, 9, 20, .24); }
.ui-dialog { position: fixed; z-index: 2400; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; width: 480px; max-width: calc(100vw - 24px); max-height: 90vh; max-height: 90dvh; box-sizing: border-box; border-radius: 14px; border: 1px solid var(--cx-step-2); background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 18px 60px rgba(0, 0, 0, .16); outline: none; }
.ui-dialog > header { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 58px; padding-inline-start: 18px; }
.ui-dialog-title { margin: 0; padding-block: 8px; font-size: 18px; }
.ui-dialog-close { flex: 0 0 56px; height: 56px; align-self: flex-start; display: grid; place-items: center; padding: 0; border: 0; border-radius: 0 13px 0 10px; cursor: pointer; background: transparent; color: var(--cx-dim); }
.ui-dialog-close :deep(svg) { width: 18px; height: 18px; }
.ui-dialog-close:hover { background: var(--cx-step); }
.ui-dialog-close:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -3px; }
.ui-dialog-body { min-height: 0; padding: 4px 18px 18px; overflow: auto; overscroll-behavior: contain; }
.ui-dialog footer { padding: 0 18px 16px; text-align: end; }
@media (prefers-reduced-motion: no-preference) {
    .ui-dialog-overlay[data-state="open"] { animation: overlay-enter 180ms ease-out; }
    .ui-dialog-overlay[data-state="closed"] { animation: overlay-leave 130ms ease-in; }
    .ui-dialog[data-state="open"] { animation: dialog-enter 180ms ease-out; }
    .ui-dialog[data-state="closed"] { animation: dialog-leave 130ms ease-in; }
    .ui-dialog.ui-dialog-animate-width { transition: width 200ms ease; }
}
@keyframes overlay-enter { from { opacity: 0; } to { opacity: 1; } }
@keyframes overlay-leave { from { opacity: 1; } to { opacity: 0; } }
@keyframes dialog-enter {
    from { opacity: 0; transform: translate(-50%, calc(-50% + 6px)) scale(.985); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes dialog-leave {
    from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    to { opacity: 0; transform: translate(-50%, calc(-50% + 4px)) scale(.99); }
}
</style>
