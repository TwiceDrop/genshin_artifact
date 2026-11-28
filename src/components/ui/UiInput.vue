<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: string | number }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const value = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', String(value)),
})
</script>

<template>
    <input v-model="value" class="ui-input" data-slot="input" />
</template>

<style scoped>
.ui-input { width: 100%; min-width: 0; min-height: 34px; box-sizing: border-box; border: 1px solid var(--cx-step-2); border-radius: 8px; padding: 5px 10px; background: var(--cx-card); color: var(--cx-letter); font: inherit; }
.ui-input:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.ui-input::placeholder { color: var(--cx-dim); }
</style>
