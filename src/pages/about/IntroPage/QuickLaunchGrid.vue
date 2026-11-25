<template>
    <div class="welcome-launch" :class="{ visible }" :aria-hidden="!visible">
        <div v-for="(item, key, i) in features" :key="key" class="launch-item" :style="{ '--i': i }">
            <button type="button" class="launch-card" :disabled="!visible" @click="router.push(item.path)">
                <span class="launch-badge" aria-hidden="true"><component :is="item.icon" /></span>
                <span class="launch-copy">
                    <span class="launch-title">{{ item.label }}</span>
                    <span class="launch-description">{{ item.description }}</span>
                </span>
                <icon-ep-arrow-right class="launch-arrow" aria-hidden="true" />
            </button>
        </div>
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
    width: min(100%, 940px);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    gap: 18px;
    flex: 1;
    padding-top: var(--wl-hero-dock-height);
    pointer-events: none;
}
.welcome-launch.visible { pointer-events: auto; }
.launch-item {
    display: grid;
    opacity: 0;
    transform: translateY(24px) scale(.97);
    transition: transform .48s var(--wl-ease), opacity .48s var(--wl-ease);
    transition-delay: calc(160ms + var(--i) * 40ms);
}
.visible .launch-item { opacity: 1; transform: none; }
.launch-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-width: 0;
    min-height: 104px;
    padding: 18px 20px;
    border: 1px solid var(--wl-card-ring);
    border-radius: 14px;
    background: var(--wl-card);
    backdrop-filter: blur(10px);
    color: var(--wl-letter);
    font: inherit;
    text-align: start;
    cursor: pointer;
    transition: transform .16s var(--wl-ease);
}
.launch-badge {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 40px;
    height: 40px;
    border: 1px solid var(--wl-gold-faint);
    border-radius: 12px;
    background: var(--wl-badge);
    color: var(--wl-gold);
}
.launch-badge svg { width: 22px; height: 22px; }
.launch-copy { display: grid; gap: 4px; overflow-wrap: anywhere; }
.launch-title { font-size: 16px; line-height: 1.3; font-weight: 700; }
.launch-description { font-size: 13px; line-height: 1.5; color: var(--wl-dim); }
.launch-arrow { width: 14px; color: var(--wl-dim); transition: transform .16s var(--wl-ease); }
.launch-card:enabled:is(:hover, :focus-visible) {
    transform: translateY(-2px);
    background: var(--wl-card-hover);
    border-color: var(--wl-card-ring-hover);
    box-shadow: 0 4px 18px var(--wl-card-glow);
}
.launch-card:enabled:is(:hover, :focus-visible) .launch-badge { background: var(--wl-badge-hover); }
.launch-card:enabled:is(:hover, :focus-visible) .launch-arrow { transform: translateX(3px); }
.launch-card:focus-visible { outline: 2px solid var(--wl-gold); outline-offset: 3px; }

@media (max-width: 767px) {
    .welcome-launch { grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: center; gap: 12px; }
    .launch-card { min-height: 88px; padding: 12px 10px; gap: 6px; }
    .launch-badge { width: 32px; height: 32px; border-radius: 10px; }
    .launch-badge svg { width: 18px; height: 18px; }
    .launch-description {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        font-size: 12px;
    }
    .launch-arrow { width: 12px; }
}
@media (prefers-reduced-motion: reduce) {
    .launch-item, .launch-card, .launch-arrow { transition: none; }
    .launch-card:enabled:is(:hover, :focus-visible),
    .launch-card:enabled:is(:hover, :focus-visible) .launch-arrow { transform: none; }
}
</style>
