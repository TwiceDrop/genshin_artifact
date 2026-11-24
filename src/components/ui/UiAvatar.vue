<script setup lang="ts">
import { AvatarRoot, AvatarImage, AvatarFallback } from 'radix-vue'
defineProps<{ src?: string }>()
</script>
<template>
    <AvatarRoot data-slot="avatar" class="ui-avatar">
        <AvatarImage v-if="src" :src="src" alt="" class="ui-avatar-image" />
        <AvatarFallback><slot /></AvatarFallback>
    </AvatarRoot>
</template>
<style scoped>
.ui-avatar { display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; }
.ui-avatar-image { width: 100%; height: 100%; object-fit: cover; }
</style>
