<script setup lang="ts">
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'radix-vue'
defineProps<{ title: string }>()
</script>

<template>
    <AccordionRoot type="single" collapsible>
        <AccordionItem value="detail">
            <AccordionHeader class="team-disclosure-heading">
                <AccordionTrigger class="team-disclosure-trigger">{{ title }}<i-ep-arrow-down aria-hidden="true" /></AccordionTrigger>
            </AccordionHeader>
            <AccordionContent class="team-disclosure-body"><slot /></AccordionContent>
        </AccordionItem>
    </AccordionRoot>
</template>

<style scoped>
.team-disclosure-heading { margin: 0; }
.team-disclosure-trigger { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 46px; padding: 0; border: 0; color: var(--cx-letter); background: transparent; font: inherit; font-size: 19px; font-weight: 650; cursor: pointer; text-align: left; }
.team-disclosure-trigger[data-state="open"] svg { transform: rotate(180deg); }
.team-disclosure-trigger:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.team-disclosure-body { padding-bottom: 12px; color: var(--cx-dim); }
@media (max-width: 550px) { .team-disclosure-trigger { font-size: 18px; } }
</style>
