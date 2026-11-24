<script setup lang="ts">
import { DropdownMenuItem, DropdownMenuSeparator } from 'radix-vue'
defineProps<{ disabled?: boolean; divided?: boolean }>()
const emit = defineEmits<{ (event: 'select'): void }>()
</script>
<template>
    <DropdownMenuSeparator v-if="divided" class="ui-menu-rule" />
    <DropdownMenuItem data-slot="dropdown-menu-item" class="ui-menu-item" :disabled="disabled" @select="emit('select')"><slot /></DropdownMenuItem>
</template>
<style scoped>
.ui-menu-item { display: flex; align-items: center; gap: 12px; min-height: 42px; padding: 6px 10px; box-sizing: border-box; border-radius: 7px; font-size: 14px; line-height: 1.4; cursor: pointer; outline: none; }
.ui-menu-item[data-highlighted] { background: var(--cx-step); }
.ui-menu-item[data-disabled] { opacity: .5; cursor: default; }
.ui-menu-rule { margin: 5px 8px; height: 1px; background: var(--cx-step-2); }
</style>
