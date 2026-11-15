<template>
    <section class="hero" aria-label="角色">
        <div class="hero-art" aria-hidden="true">
            <img :key="portraitSrc" :src="portraitSrc" alt="" @error="portraitFailed = true" />
        </div>

        <div class="hero-id">
            <div class="hero-name">
                <img v-if="elementIcon" :src="elementIcon" :alt="elementLabel" />
                <h2>{{ name }}</h2>
            </div>

            <div class="hero-pills">
                <button type="button" class="hero-pill" @click="emit('open', 'character')"><small>等级</small>{{ level }}</button>
                <button type="button" class="hero-pill" @click="emit('open', 'character')"><small>命座</small>C{{ constellation }}</button>
                <button type="button" class="hero-pill" @click="emit('open', 'character')"><small>天赋</small>{{ talents.join(' · ') }}</button>
            </div>

            <button type="button" class="hero-weapon" @click="emit('open', 'weapon')">
                <img :src="weapon.icon" alt="" />
                <span class="hero-weapon-text">
                    <span class="hero-weapon-name">{{ weapon.name }}</span>
                    <span class="hero-weapon-sub">Lv {{ weapon.level }} · 精炼 {{ weapon.refine }}<template v-if="weapon.effect"> · {{ weapon.effect }}</template></span>
                </span>
                <span class="hero-more">更换 ›</span>
            </button>

            <div class="hero-arts">
                <button v-for="(slot, index) in slots" :key="slot.position" type="button" class="hero-slot"
                        :class="{ filled: slot.image, changed: slot.changed }"
                        :aria-label="slot.image ? `${slot.label}：${slot.title}` : `选择圣遗物：${slot.label}`"
                        @click="emit('open', 'artifacts', index)">
                    <img v-if="slot.image" class="hero-slot-art" :src="slot.image" alt="" />
                    <img v-else class="hero-slot-icon" :src="slot.icon" alt="" />
                    <span v-if="slot.image" class="hero-slot-level">+{{ slot.level }}</span>
                    <span v-else class="hero-slot-add" aria-hidden="true">+</span>
                    <span v-if="slot.changed" class="hero-slot-new">新</span>
                </button>
                <button type="button" class="hero-score" @click="emit('open', 'artifacts')">
                    <b :data-grade="score.grade">{{ score.value }}</b>
                    <span>{{ score.label }}</span>
                </button>
            </div>
        </div>

        <div class="hero-stats">
            <h3>面板</h3>
            <div v-for="stat in stats" :key="stat.key" class="hero-stat" :class="{ hl: stat.highlight }">
                <span>{{ stat.label }}</span>
                <b>
                    <template v-if="stat.before !== null"><s>{{ stat.before }}</s> → </template>
                    <em :class="stat.direction">{{ stat.current }}</em>
                </b>
            </div>
            <button type="button" class="hero-stats-more" @click="emit('open', 'attributes')">全部属性 · 收益曲线 ›</button>
        </div>
    </section>
</template>

<script setup lang="ts">
import {computed, ref, watch} from "vue"

interface Slot { position: string, label: string, icon: string, image: string | null, title: string, level: number | null, changed: boolean }
interface Stat { key: string, label: string, current: string, before: string | null, direction: string, highlight: boolean }

const props = defineProps<{
    name: string
    elementIcon?: string
    elementLabel?: string
    avatar: string
    splash?: string
    level: string
    constellation: number
    talents: number[]
    weapon: { name: string, icon: string, level: string, refine: number, effect: string }
    slots: Slot[]
    score: { value: string, label: string, grade?: string }
    stats: Stat[]
}>()
const emit = defineEmits<{ (e: "open", section: "character" | "weapon" | "artifacts" | "attributes", slot?: number): void }>()

// 立绘：米游社头像地址 .../character_icon/UI_AvatarIcon_X.png 对应透明底立绘
// .../character_image/UI_AvatarIcon_X@2x.png；不是这种地址的角色用自带 splash，
// 图片加载失败时显示头像（2026-11-15 开发者确认，见 docs/specs/calculator-redesign 决定 4）。
const portraitFailed = ref(false)
watch(() => props.avatar, () => { portraitFailed.value = false })
const portraitSrc = computed(() => {
    if (portraitFailed.value) return props.avatar
    const match = /^(https:\/\/upload-bbs\.mihoyo\.com\/game_record\/genshin)\/character_icon\/(UI_AvatarIcon_[A-Za-z0-9_]+)\.png/.exec(props.avatar)
    if (match) return `${match[1]}/character_image/${match[2]}@2x.png`
    return props.splash || props.avatar
})
</script>

