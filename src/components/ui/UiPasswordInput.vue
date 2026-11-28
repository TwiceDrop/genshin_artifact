<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { ref } from 'vue'
import UiInput from './UiInput.vue'

defineProps<{ modelValue: string; disabled?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const visible = ref(false)
</script>

<template>
    <span class="password-field" :class="$attrs.class" :style="$attrs.style">
        <UiInput v-bind="{ ...$attrs, class: undefined, style: undefined }" :model-value="modelValue"
            :type="visible ? 'text' : 'password'" :disabled="disabled" :readonly="readonly"
            @update:model-value="emit('update:modelValue', $event)" />
        <button v-if="modelValue && !disabled && !readonly" type="button" class="password-toggle"
            aria-label="显示密码" :aria-pressed="visible" @mousedown.prevent @click="visible = !visible">
            <i-ep-view v-if="visible" aria-hidden="true" />
            <i-ep-hide v-else aria-hidden="true" />
        </button>
    </span>
</template>

<style scoped>
.password-field { display: block; position: relative; min-width: 0; color: var(--cx-letter); }
.password-field .ui-input { padding-inline-end: 40px; }
.password-toggle { position: absolute; inset-block: 2px; inset-inline-end: 4px; display: grid; place-items: center; width: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--cx-dim); cursor: pointer; }
.password-toggle:hover { color: var(--cx-letter); }
.password-toggle:focus-visible { outline: 2px solid var(--cx-gold); }
</style>
