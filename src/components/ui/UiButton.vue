<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'outline' | 'primary' | 'danger'; size?: 'small'; loading?: boolean; disabled?: boolean; type?: 'button' | 'submit' | 'reset' }>(), { variant: 'outline', type: 'button' })
</script>
<template>
    <button data-slot="button" class="ui-button" :data-variant="variant" :data-size="size" :aria-busy="loading || undefined" :disabled="disabled || loading" :type="type">
        <span v-if="loading" class="ui-spinner" aria-hidden="true" /><slot />
    </button>
</template>
<style scoped>
.ui-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 6px 13px; box-sizing: border-box; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); color: var(--cx-letter); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.ui-button:hover:enabled { background: var(--cx-step-2); }
.ui-button[data-variant="primary"] { background: var(--cx-gold); border-color: var(--cx-gold); color: var(--cx-gold-on); }
.ui-button[data-variant="primary"]:hover:enabled { background: var(--cx-gold); filter: brightness(1.06); }
.ui-button[data-variant="danger"] { color: var(--cx-up); }
.ui-button[data-size="small"] { min-height: 28px; font-size: 12px; padding: 3px 9px; }
.ui-button:disabled { opacity: .5; cursor: default; }
.ui-button:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.ui-spinner { width: .9em; height: .9em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ui-spinner { animation: none; } }
</style>
