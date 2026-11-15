<template>
    <svg class="stars" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle v-for="(star, i) in stars" :key="i" :cx="star.x" :cy="star.y" :r="star.r"
                :class="{ twinkle: star.twinkle }"
                :style="star.twinkle ? { animationDelay: `${star.delay}s`, animationDuration: `${star.duration}s` } : undefined"
                :opacity="star.opacity" />
    </svg>
</template>

<script setup lang="ts">
// 固定种子，每次打开星星位置一样，不会闪成另一片天空
let seed = 20200930
function random() {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
}

const stars = Array.from({ length: 150 }, () => {
    const bright = random() < .08
    return {
        x: +(random() * 1600).toFixed(1),
        y: +(random() * 1000).toFixed(1),
        r: bright ? 1.8 + random() * 1.2 : .6 + random() * .9,
        opacity: +(bright ? .9 : .25 + random() * .45).toFixed(2),
        twinkle: random() < .3,
        delay: +(random() * 6).toFixed(2),
        duration: +(3 + random() * 4).toFixed(2),
    }
})
</script>

<style lang="scss" scoped>
.stars {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: var(--wl-star);
    pointer-events: none;
}

.twinkle {
    animation-name: star-twinkle;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
}

@keyframes star-twinkle {
    50% {
        opacity: .1;
    }
}

@media (prefers-reduced-motion: reduce) {
    .twinkle {
        animation: none;
    }
}
</style>
