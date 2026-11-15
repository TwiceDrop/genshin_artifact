<template>
    <button type="button" class="art-card" :class="{ selected }" :aria-label="`${setLabel} · ${slotLabel} +${item.level}`" @click="emit('open')">
        <span v-if="item.omit" class="art-lock" title="已锁定"><icon-ep-lock aria-hidden="true" /></span>
        <span class="art-head">
            <span class="art-icon" :data-star="item.star">
                <img :src="image" alt="" />
                <span class="art-level">+{{ item.level }}</span>
            </span>
            <span class="art-name">
                <b>{{ setLabel }}</b>
                <small>{{ slotLabel }}</small>
            </span>
        </span>
        <span class="art-main">
            <span>{{ main[0] }}</span>
            <b>{{ main[1] }}</b>
        </span>
        <span class="art-subs">
            <span v-for="(sub, index) in subs" :key="index" :class="{ crit: sub.crit }">
                <span>{{ sub.label }}</span><b>{{ sub.value }}</b>
            </span>
        </span>
        <span v-if="score !== null && score !== undefined" class="art-score">
            <span>喵喵评分<template v-if="scoreLabel"> · {{ scoreLabel }}</template></span>
            <b class="miao-score" :data-grade="grade">{{ score.toFixed(1) }}</b>
        </span>
    </button>
</template>

<script setup lang="ts">
import IconEpLock from "~icons/ep/lock"
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import {displayedTag} from "@/utils/artifacts"
import {useI18n} from "@/i18n/i18n"
import type {IArtifact} from "@/types/artifact"

const props = defineProps<{ item: IArtifact, score?: number | null, scoreLabel?: string, grade?: string, selected?: boolean }>()
const emit = defineEmits<{ (e: "open"): void }>()
const { t, ta } = useI18n()

const set = computed(() => (artifactsData as any)[props.item.setName])
const setLabel = computed(() => ta(set.value.nameLocale))
const slotLabel = computed(() => t("misc", props.item.position))
const image = computed(() => set.value[props.item.position]?.url)

// displayedTag 返回「攻击力+9.9%」这样的一串，在最后一个「+」处拆成名称和数值
function split(name: any, value: number): [string, string] {
    const text = displayedTag(name, value)
    const at = text.lastIndexOf("+")
    return [text.slice(0, at), text.slice(at + 1)]
}
const main = computed(() => split(props.item.mainTag.name, props.item.mainTag.value))
const subs = computed(() => props.item.normalTags.map(tag => {
    const [label, value] = split(tag.name, tag.value)
    return { label, value, crit: tag.name === "critical" || tag.name === "criticalDamage" }
}))
</script>

<style lang="scss" scoped>
.art-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 0;
    border-radius: 16px;
    background: var(--cx-card);
    color: var(--cx-letter);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 0 2px var(--cx-step-2);
    }

    &.selected {
        box-shadow: 0 0 0 2px var(--cx-gold);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.art-lock {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--cx-gold);
    color: var(--cx-gold);
    font-size: 13px;
}

.art-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-right: 28px;
}

.art-icon {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    border-radius: 12px;
    // 品级底色；变量名避开 postcss-mona-colors.cjs 的角色词，深色模式下不被改色
    --rarity-a: #8a5a2b;
    --rarity-b: #c9893d;
    background: linear-gradient(160deg, var(--rarity-a), var(--rarity-b));

    &[data-star="4"] {
        --rarity-a: #5a4a8a;
        --rarity-b: #9a76c9;
    }

    &[data-star="3"] {
        --rarity-a: #3a5a8a;
        --rarity-b: #5b8ec9;
    }

    img {
        width: 54px;
        height: 54px;
    }
}

.art-level {
    position: absolute;
    right: -4px;
    bottom: -4px;
    padding: 0 5px;
    border-radius: 6px;
    background: var(--sh-night);
    color: var(--sh-letter);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}

.art-name {
    display: flex;
    flex-direction: column;
    min-width: 0;

    b {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 15px;
    }

    small {
        color: var(--cx-dim);
        font-size: 12px;
    }
}

.art-main {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--cx-step);

    > span {
        color: var(--cx-dim);
        font-size: 13px;
    }

    b {
        font-size: 20px;
        font-variant-numeric: tabular-nums;
    }
}

.art-subs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 12px;
    font-size: 13px;

    > span {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        min-width: 0;
    }

    span span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--cx-dim);
    }

    b {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .crit b {
        color: var(--cx-gold);
    }
}

.art-score {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--cx-dim);
    font-size: 12px;

    b {
        color: var(--cx-gold);
        font-size: 14px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .art-card {
        transition: none;
    }
}
</style>
