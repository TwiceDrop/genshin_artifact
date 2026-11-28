<script setup lang="ts">
import { computed, ref } from 'vue'
import UiHoverPreview from '../UiHoverPreview.vue'
import './sidebar.css'

const props = defineProps<{ collapsible?: boolean }>()
const hovered = ref(false), keyboard = ref(false), tapped = ref(false)
const expanded = computed(() => !props.collapsible || hovered.value || keyboard.value || tapped.value)

function onFocus(event: FocusEvent) {
    keyboard.value = (event.target as HTMLElement).matches(':focus-visible')
}
function onBlur(event: FocusEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) keyboard.value = false
}
function collapse() {
    hovered.value = keyboard.value = tapped.value = false
}
</script>

<template>
    <UiHoverPreview as="nav" target='[data-sidebar="menu-button"]'
         data-slot="sidebar" :data-state="expanded ? 'expanded' : 'collapsed'"
         :data-collapsible="collapsible ? 'icon' : undefined"
         @pointerenter="hovered = $event.pointerType === 'mouse'"
         @pointerleave="hovered = false" @focusin="onFocus" @focusout="onBlur"
         @keydown.esc="collapse">
        <button v-if="collapsible" type="button" class="sidebar-touch-trigger"
                aria-label="切换侧栏" :aria-expanded="expanded" @click="tapped = !tapped">
            <i-ep-menu aria-hidden="true" />
        </button>
        <slot />
    </UiHoverPreview>
</template>
