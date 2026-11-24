<script setup lang="ts">
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent } from 'radix-vue'
defineProps<{ contentClass?: string }>()
</script>
<template>
    <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child><slot name="trigger" /></DropdownMenuTrigger>
        <DropdownMenuPortal>
            <DropdownMenuContent data-slot="dropdown-menu-content" class="ui-menu" :class="contentClass"
                                 align="end" :side-offset="6" :collision-padding="8">
                <slot />
            </DropdownMenuContent>
        </DropdownMenuPortal>
    </DropdownMenuRoot>
</template>
<style>
[data-slot="dropdown-menu-content"].ui-menu { z-index: 2401; min-width: 144px; max-height: var(--radix-dropdown-menu-content-available-height); overflow-y: auto; padding: 6px; box-sizing: border-box; border-radius: 12px; border: 1px solid var(--cx-step-2); background: var(--cx-card); color: var(--cx-letter); box-shadow: 0 8px 28px rgba(0, 0, 0, .16); }
@media (prefers-reduced-motion: no-preference) {
    .ui-menu[data-slot="dropdown-menu-content"] { transform-origin: var(--radix-dropdown-menu-content-transform-origin); }
    .ui-menu[data-state="open"] { animation: mona-menu-enter 160ms ease-out; }
    .ui-menu[data-state="closed"] { animation: mona-menu-leave 110ms ease-in; pointer-events: none; }
}
@keyframes mona-menu-enter { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
@keyframes mona-menu-leave { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.97); } }
</style>
