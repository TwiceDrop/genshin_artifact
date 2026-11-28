<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ as?: 'div' | 'nav'; target: string }>(), { as: 'div' })
const area = ref<HTMLElement | null>(null)
const preview = ref<HTMLElement | null>(null)
const visible = ref(false)
let active: HTMLElement | null = null
let pointer: { x: number, y: number } | null = null
let observer: ResizeObserver
let reducedMotion: MediaQueryList
let dismissTimer: ReturnType<typeof setTimeout> | undefined
let motion: Animation | undefined
let placed: { x: number, y: number } | undefined

function frame(x: number, y: number, scaleX = 1, scaleY = 1) {
    return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`
}

function positionPreview(animate = false) {
    const layer = preview.value, container = area.value
    if (!layer || !container || !active) return
    const bounds = container.getBoundingClientRect()
    const item = active.getBoundingClientRect()
    if (!item.width || !item.height) {
        hide()
        return
    }
    const originX = bounds.left + container.clientLeft - container.scrollLeft
    const originY = bounds.top + container.clientTop - container.scrollTop
    const x = item.left - originX, y = item.top - originY
    const previous = animate && visible.value && !reducedMotion.matches ? layer.getBoundingClientRect() : null
    layer.style.width = `${item.width}px`
    layer.style.height = `${item.height}px`
    if (placed && x === placed.x && y === placed.y) return

    placed = { x, y }
    // Retarget from the rendered frame to keep fast reversals continuous.
    motion?.cancel()
    layer.style.transform = frame(x, y)
    if (!previous) return

    const fromX = previous.left + (previous.width - item.width) / 2 - originX
    const fromY = previous.top + (previous.height - item.height) / 2 - originY
    const dx = x - fromX, dy = y - fromY
    const distance = Math.hypot(dx, dy)
    if (distance < 1) return

    const vertical = Math.abs(dy) >= Math.abs(dx)
    const length = vertical ? item.height : item.width
    const cross = vertical ? item.width : item.height
    const stretch = 1 + Math.min(.18, 8 / length, .08 + distance / 750)
    const squeeze = 1 - Math.min(.04, 4 / cross)
    const rebound = 1 - Math.min(.03, 4 / length)
    const overshoot = Math.min(3 / distance, .1)
    motion = layer.animate([
        { transform: frame(fromX, fromY, previous.width / item.width, previous.height / item.height), easing: 'cubic-bezier(.22,.7,.32,1)' },
        { transform: frame(fromX + dx * .76, fromY + dy * .76, vertical ? squeeze : stretch, vertical ? stretch : squeeze), offset: .43, easing: 'ease-out' },
        { transform: frame(x + dx * overshoot, y + dy * overshoot, vertical ? 1 : rebound, vertical ? rebound : 1), offset: .78, easing: 'ease-out' },
        { transform: frame(x, y) },
    ], { duration: distance > 90 ? 205 : 225 })
}

function hide() {
    clearTimeout(dismissTimer)
    dismissTimer = undefined
    if (active) observer.unobserve(active)
    active = null
    visible.value = false
}

function leave() {
    pointer = null
    hide()
}

function previewAt(element: Element | null, animate: boolean) {
    const item = element?.closest<HTMLElement>(props.target)
    if (!item || !area.value?.contains(item)) {
        // Give the pointer time to cross the gap between adjacent items.
        if (visible.value && dismissTimer === undefined) dismissTimer = setTimeout(hide, 65)
        return
    }
    clearTimeout(dismissTimer)
    dismissTimer = undefined
    if (item !== active) {
        if (active) observer.unobserve(active)
        active = item
        observer.observe(item)
        positionPreview(animate)
        visible.value = true
    } else if (!animate) {
        positionPreview()
    }
}

function move(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    pointer = { x: event.clientX, y: event.clientY }
    previewAt(event.target as Element, true)
}

function onScroll() {
    if (pointer) previewAt(document.elementFromPoint(pointer.x, pointer.y), false)
}

function onMotionChange() {
    if (reducedMotion.matches) motion?.cancel()
}

onMounted(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.addEventListener('change', onMotionChange)
    observer = new ResizeObserver(() => positionPreview())
    observer.observe(area.value!)
})

onBeforeUnmount(() => {
    clearTimeout(dismissTimer)
    motion?.cancel()
    observer.disconnect()
    reducedMotion.removeEventListener('change', onMotionChange)
})
</script>

<template>
    <component :is="props.as" ref="area" class="ui-hover-area" :data-hover-preview="visible || undefined"
               @pointermove="move" @pointerleave="leave" @pointercancel="leave"
               @scroll.capture="onScroll" @keydown.esc="leave">
        <span ref="preview" class="ui-hover-preview" aria-hidden="true" />
        <slot />
    </component>
</template>

<style>
.ui-hover-area { position: relative; isolation: isolate; }
.ui-hover-preview {
    display: none;
    position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none;
    border-radius: var(--hover-preview-radius, 14px);
    background: var(--hover-preview-fill, transparent);
    box-shadow: var(--hover-preview-edge, inset 0 0 0 2px color-mix(in srgb, var(--cx-dim) 72%, transparent));
    opacity: 0; scale: .97;
    transition: opacity 140ms ease-out, scale 140ms ease-out, display 140ms allow-discrete;
}
[data-hover-preview="true"] > .ui-hover-preview { display: block; opacity: 1; scale: 1; }
@starting-style {
    [data-hover-preview="true"] > .ui-hover-preview { opacity: 0; scale: .97; }
}
@media (prefers-reduced-motion: reduce) {
    .ui-hover-preview { transition: opacity 100ms ease-out, display 100ms allow-discrete; }
    .ui-hover-preview, [data-hover-preview="true"] > .ui-hover-preview { scale: 1; }
}
</style>
