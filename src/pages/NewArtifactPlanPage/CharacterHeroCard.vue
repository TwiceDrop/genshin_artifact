<template>
    <section class="hero" :class="{ 'has-result': result }" aria-label="角色">
        <div v-if="result" class="hero-result" role="group" aria-label="配装结果">
            <span class="hero-result-title">✦ 配装结果</span>
            <span class="hero-result-nav">
                <button type="button" aria-label="上一套" :disabled="result.index <= 1" @click="emit('result', 'prev')">‹</button>
                <span class="hero-result-count">{{ result.index ? `第 ${result.index} / ${result.count} 套` : `原装备 · 共 ${result.count} 套` }}</span>
                <button type="button" aria-label="下一套" :disabled="result.index >= result.count" @click="emit('result', 'next')">›</button>
            </span>
            <span class="hero-result-note">{{ result.note }}</span>
            <slot name="comparison" />
            <span v-if="result.detail" class="hero-result-note">{{ result.detail }}</span>
            <span v-if="result.error" class="hero-result-error" role="alert">{{ result.error }}</span>
            <span class="hero-result-spacer"></span>
            <button type="button" class="hero-result-btn" @click="emit('result', 'compare')">对比候选</button>
            <button v-if="result.canRestore" type="button" class="hero-result-btn ghost" @click="emit('result', 'restore')">恢复原装备</button>
        </div>
        <div class="hero-art" aria-hidden="true">
            <CharacterPortrait :character-name="characterName" :avatar="avatar" :splash="splash" alt="" />
        </div>

        <div class="hero-id">
            <div class="hero-name">
                <img v-if="elementIcon" :src="elementIcon" :alt="elementLabel" />
                <h2>{{ name }}</h2>
                <button type="button" class="hero-select-character primary" @click="emit('my-characters')">选择角色预设</button>
                <button type="button" class="hero-select-character" @click="emit('default-characters')">默认角色</button>
            </div>

            <div class="hero-pills">
                <button type="button" class="hero-pill" @click="emit('open', 'character')"><small>等级</small>{{ level }}</button>
                <button type="button" class="hero-pill" @click="emit('open', 'character')"><small>命座</small>C{{ constellation }}</button>
                <button type="button" class="hero-pill" @click="emit('open', 'character')"><small>天赋</small>{{ talents.join(' · ') }}</button>
                <button type="button" class="hero-pill" @click="emit('open', 'character')">角色设置</button>
            </div>

            <button type="button" class="hero-weapon" @click="emit('open', 'weapon')">
                <img :src="weapon.icon" alt="" />
                <span class="hero-weapon-text">
                    <span class="hero-weapon-name">{{ weapon.name }}<WeaponBaseStats :weapon="weapon.equipment" /></span>
                    <span class="hero-weapon-sub">Lv {{ weapon.level }} · 精炼 {{ weapon.refine }}<template v-if="weapon.effect"> · {{ weapon.effect }}</template></span>
                </span>
                <span class="hero-more">设置/更换 ›</span>
            </button>

        </div>

        <div class="hero-stats" :class="{ 'is-comparing': stats.some(stat => stat.before !== null) }">
            <h3>面板</h3>
            <el-tooltip v-for="stat in stats" :key="stat.key" placement="left">
                <div class="hero-stat" :class="{ hl: stat.highlight }" tabindex="0">
                    <span>{{ stat.label }}</span>
                    <b>
                        <template v-if="stat.before !== null"><s>{{ stat.before }}</s> → </template>
                        <em :class="stat.direction">{{ stat.current }}</em>
                    </b>
                </div>
                <template #content>
                    <div class="hero-stat-sources">
                        <div v-if="stat.before !== null">
                            <strong>{{ stat.before }} →</strong>
                            <attribute-composition :composition="stat.baseline" :percentage="stat.percentage" />
                        </div>
                        <div>
                            <strong v-if="stat.before !== null">{{ stat.current }}</strong>
                            <attribute-composition :composition="stat.composition" :percentage="stat.percentage" />
                        </div>
                    </div>
                </template>
            </el-tooltip>
            <button type="button" class="hero-stats-more" @click="emit('open', 'attributes')">全部属性 · 收益曲线 ›</button>
        </div>
        <div class="hero-equipment-area"><slot name="artifacts" /></div>
    </section>
</template>

<script setup lang="ts">
import CharacterPortrait from "@/components/display/CharacterPortrait.vue"
import WeaponBaseStats from "@/components/display/WeaponBaseStats.vue"
import {onMounted, onActivated, onDeactivated, onBeforeUnmount} from "vue"
import AttributeComposition from "@/components/display/AttributePanel/AttributeComposition.vue"

interface Stat {
    key: string, label: string, current: string, before: string | null, direction: string, highlight: boolean,
    percentage: boolean, composition: Record<string, number>, baseline?: Record<string, number>,
}

