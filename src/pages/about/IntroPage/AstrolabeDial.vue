<template>
    <svg class="dial" viewBox="-500 -500 1000 1000" aria-hidden="true">
        <!-- 外圈：刻度和罗马数字，缓慢转动 -->
        <g class="dial-outer">
            <circle r="482" class="dial-ring" />
            <circle r="452" class="dial-ring dial-faint" />
            <path :d="minorTicks" class="dial-tick" />
            <path :d="majorTicks" class="dial-tick dial-major" />
            <text v-for="mark in numerals" :key="mark.label" class="dial-numeral"
                  :x="mark.x" :y="mark.y" :transform="`rotate(${mark.angle} ${mark.x} ${mark.y})`">
                {{ mark.label }}
            </text>
            <circle r="404" class="dial-ring" />
        </g>

        <!-- 中圈：十二分区和偏心黄道圈，反向转动 -->
        <g class="dial-inner">
            <path :d="sectorLines" class="dial-ring dial-faint" />
            <circle r="300" class="dial-ring dial-dashed" />
            <circle cx="0" cy="64" r="236" class="dial-ring" />
            <circle r="180" class="dial-ring dial-faint" />
        </g>

        <!-- 星座连线 -->
        <g class="dial-constellation">
            <polyline :points="constellation.map(p => p.join(',')).join(' ')" class="dial-ring" />
            <circle v-for="(p, i) in constellation" :key="i" :cx="p[0]" :cy="p[1]"
                    :r="i === 3 ? 6 : 3.5" class="dial-star" />
        </g>

        <!-- 指针：指向当前时刻（一天转一圈） -->
        <g class="dial-hand" :style="{ transform: `rotate(${handAngle}deg)` }">
            <!-- 不可见的整圆让这一组的包围盒以圆心为中心，旋转才绕圆心 -->
            <circle r="420" class="dial-pivot" />
            <line x1="0" y1="-96" x2="0" y2="-396" class="dial-ring dial-hand-line" />
            <path d="M0 -418 L7 -400 L0 -392 L-7 -400 Z" class="dial-star" />
        </g>

        <circle r="96" class="dial-ring" />
        <circle r="86" class="dial-ring dial-faint" />
    </svg>
</template>

<script setup lang="ts">
import {onActivated, onBeforeUnmount, onMounted, ref} from "vue"

function polar(r: number, deg: number): [number, number] {
    const a = deg * Math.PI / 180
    return [+(Math.sin(a) * r).toFixed(2), +(-Math.cos(a) * r).toFixed(2)]
}

function ticks(filter: (i: number) => boolean, inner: (i: number) => number) {
    let d = ""
    for (let i = 0; i < 360; i += 2) {
        if (!filter(i)) continue
        const [x1, y1] = polar(482, i)
        const [x2, y2] = polar(inner(i), i)
        d += `M${x1} ${y1}L${x2} ${y2}`
    }
    return d
}

const minorTicks = ticks(i => i % 30 !== 0, i => i % 10 === 0 ? 466 : 474)
const majorTicks = ticks(i => i % 30 === 0, () => 452)

const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"]
const numerals = ROMAN.map((label, i) => {
    const angle = i * 30 + 15
    const [x, y] = polar(428, angle)
    return { label, x, y, angle }
})

let sectors = ""
for (let i = 0; i < 12; i++) {
    const [x1, y1] = polar(300, i * 30)
    const [x2, y2] = polar(404, i * 30)
    sectors += `M${x1} ${y1}L${x2} ${y2}`
}
const sectorLines = sectors

const constellation: [number, number][] = [
    [-262, -96], [-196, -168], [-118, -150], [-42, -232], [44, -196], [126, -246], [214, -170], [262, -84],
]

const handAngle = ref(0)
function updateHand() {
    const now = new Date()
    handAngle.value = (now.getHours() * 60 + now.getMinutes()) / (24 * 60) * 360
}
let timer: number | undefined
onMounted(() => {
    updateHand()
    timer = window.setInterval(updateHand, 60_000)
})
onActivated(updateHand)
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<style lang="scss" scoped>
.dial {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
}

.dial-ring {
    fill: none;
    stroke: var(--wl-gold-stroke);
    stroke-width: 1.2;
}

.dial-faint {
    stroke: var(--wl-gold-faint);
}

.dial-dashed {
    stroke-dasharray: 2 8;
}

.dial-tick {
    stroke: var(--wl-gold-faint);
    stroke-width: 1;
}

.dial-major {
    stroke: var(--wl-gold-stroke);
    stroke-width: 1.6;
}

.dial-numeral {
    fill: var(--wl-gold-stroke);
    font-family: "Noto Serif SC", "Source Han Serif SC", serif;
    font-size: 17px;
    letter-spacing: .08em;
    text-anchor: middle;
    dominant-baseline: central;
}

.dial-star {
    fill: var(--wl-gold);
}

.dial-hand-line {
    stroke: var(--wl-gold);
    stroke-width: 1.4;
}

.dial-outer,
.dial-inner,
.dial-hand {
    // 各组图形都关于圆心对称，以自身包围盒中心旋转即绕圆心
    transform-box: fill-box;
    transform-origin: center;
}

.dial-pivot {
    fill: none;
    stroke: none;
}

.dial-outer {
    animation: dial-turn 480s linear infinite;
}

.dial-inner {
    animation: dial-turn 720s linear infinite reverse;
}

.dial-hand {
    transition: transform 1.2s cubic-bezier(.2, .7, .2, 1);
}

@keyframes dial-turn {
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .dial-outer,
    .dial-inner {
        animation: none;
    }

    .dial-hand {
        transition: none;
    }
}
</style>
