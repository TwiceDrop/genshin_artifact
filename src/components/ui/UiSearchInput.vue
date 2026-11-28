<script setup lang="ts">
import { ref } from 'vue'
import UiButton from './UiButton.vue'
import UiInput from './UiInput.vue'

defineProps<{ modelValue: string; placeholder: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const input = ref<InstanceType<typeof UiInput> | null>(null)

function clear() {
    emit('update:modelValue', '')
    input.value?.$el.focus()
}
</script>

<template>
    <div class="ui-search">
        <i-ep-search class="ui-search-icon" aria-hidden="true" />
        <UiInput ref="input" class="ui-search-field" type="search" :model-value="modelValue" :placeholder="placeholder" :aria-label="placeholder"
            @update:model-value="emit('update:modelValue', $event)" />
        <UiButton v-if="modelValue" class="ui-search-clear" size="small" aria-label="清除搜索" @click="clear"><i-ep-close aria-hidden="true" /></UiButton>
    </div>
</template>

<style scoped>
.ui-search { position: relative; min-width: 0; }
.ui-search-icon { position: absolute; top: 50%; inset-inline-start: 10px; transform: translateY(-50%); color: var(--cx-dim); pointer-events: none; }
.ui-search-field[data-slot="input"] { padding-inline: 32px; font-size: 13px; }
.ui-search-field::-webkit-search-cancel-button { display: none; }
.ui-search-clear[data-slot="button"] { position: absolute; top: 50%; inset-inline-end: 3px; transform: translateY(-50%); width: 28px; padding: 0; border: 0; background: transparent; color: var(--cx-dim); }
</style>
