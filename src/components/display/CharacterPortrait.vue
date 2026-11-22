<template>
    <PortraitThumbnail v-if="thumbnail" :key="source" :src="source" :zoom="pickerZoom"
        :align-right="focus > 50" @error="failedSource = preferredSource" />
    <img v-else :key="source" :src="source" :style="{ '--portrait-focus-x': focus + '%' }" @error="failedSource = preferredSource" />
</template>

<script>
const portraits = require.context('@/images/character-portraits', false, /\.webp$/)
const portraitKeys = new Set(portraits.keys())
</script>

<script setup>
import { computed, ref } from 'vue'
import PortraitThumbnail from './PortraitThumbnail.vue'
import { characterPortraitFocus } from '@/assets/character-portrait-focus'

const props = defineProps({ characterName: String, avatar: String, splash: String, thumbnail: Boolean })
const failedSource = ref(null)
const preferredSource = computed(() => {
    const key = `./${props.characterName}.webp`
    return portraitKeys.has(key) ? portraits(key) : props.splash || props.avatar
})
const source = computed(() => preferredSource.value === failedSource.value ? props.avatar : preferredSource.value)
const focus = computed(() => source.value === props.avatar ? 50 : characterPortraitFocus(props.characterName))
const pickerZoom = computed(() => Math.min(1.7, 50 / Math.min(focus.value, 100 - focus.value)))
</script>