const props = defineProps<{
    characterName: string
    name: string
    elementIcon?: string
    elementLabel?: string
    avatar: string
    splash?: string
    level: string
    constellation: number
    talents: number[]
    weapon: { name: string, icon: string, level: string, refine: number, effect: string, equipment: { name: string, level: number, ascend: boolean } }
    stats: Stat[]
    // 有配装结果时显示结果条；index 为 0 表示当前不是任何一套候选（如已恢复原装备）
    result?: { index: number, count: number, note: string, detail?: string, error?: string, canRestore: boolean, busy?: boolean } | null
}>()
const emit = defineEmits<{
    (e: "my-characters"): void
    (e: "default-characters"): void
    (e: "open", section: "character" | "weapon" | "attributes"): void
    (e: "result", action: "prev" | "next" | "compare" | "restore"): void
}>()

// 目的：只在计算器结果页接管方向键，输入控件和弹层保留自身的键盘操作。
function handleResultKeydown(event: KeyboardEvent) {
    const result = props.result
    if (!result || result.busy || event.defaultPrevented || event.repeat || event.isComposing
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="radio"], [role="tab"], [role="combobox"], [role="listbox"]')) return
    const overlayOpen = Array.from(document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"], .el-overlay'))
        .some(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
    if (overlayOpen) return
    const previous = event.key === 'ArrowLeft'
    if (previous ? result.index <= 1 : result.index >= result.count) return
    event.preventDefault()
    emit('result', previous ? 'prev' : 'next')
}
function bindResultKeyboard() { window.addEventListener('keydown', handleResultKeydown) }
function unbindResultKeyboard() { window.removeEventListener('keydown', handleResultKeydown) }
onMounted(bindResultKeyboard)
onActivated(bindResultKeyboard)
onDeactivated(unbindResultKeyboard)
onBeforeUnmount(unbindResultKeyboard)
</script>

<style lang="scss" scoped>
.hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) 360px;
    min-height: 360px;
    border-radius: var(--cx-radius);
    overflow: hidden;
    background: var(--sh-night);
    color: var(--sh-letter);
}

.hero-result {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    padding: 12px 20px;
    background: linear-gradient(90deg, var(--sh-gold-faint), transparent 70%);
    font-variant-numeric: tabular-nums;
}

.hero-result-title {
    color: var(--sh-gold);
    font-weight: 700;
}

.hero-result-nav {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    button {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 50%;
        background: var(--sh-raised);
        color: var(--sh-letter);
        font: inherit;
        cursor: pointer;

        &:disabled {
            opacity: .35;
            cursor: default;
        }
    }
}

.hero-result-count {
    min-width: 6.5em;
    text-align: center;
}

.hero-result-note {
    color: var(--sh-dim);
    font-size: 13px;
}

.hero-result-error {
    color: var(--cx-up);
    font-size: 13px;
}

.hero-result-spacer {
    flex: 1;
}

.hero-result-btn {
    height: 32px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--sh-raised);
    color: var(--sh-letter);
    font: inherit;
    cursor: pointer;

    &.ghost {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--sh-gold-faint);
        color: var(--sh-gold);
    }
}

.hero-art {
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at 50% 36%, var(--sh-glow) 0, transparent 64%);

    img {
        position: absolute;
        left: 50%;
        top: -6px;
        width: 320px;
        max-width: none;
        transform: translateX(calc(0% - var(--portrait-focus-x, 50%)));
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
    flex-wrap: wrap;
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

.hero-select-character {
    flex: none;
    height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: var(--cx-card);
    color: var(--cx-letter);
    font: inherit;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }

    &.primary {
        background: var(--cx-gold);
        color: var(--cx-gold-on);

        &:hover { filter: brightness(1.06); }
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

.hero-equipment-area {
    grid-column: 1 / -1;
    min-width: 0;
    padding: 18px 24px 24px;
    background: var(--sh-foot);
    color: var(--cx-letter);
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
        min-width: 0;
        color: var(--sh-dim);
    }

    b {
        flex: none;
        white-space: nowrap;
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
        color: var(--cx-up);
    }

    em.decrease {
        color: var(--cx-down);
    }
}

.hero-stat-sources {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    max-width: min(560px, 80vw);
    max-height: 65vh;
    overflow: auto;
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
.hero-weapon {
    transition: background-color .15s ease;
}

.hero-pill:hover {
    filter: brightness(1.2);
}

.hero-weapon:hover {
    background: var(--sh-hover);
}

.hero button:focus-visible {
    outline: 2px solid var(--sh-gold);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .hero-pill,
    .hero-weapon {
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

        &.is-comparing {
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
        }

        h3,
        .hero-stats-more {
            grid-column: 1 / -1;
        }
    }
}

// 窄屏：立绘在上、信息在下，面板两列
@container single-calculator (max-width: 820px) {
    .hero {
        grid-template-columns: minmax(0, 1fr);
        min-height: 0;
    }

    .hero-art {
        height: 240px;

        img {
            width: 260px;
        }

        &::after {
            background: linear-gradient(0deg, var(--sh-night) 0, transparent 40%);
        }
    }

    .hero-id {
        margin-top: -56px;
        padding: 0 16px 18px;
        position: relative;
    }

    .hero-name h2 {
        font-size: 32px;
    }

    .hero-equipment-area { padding: 16px; }

    .hero-stats {
        grid-column: auto;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 18px;
        padding: 18px 16px 14px;
    }

    .hero-stats.is-comparing {
        grid-template-columns: minmax(0, 1fr);
    }

    .hero-result {
        padding: 10px 14px;
    }

    .hero-result-spacer {
        display: none;
    }
}
</style>
