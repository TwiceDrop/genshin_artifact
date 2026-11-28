<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from 'radix-vue'
import { useOverlayZIndex } from '@/composables/overlay-z-index'
const props = defineProps<{
    modelValue: boolean
    title: string
    width?: string
    maxWidth?: string
    maxHeight?: string
    top?: string
    animateWidth?: boolean
    preventOutside?: boolean
    hideClose?: boolean
    contentClass?: string
    focusContainer?: boolean
    initialFocus?: () => void
    returnFocus?: () => void
}>()
const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'escapeKeyDown', value: KeyboardEvent): void
    (event: 'closed'): void
}>()

const body = ref<HTMLDivElement | null>(null)
const zIndex = useOverlayZIndex(() => props.modelValue)
let previousFocus: HTMLElement | null = null
let heightAnimation: Animation | undefined

watch(() => props.modelValue, open => {
    if (open) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
}, { immediate: true, flush: 'sync' })

function focusOnOpen(event: Event) {
    if (props.initialFocus) {
        event.preventDefault()
        props.initialFocus()
    } else if (props.focusContainer && event.currentTarget instanceof HTMLElement) {
        event.preventDefault()
        event.currentTarget.focus()
    }
}

function restoreFocus(event: Event) {
    if (props.returnFocus) {
        event.preventDefault()
        props.returnFocus()
    } else if (previousFocus?.isConnected) {
        event.preventDefault()
        previousFocus.focus({ preventScroll: true })
    }
    if (!props.modelValue) emit('closed')
}

async function animateHeightChange(update: () => void) {
    const panel = body.value?.parentElement
    if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        heightAnimation?.cancel()
        update()
        return
    }

    // Read the current height before the slot updates, including any in-progress transition.
    const from = getComputedStyle(panel).height
    heightAnimation?.cancel()
    update()

    await nextTick()
    if (!props.modelValue || panel !== body.value?.parentElement) return
    const to = getComputedStyle(panel).height
    if (from === to) return

    const animation = panel.animate({ height: [from, to] }, { duration: 200, easing: 'ease-out' })
    heightAnimation = animation
    animation.onfinish = () => {
        if (heightAnimation === animation) heightAnimation = undefined
    }
}

defineExpose({ animateHeightChange })
</script>
<template>
    <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
        <DialogPortal>
            <DialogOverlay class="ui-dialog-overlay" :style="{ zIndex }" @pointerdown="preventOutside && $event.preventDefault()" />
            <DialogContent class="ui-dialog" :class="[contentClass, { 'ui-dialog-animate-width': animateWidth, 'ui-dialog-from-top': top }]"
                data-slot="dialog-content" :style="{ width, maxWidth, maxHeight, zIndex, '--ui-dialog-top': top }" :aria-describedby="undefined"
                @pointer-down-outside="preventOutside && $event.preventDefault()"
                @escape-key-down="emit('escapeKeyDown', $event)"
                @open-auto-focus="focusOnOpen" @close-auto-focus="restoreFocus">
                <header><DialogTitle class="ui-dialog-title"><slot name="title-icon" />{{ title }}</DialogTitle>
                    <DialogClose v-if="!hideClose" class="ui-dialog-close" aria-label="关闭"><i-ep-close aria-hidden="true" /></DialogClose>
                </header>
                <div v-if="$slots.toolbar" class="ui-dialog-toolbar"><slot name="toolbar" /></div>
                <div ref="body" class="ui-dialog-body"><slot /></div>
                <footer v-if="$slots.footer"><slot name="footer" /></footer>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
<style scoped>
.ui-dialog-overlay { position: fixed; inset: 0; background: rgba(6, 9, 20, .24); }
.ui-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; width: 480px; max-width: calc(100vw - 24px); max-height: 90vh; max-height: 90dvh; box-sizing: border-box; border-radius: 14px; border: 1px solid var(--cx-step-2); background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 18px 60px rgba(0, 0, 0, .16); outline: none; }
.ui-dialog-from-top { --ui-dialog-offset-y: 0%; top: var(--ui-dialog-top); max-height: calc(100dvh - var(--ui-dialog-top) - 12px); transform: translateX(-50%); }
.ui-dialog > header { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 58px; padding-inline: 18px 10px; }
.ui-dialog-title { display: flex; align-items: center; gap: 8px; margin: 0; padding-block: 8px; font-size: 18px; }
.ui-dialog-close { flex: 0 0 36px; height: 36px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; cursor: pointer; background: transparent; color: var(--cx-dim); }
.ui-dialog-close :deep(svg) { width: 18px; height: 18px; }
.ui-dialog-close:hover { background: var(--cx-step); }
.ui-dialog-close:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.ui-dialog-toolbar { flex: none; padding: 0 18px 12px; }
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
    from { opacity: 0; transform: translate(-50%, calc(var(--ui-dialog-offset-y, -50%) + 6px)) scale(.985); }
    to { opacity: 1; transform: translate(-50%, var(--ui-dialog-offset-y, -50%)) scale(1); }
}
@keyframes dialog-leave {
    from { opacity: 1; transform: translate(-50%, var(--ui-dialog-offset-y, -50%)) scale(1); }
    to { opacity: 0; transform: translate(-50%, calc(var(--ui-dialog-offset-y, -50%) + 4px)) scale(.99); }
}
</style>
