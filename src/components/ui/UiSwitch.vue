<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'radix-vue'

defineProps<{ modelValue: boolean; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
</script>

<template>
    <SwitchRoot class="ui-switch" data-slot="switch" :checked="modelValue" :disabled="disabled" @update:checked="emit('update:modelValue', $event)">
        <SwitchThumb class="ui-switch-thumb" />
    </SwitchRoot>
</template>

<style>
.ui-switch { display: inline-flex; flex: none; align-items: center; box-sizing: border-box; width: 38px; height: 22px; padding: 2px; border: 1px solid var(--cx-dim); border-radius: 999px; background: var(--cx-step-2); cursor: pointer; }
.ui-switch[data-state="checked"] { background: var(--cx-gold); border-color: var(--cx-gold); }
.ui-switch-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--cx-dim); }
.ui-switch-thumb[data-state="checked"] { transform: translateX(16px); background: var(--cx-gold-on); }
.ui-switch:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.ui-switch:disabled { opacity: .5; cursor: default; }
@media (prefers-reduced-motion: no-preference) { .ui-switch-thumb { transition: transform 140ms ease-out; } }
</style>
