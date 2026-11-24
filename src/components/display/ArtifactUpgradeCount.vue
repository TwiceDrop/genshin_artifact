<template>
    <small v-if="count" class="artifact-upgrade-count" :aria-label="`强化命中 ${count} 次`">×{{ count }}</small>
</template>
<script setup lang="ts">
defineProps<{ count?: number }>()
</script>
<style scoped>
.artifact-upgrade-count { display: inline-block; margin-inline-start: 3px; padding: 0 3px; border-radius: 4px; background: var(--cx-step-2); color: inherit; font-size: 10px; font-weight: 600; line-height: 1.4; white-space: nowrap; }
</style>
