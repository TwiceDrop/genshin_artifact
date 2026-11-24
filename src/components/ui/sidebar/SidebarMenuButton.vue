<script setup lang="ts">
defineProps<{ isActive?: boolean }>()
</script>

<template>
    <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button"
            :data-active="!!isActive" :aria-current="isActive ? 'page' : undefined">
        <slot />
    </button>
</template>
