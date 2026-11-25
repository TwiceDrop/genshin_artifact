<template>
    <div class="welcome-launch" :class="{ visible }" :aria-hidden="!visible">
        <button v-for="(item, key, i) in features" :key="key" type="button" class="launch-card"
                :style="{ '--i': i }" :disabled="!visible" @click="router.push(item.path)">
            <component :is="item.icon" class="launch-icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
            <icon-ep-arrow-right class="launch-arrow" aria-hidden="true" />
        </button>
    </div>
</template>

<script setup lang="ts">
import {useRouter} from "vue-router"
import IconEpArrowRight from "~icons/ep/arrow-right"
import {useFeatureLinks} from "@/pages/MainPage/useFeatureLinks"

defineProps<{ visible: boolean }>()
const features = useFeatureLinks()
const router = useRouter()
</script>

<style scoped>
.welcome-launch {
    z-index: 1;
    width: min(100%, 760px);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: center;
    gap: 16px;
    flex: 1;
    padding-top: var(--wl-hero-dock-height);
    pointer-events: none;
}
.welcome-launch.visible { pointer-events: auto; }
.launch-card {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 78px;
    padding: 14px 20px;
    border: 1px solid var(--wl-card-ring);
    border-radius: 14px;
    background: var(--wl-card);
    color: var(--wl-letter);
    font: inherit;
    font-weight: 600;
    text-align: start;
    cursor: pointer;
    opacity: 0;
    transform: translateY(24px) scale(.97);
    transition: transform .48s var(--wl-ease), opacity .48s var(--wl-ease);
    transition-delay: calc(160ms + var(--i) * 40ms);
}
.visible .launch-card { opacity: 1; transform: none; }
.launch-icon { flex: none; width: 24px; height: 24px; color: var(--wl-gold); }
.launch-arrow { flex: none; margin-inline-start: auto; width: 14px; color: var(--wl-dim); }
.launch-card:hover, .launch-card:focus-visible {
    background: var(--wl-card-hover);
    border-color: var(--wl-card-ring-hover);
    box-shadow: 0 4px 18px var(--wl-card-glow);
}
.launch-card:focus-visible { outline: 2px solid var(--wl-gold); outline-offset: 3px; }

@media (max-width: 767px) {
    .welcome-launch { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .launch-card { min-height: 64px; padding: 10px 12px; gap: 8px; }
    .launch-icon { width: 20px; height: 20px; }
}
@media (prefers-reduced-motion: reduce) {
    .launch-card { transition: none; }
}
</style>
