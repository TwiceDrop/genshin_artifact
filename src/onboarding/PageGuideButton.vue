<template>
    <UiButton class="page-guide-button" :aria-label="label" :title="label" @click="startGuide(guideId, router)">?</UiButton>
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import {useRouter} from 'vue-router'
import {startGuide} from './controller.mjs'

withDefaults(defineProps<{guideId: string, label?: string}>(), {label: '查看本页引导'})
const router = useRouter()
</script>

<style scoped>
.page-guide-button {display: inline-grid; place-items: center; vertical-align: middle; flex: none;
    width: 30px; min-height: 0; height: 30px; padding: 0; border: 1px solid var(--cx-step-2); border-radius: 50%;
    background: var(--cx-card); color: var(--cx-dim); font: 600 15px/1 sans-serif; cursor: pointer;}
.page-guide-button:hover {background: var(--cx-step); color: var(--cx-letter);}
.page-guide-button:focus-visible {outline: 2px solid var(--cx-gold); outline-offset: 2px;}
@media (pointer: coarse) {
    .page-guide-button {min-width: 40px; min-height: 40px;}
}
</style>
