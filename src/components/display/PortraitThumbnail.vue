<template>
    <span class="portrait-thumbnail">
        <img ref="original" :src="src" :alt="alt" :loading="loading"
            :style="{ transform: 'scale(' + zoom + ')', transformOrigin: alignRight ? 'right top' : 'left top' }"
            @load="paint" @error="$emit('error')" />
        <canvas ref="canvas" aria-hidden="true"></canvas>
    </span>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ src: String, alt: String, loading: String, zoom: Number, alignRight: Boolean })
defineEmits(['error'])
const original = ref(null), canvas = ref(null)
let observer

function paint() {
    const image = original.value, target = canvas.value
    if (!image?.naturalWidth || !target?.clientWidth || !target.clientHeight) return
    const width = Math.round(target.clientWidth * window.devicePixelRatio)
    const height = Math.round(target.clientHeight * window.devicePixelRatio)
    target.width = width
    target.height = height
    const context = target.getContext('2d')
    if (!context) return

    // Match object-fit: cover, top center, followed by the picker's edge-anchored zoom.
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
    const cropWidth = width / scale, cropHeight = height / scale
    const x = (image.naturalWidth - cropWidth) / 2 + (props.alignRight ? cropWidth * (1 - 1 / props.zoom) : 0)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, x, 0, cropWidth / props.zoom, cropHeight / props.zoom, 0, 0, width, height)
    // Keep the image's alt text and lazy loading while displaying the filtered pixels.
    image.style.opacity = '0'
}

onMounted(() => {
    observer = new ResizeObserver(paint)
    observer.observe(canvas.value, { box: 'device-pixel-content-box' })
})
watch(() => [props.zoom, props.alignRight], paint, { flush: 'post' })
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.portrait-thumbnail { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; }
.portrait-thumbnail img, .portrait-thumbnail canvas { display: block; width: 100%; height: 100%; }
.portrait-thumbnail img { object-fit: cover; object-position: top center; }
.portrait-thumbnail canvas { position: absolute; inset: 0; pointer-events: none; }
</style>
