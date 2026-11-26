<template>
    <section class="constellation-card" :data-element="entry.element"
        @pointerdown="press" @pointermove="move" @pointercancel="endPress" @pointerup="endPress"
        @touchend="held && $event.preventDefault()" @contextmenu="suppressTouchMenu" @click.capture="activate">
        <header>
            <h4>命之座</h4>
            <span class="rank-count">{{ entry.constellation }} / 6</span>
        </header>
        <ol class="rank-list" :style="stripStyle">
            <li v-for="(stage, i) in stages" :key="i">
                <UiHoverDetails ref="effectDetails" enabled :tap-label="directSelection ? undefined : stage.name" :side="i % 2 === 0 ? 'left' : 'right'">
                    <template #trigger>
                        <button type="button" class="rank" :data-rank="i + 1" :class="{ lit: i < count }"
                            :aria-label="[layerLabels[i], stage.name, status(i)].join('，')"
                            :aria-pressed="editable ? count === i + 1 : undefined">
                            <span class="rank-icon" aria-hidden="true">
                                <i v-if="record" class="rank-symbol" :style="{ maskPosition: (i * 20) + '% center' }"></i>
                                <img v-else-if="stage.icon" :src="stage.icon" alt="" />
                                <span v-else>{{ i + 1 }}</span>
                                <i-ep-lock v-if="known && i >= count" class="lock-badge" />
                            </span>
                            <span class="rank-copy"><small>{{ layerLabels[i] }}</small><span>{{ stage.name }}</span></span>
                        </button>
                    </template>
                    <GameEffectText :title="stage.name" :effect="stage.effect" />
                </UiHoverDetails>
            </li>
        </ol>
    </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref } from 'vue'
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import GameEffectText from '@/components/display/GameEffectText.vue'
import catalog from '@/assets/character-constellations.json'

const props = defineProps({ entry: { type: Object, required: true }, directSelection: Boolean })
const emit = defineEmits(['change-rank'])
const editable = computed(() => props.directSelection || (!!props.entry.preset && props.entry.characterName !== 'Aloy'))
const effectDetails = ref([])
function requestRank(rank) {
    if (editable.value) emit('change-rank', rank === count.value ? 0 : rank)
}
let timer, touchStart, touchPress = false, held = false
function endPress() {
    clearTimeout(timer)
    touchStart = null
}
onBeforeUnmount(endPress)
onDeactivated(endPress)
function press(event) {
    endPress()
    touchPress = event.pointerType === 'touch'
    held = false
    const button = event.target.closest('[data-rank]')
    if (props.directSelection || !touchPress || !button || !editable.value || !event.isPrimary) return
    touchStart = { x: event.clientX, y: event.clientY }
    timer = setTimeout(async () => {
        held = true
        for (const details of effectDetails.value) details.dismiss()
        await nextTick()
        requestRank(Number(button.dataset.rank))
    }, 450)
}
function move(event) {
    if (touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 8) endPress()
}
function suppressTouchMenu(event) {
    if (touchPress && event.target.closest('[data-rank]')) event.preventDefault()
}
function activate(event) {
    const button = event.target.closest('[data-rank]')
    if (!button) return
    if (props.directSelection) {
        requestRank(Number(button.dataset.rank))
        return
    }
    if (event.detail && (event.pointerType === 'touch' || touchPress)) {
        if (!held) return
    } else {
        requestRank(Number(button.dataset.rank))
    }
    event.preventDefault()
    event.stopPropagation()
}
const layerLabels = ['一', '二', '三', '四', '五', '六'].map(n => `命之座·第${n}层`)
const record = computed(() => catalog[props.entry.characterName])
const stripStyle = computed(() => record.value && ({
    '--stage-strip': `url("${process.env.BASE_URL}constellation-icons/${record.value.icons}.webp")`,
}))
const count = computed(() => Number(props.entry.constellation))
const known = computed(() => Number.isInteger(count.value))
const stages = computed(() => Array.from({ length: 6 }, (_, i) => {
    const saved = props.entry.raw?.constellations?.find(c => Number(c.pos) === i + 1)
    const stage = record.value?.stages[i]
    return { name: saved?.name || stage?.name || 'C' + (i + 1),
        effect: stage?.effect || saved?.effect, icon: saved?.icon }
}))
function status(i) {
    if (!known.value) return '命座未记录'
    return i < count.value ? '已解锁' : '未解锁'
}
</script>

<style scoped>
.constellation-card { --light: #ecc887; --halo: rgba(227, 185, 98, .27); padding: 14px 16px; border-radius: 13px; background: var(--cx-card); color: var(--cx-letter); }
[data-element="Dendro"] { --light: #b5ef72; --halo: rgba(148, 211, 73, .42); }
[data-element="Electro"] { --light: #d7adff; --halo: rgba(173, 108, 225, .4); }
[data-element="Pyro"] { --light: #ffaf86; --halo: rgba(223, 116, 71, .4); }
[data-element="Hydro"] { --light: #83d8ff; --halo: rgba(75, 168, 213, .4); }
[data-element="Anemo"] { --light: #90e6ce; --halo: rgba(77, 186, 156, .4); }
[data-element="Cryo"] { --light: #b7eaff; --halo: rgba(110, 193, 222, .4); }
header { display: flex; align-items: baseline; justify-content: space-between; }
header h4 { margin: 0; font-size: 15px; }
.rank-count { font-size: 12px; color: var(--cx-dim); font-variant-numeric: tabular-nums; }
[data-rank] { -webkit-user-select: none; user-select: none; }
.rank-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; list-style: none; padding: 0; margin: 8px 0 0; }
.rank-list li { display: flex; min-width: 0; }
.rank { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; font: inherit; line-height: 1.35; color: var(--cx-dim); padding: 9px 7px; border: 1px solid transparent; border-radius: 9px; background: var(--cx-step); cursor: pointer; }
.rank:hover, .rank[aria-expanded="true"], .rank[aria-pressed="true"] { border-color: var(--cx-gold); color: var(--cx-letter); }
.rank:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 1px; }
.rank-icon { flex: none; position: relative; display: grid; place-items: center; box-sizing: border-box; width: 35px; height: 35px; border: 1px solid var(--cx-step-2); border-radius: 50%; background: var(--cx-card); }
.rank-icon img, .rank-symbol { width: 26px; height: 26px; }
.rank-symbol { background: currentColor; -webkit-mask: var(--stage-strip) no-repeat; mask: var(--stage-strip) no-repeat; -webkit-mask-size: 600% 100%; mask-size: 600% 100%; }
.rank:not(.lit) .rank-symbol { opacity: .7; }
.rank-copy { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; font-size: 12px; }
.rank-copy small { color: var(--cx-dim); font-size: 10px; }
.lock-badge { position: absolute; right: -3px; bottom: -3px; width: 10px; height: 10px; padding: 2px; border-radius: 50%; color: var(--cx-dim); background: var(--cx-step); }
.lit { color: var(--cx-letter); }
.lit .rank-icon { --disc: #202838; color: var(--light); background: var(--disc); border-color: var(--light); box-shadow: 0 0 0 1px var(--halo), 0 0 7px 1px var(--halo), inset 0 0 5px var(--halo); }
</style>
