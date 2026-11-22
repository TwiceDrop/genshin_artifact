<template>
    <img :key="source" :src="source" :style="portraitStyle" @error="failedSource = preferredSource" />
</template>

<script>
const portraits = require.context('@/images/character-portraits', false, /\.webp$/)
const portraitKeys = new Set(portraits.keys())
</script>

<script setup>
import { computed, ref } from 'vue'
import { characterPortraitFocus } from '@/assets/character-portrait-focus'

const props = defineProps({ characterName: String, avatar: String, splash: String })
const failedSource = ref(null)
const preferredSource = computed(() => {
    const key = `./${props.characterName}.webp`
    return portraitKeys.has(key) ? portraits(key) : props.splash || props.avatar
})
const source = computed(() => preferredSource.value === failedSource.value ? props.avatar : preferredSource.value)
const portraitStyle = computed(() => {
    const focus = source.value === props.avatar ? 50 : characterPortraitFocus(props.characterName)
    // Zoom from the nearer edge until the subject is centered. Limit the crop to retain the upper body.
    const pickerZoom = Math.min(1.7, 50 / Math.min(focus, 100 - focus))
    return {
        '--portrait-focus-x': `${focus}%`,
        '--picker-portrait-zoom': pickerZoom,
        '--picker-portrait-origin': focus > 50 ? 'right top' : 'left top',
    }
})
</script>
