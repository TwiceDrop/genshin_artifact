<template>
    <div>
        <strong class="effect-name">{{ title }}</strong>
        <p class="effect-text"><component v-for="(run, index) in runs" :key="index"
            :is="run.tone ? 'strong' : run.italic ? 'em' : 'span'" :data-tone="run.tone">{{ run.text }}</component></p>
    </div>
</template>
<script setup>
import { computed } from 'vue'
import { gameTextRuns } from '@/import/game-text.mjs'

const props = defineProps({ title: String, effect: String })
const runs = computed(() => gameTextRuns(props.effect))
</script>
<style scoped>
/* The rich text is teleported with the popover. Use the document theme there. */
.effect-name { display: block; color: var(--cx-letter); font-size: 15px; font-weight: 700; }
.effect-text {
    --prose: #41465a; --gold: #805311; --pyro: #a23836; --hydro: #245a96; --anemo: #176954;
    --electro: #823b80; --dendro: #3e682b; --cryo: #166871; --geo: #795c10;
    margin: 7px 0 0; color: var(--prose); font-size: 14px; font-weight: 500; line-height: 1.7;
    white-space: pre-line; overflow-wrap: anywhere;
}
html[data-color-mode="dark"] .effect-text {
    --prose: #cbd1df; --gold: #ffd780; --pyro: #ff9999; --hydro: #80c0ff; --anemo: #80ffd7;
    --electro: #ffacff; --dendro: #99ff88; --cryo: #99ffff; --geo: #ffe699;
}
.effect-text strong { font-weight: 700; }
[data-tone="gold"] { color: var(--gold); }
[data-tone="pyro"] { color: var(--pyro); }
[data-tone="hydro"] { color: var(--hydro); }
[data-tone="anemo"] { color: var(--anemo); }
[data-tone="electro"] { color: var(--electro); }
[data-tone="dendro"] { color: var(--dendro); }
[data-tone="cryo"] { color: var(--cryo); display: inline-block; max-width: 100%; }
[data-tone="geo"] { color: var(--geo); }
</style>