<style lang="scss" scoped>
.hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) 264px;
    min-height: 360px;
    border-radius: var(--cx-radius);
    overflow: hidden;
    background: var(--sh-night);
    color: var(--sh-letter);
}

.hero-art {
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at 50% 36%, var(--sh-raised) 0, transparent 64%);

    img {
        position: absolute;
        left: 50%;
        top: -6px;
        width: 320px;
        max-width: none;
        transform: translateX(-50%);
    }

    // 立绘右侧和底部渐隐到夜空色
    &::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
            linear-gradient(90deg, transparent 70%, var(--sh-night)),
            linear-gradient(0deg, var(--sh-night) 0, transparent 28%);
    }
}

.hero-id {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 28px 24px 24px 8px;
    min-width: 0;
}

.hero-name {
    display: flex;
    align-items: center;
    gap: 12px;

    img {
        width: 30px;
        height: 30px;
    }

    h2 {
        margin: 0;
        font: 900 40px/1.05 "Noto Serif SC", "Source Han Serif SC", serif;
        letter-spacing: .04em;
    }
}

.hero-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.hero-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--sh-raised);
    color: var(--sh-letter);
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;

    small {
        color: var(--sh-dim);
        font-size: 12px;
    }
}

.hero-weapon {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px;
    border: 0;
    border-radius: 14px;
    background: var(--sh-foot);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    img {
        flex: none;
        width: 52px;
        height: 52px;
        border-radius: 10px;
        background: var(--sh-raised);
    }
}

.hero-weapon-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.hero-weapon-name {
    font-size: 16px;
    font-weight: 600;
}

.hero-weapon-sub {
    color: var(--sh-dim);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hero-more {
    flex: none;
    margin-left: auto;
    color: var(--sh-gold);
    font-size: 13px;
}

.hero-arts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.hero-slot {
    position: relative;
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: var(--sh-foot);
    cursor: pointer;

    &.changed {
        box-shadow: 0 0 0 2px var(--sh-gold);
    }
}

.hero-slot-icon {
    width: 28px;
    height: 28px;
    opacity: .5;
    filter: invert(1);
}

.hero-slot-art {
    width: 52px;
    height: 52px;
}

.hero-slot-add {
    position: absolute;
    right: 6px;
    bottom: 1px;
    color: var(--sh-gold);
    font-size: 15px;
}

.hero-slot-level {
    position: absolute;
    right: 4px;
    bottom: 2px;
    padding: 0 4px;
    border-radius: 6px;
    background: var(--sh-night);
    color: var(--sh-letter);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}

.hero-slot-new {
    position: absolute;
    left: -4px;
    top: -6px;
    padding: 0 5px;
    border-radius: 6px;
    background: var(--sh-gold);
    color: var(--sh-night);
    font-size: 11px;
    font-weight: 700;
}

.hero-score {
    display: flex;
    flex-direction: column;
    margin-left: 8px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    b {
        color: var(--sh-gold);
        font-size: 22px;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
    }

    span {
        color: var(--sh-dim);
        font-size: 12px;
    }
}

.hero-stats {
    display: flex;
    flex-direction: column;
    padding: 24px 24px 18px;
    background: var(--sh-foot);

    h3 {
        margin: 0 0 8px;
        color: var(--sh-dim);
        font-size: 13px;
        font-weight: 500;
    }
}

.hero-stat {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    font-variant-numeric: tabular-nums;

    span {
        color: var(--sh-dim);
    }

    b {
        font-weight: 600;
        text-align: right;
    }

    s {
        color: var(--sh-dim);
        text-decoration: none;
        font-weight: 400;
    }

    em {
        font-style: normal;
    }

    &.hl em {
        color: var(--sh-gold);
    }

    // 沿用现有约定：涨红跌绿
    em.increase {
        color: #ef8f95;
    }

    em.decrease {
        color: #6fcf97;
    }
}

.hero-stats-more {
    margin-top: auto;
    padding: 12px 0 0;
    border: 0;
    background: none;
    color: var(--sh-gold);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
}

.hero-pill,
.hero-weapon,
.hero-slot {
    transition: background-color .15s ease;
}

.hero-pill:hover {
    filter: brightness(1.2);
}

.hero-weapon:hover,
.hero-slot:hover {
    background: var(--sh-hover);
}

.hero button:focus-visible {
    outline: 2px solid var(--sh-gold);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .hero-pill,
    .hero-weapon,
    .hero-slot {
        transition: none;
    }
}

// 中等宽度：面板移到下面
@container single-calculator (max-width: 1100px) {
    .hero {
        grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
    }

    .hero-stats {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        column-gap: 24px;

        h3,
        .hero-stats-more {
            grid-column: 1 / -1;
        }
    }
}
</style>
