<template>
    <Teleport to="body">
        <dialog v-if="activeStep" ref="overlay" class="tour-overlay cx-scope" :class="{dim: !rect}"
                aria-labelledby="tour-title" aria-describedby="tour-body" @keydown="handleKey" @cancel.prevent="stopGuide">
            <div v-if="rect" aria-hidden="true" class="highlight" :style="highlightStyle" />
            <section ref="card" tabindex="-1" class="step-card" :style="cardStyle">
                <div class="step-meta">
                    <span>{{ activeGuide.title }}</span>
                    <span>{{ controller.activeStepIndex + 1 }} / {{ activeGuide.steps.length }}</span>
                </div>
                <div aria-live="polite">
                    <h2 id="tour-title">{{ activeStep.title }}</h2>
                    <p id="tour-body">{{ activeStep.body }}</p>
                </div>
                <footer>
                    <button type="button" class="exit" @click="stopGuide">退出引导</button>
                    <button type="button" :disabled="controller.activeStepIndex === 0" @click="prevStep(router)">上一步</button>
                    <button type="button" class="advance" @click="nextStep(router)">
                        {{ controller.activeStepIndex + 1 === activeGuide.steps.length ? '完成' : '下一步' }}
                    </button>
                </footer>
            </section>
        </dialog>
    </Teleport>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import {useScreen} from '@/composables/screen'
import {activeGuide, activeStep, controller, nextStep, prevStep, stopGuide} from './controller.mjs'

const router = useRouter()
const {geSmall} = useScreen()
const overlay = ref(null), card = ref(null)
const size = ref({width: 0, height: 0, cardWidth: 0, cardHeight: 0})
watch(overlay, (dialog, previous, onCleanup) => {
    if (!dialog) return
    dialog.showModal()
    card.value.focus({preventScroll: true})
    function measure() {
        size.value = {width: dialog.clientWidth, height: dialog.clientHeight,
            cardWidth: card.value.offsetWidth, cardHeight: card.value.offsetHeight}
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(dialog)
    observer.observe(card.value)
    onCleanup(() => observer.disconnect())
}, {flush: 'post'})

const rect = computed(() => {
    const r = controller.targetRect
    if (!r || controller.fallbackCentered) return null
    const {width, height} = size.value
    const left = Math.max(0, r.left - 5), top = Math.max(0, r.top - 5)
    const right = Math.min(width, r.right + 5), bottom = Math.min(height, r.bottom + 5)
    return right > left && bottom > top ? {left, top, right, bottom} : null
})
const highlightStyle = computed(() => ({
    left: rect.value.left + 'px', top: rect.value.top + 'px',
    width: (rect.value.right - rect.value.left) + 'px', height: (rect.value.bottom - rect.value.top) + 'px',
}))

const cardStyle = computed(() => {
    const r = rect.value
    if (!r) return {left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}
    const {width, height, cardWidth, cardHeight} = size.value
    const gap = 12
    if (!geSmall.value) {
        // 第一步指向固定底栏，将卡片底边贴在导航上方。
        const aboveNav = activeStep.value.mobileAnchor === 'nav.mobile-bottom'
        return {left: gap + 'px', bottom: aboveNav ? (height - r.top + gap) + 'px' : 'calc(12px + env(safe-area-inset-bottom))'}
    }
    const midX = (r.left + r.right - cardWidth) / 2, midY = (r.top + r.bottom - cardHeight) / 2
    const positions = [
        {x: midX, y: r.bottom + gap, room: height - r.bottom - cardHeight},
        {x: midX, y: r.top - cardHeight - gap, room: r.top - cardHeight},
        {x: r.right + gap, y: midY, room: width - r.right - cardWidth},
        {x: r.left - cardWidth - gap, y: midY, room: r.left - cardWidth},
    ]
    const best = positions.reduce((a, b) => a.room >= b.room ? a : b)
    return {left: Math.max(gap, Math.min(best.x, width - cardWidth - gap)) + 'px',
        top: Math.max(gap, Math.min(best.y, height - cardHeight - gap)) + 'px'}
})

function handleKey(event) {
    if (event.key === 'Escape') stopGuide()
    else if (event.key === 'ArrowLeft') prevStep(router)
    else if (event.key === 'ArrowRight' || (event.key === 'Enter' && event.target.tagName !== 'BUTTON')) nextStep(router)
    else return
    event.preventDefault()
    event.stopPropagation()
}
</script>

<style scoped>
.tour-overlay {position: fixed; inset: 0; z-index: 3000; box-sizing: border-box; margin: 0; padding: 0;
    width: 100%; height: 100%; max-width: none; max-height: none; border: 0; background: transparent; overflow: hidden;}
.tour-overlay::backdrop {background: transparent;}
.tour-overlay.dim {background: rgba(8, 12, 25, .70);}
.highlight {position: absolute; box-sizing: border-box; border: 2px solid var(--cx-gold); border-radius: 10px;
    box-shadow: 0 0 0 200vmax rgba(8, 12, 25, .70); pointer-events: none;}
.step-card {position: absolute; box-sizing: border-box; width: min(360px, calc(100% - 24px)); max-height: calc(100% - 24px);
    overflow: auto; overscroll-behavior: contain; padding: 20px; border: 1px solid var(--cx-step-2); border-radius: var(--cx-radius);
    color: var(--cx-letter); background: var(--cx-card); box-shadow: 0 8px 36px rgba(0, 0, 0, .24);}
.step-card:focus {outline: none;}
.step-meta, footer {display: flex; align-items: center; gap: 8px;}
.step-meta {justify-content: space-between; color: var(--cx-dim); font-size: 13px;}
h2 {margin: 12px 0 6px; font-size: 20px;}
p {margin: 0; line-height: 1.65;}
footer {flex-wrap: wrap; margin-top: 16px;}
button {min-height: 40px; padding: 0 12px; border: 0; border-radius: 8px; font: inherit; cursor: pointer;
    background: var(--cx-step); color: var(--cx-letter);}
button:focus-visible {outline: 2px solid var(--cx-gold); outline-offset: 2px;}
button:disabled {opacity: .5; cursor: default;}
.exit {margin-right: auto; background: transparent; color: var(--cx-dim);}
.advance {background: var(--cx-gold); color: var(--cx-gold-on);}
@media (max-width: 767px) {
    .step-card {width: calc(100% - 24px); padding: 16px; max-height: calc(100% - 100px - env(safe-area-inset-bottom));}
    button {min-height: 44px;}
}
</style>
