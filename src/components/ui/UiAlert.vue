<script setup lang="ts">
defineProps<{ tone: 'error' | 'warning' | 'success'; hideIcon?: boolean }>()
</script>

<template>
    <div class="ui-alert" :class="{ 'ui-alert-no-icon': hideIcon }" :data-tone="tone" :role="tone === 'success' ? 'status' : 'alert'">
        <template v-if="!hideIcon">
            <i-ep-circle-check v-if="tone === 'success'" aria-hidden="true" />
            <i-ep-warning v-else aria-hidden="true" />
        </template>
        <div><slot /></div>
    </div>
</template>

<style scoped>
.ui-alert { --alert-accent: var(--cx-gold); display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--alert-accent) 42%, var(--cx-step-2)); border-radius: 8px; background: color-mix(in srgb, var(--alert-accent) 8%, var(--cx-card)); color: var(--cx-letter); font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
.ui-alert-no-icon { grid-template-columns: minmax(0, 1fr); }
.ui-alert[data-tone="error"] { --alert-accent: var(--cx-up); }
.ui-alert[data-tone="success"] { --alert-accent: var(--cx-down); }
.ui-alert svg { color: var(--alert-accent); width: 16px; height: 16px; margin-top: 2px; }
</style>
