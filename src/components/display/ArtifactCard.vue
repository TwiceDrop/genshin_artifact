<template>
    <component :is="readonly ? 'div' : 'button'" :type="readonly ? undefined : 'button'" class="art-card" :class="{ selected, readonly }"
               :aria-label="readonly ? undefined : `${setLabel} · ${slotLabel} +${item.level}`" @click="readonly || emit('open')">
        <span v-if="item.omit && !readonly" class="art-lock" title="已锁定"><icon-ep-lock aria-hidden="true" /></span>
        <span class="art-head">
            <slot name="icon"><artifact-icon :item="item" :src="iconSrc" /></slot>
            <span class="art-name">
                <b>{{ setLabel }}</b>
                <small>{{ slotLabel }}</small>
            </span>
        </span>
        <span v-if="!hideFixedMainStat || !fixedMainStat" class="art-main" :class="mainStatClass">
            <span>{{ main[0] }}</span>
            <b>{{ main[1] }}</b>
        </span>
        <span class="art-subs">
            <span v-for="(sub, index) in subs" :key="index" :class="sub.statClass">
                <span class="sub-label"><span class="sub-name">{{ sub.label }}</span>
                    <small v-if="sub.hits" class="roll-hits" :aria-label="`强化命中 ${sub.hits} 次`">×{{ sub.hits }}</small>
                </span><b>{{ sub.value }}</b>
            </span>
        </span>
        <span v-if="score !== null && score !== undefined" class="art-score">
            <span>喵喵评分<template v-if="scoreLabel"> · {{ scoreLabel }}</template></span>
            <UiHoverDetails v-if="readonly && scoreDetails" enabled :tap-label="slotLabel + ' · 喵喵评分'" :side="scoreSide">
                <template #trigger>
                    <button type="button" class="score-trigger miao-score" :data-grade="grade"
                        :aria-label="slotLabel + ' · 喵喵评分 ' + score.toFixed(1) + ' ' + grade">
                        {{ score.toFixed(1) }} <small v-if="showGrade">{{ grade }}</small>
                    </button>
                </template>
                <div v-if="breakdown" class="score-breakdown">
                    <header><strong>{{ slotLabel }} · 喵喵评分</strong><b class="miao-score" :data-grade="grade">{{ score.toFixed(1) }} {{ grade }}</b></header>
                    <dl>
                        <div :class="mainStatClass"><dt><small>主词条</small> {{ main[0] }} +{{ main[1] }}</dt><dd>{{ breakdown.main.toFixed(1) }} 分</dd></div>
                        <div v-for="(sub, index) in subs" :key="sub.name" :class="sub.statClass">
                            <dt><small>副词条</small> {{ sub.label }} +{{ sub.value }}
                                <small v-if="sub.hits" class="roll-hits" :aria-label="`强化命中 ${sub.hits} 次`">×{{ sub.hits }}</small>
                            </dt><dd>{{ breakdown.subs[index].score.toFixed(1) }} 分</dd>
                        </div>
                    </dl>
                </div>
            </UiHoverDetails>
            <b v-else class="miao-score" :data-grade="grade">{{ score.toFixed(1) }} <small v-if="showGrade">{{ grade }}</small></b>
        </span>
    </component>
</template>

<script setup lang="ts">
// 圣遗物卡片：圣遗物页的网格和历史记录详情共用。readonly 时只展示（不可点、不显示锁定），用于计算记录里的快照。
import IconEpLock from "~icons/ep/lock"
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import {displayedTagParts, displayedUpgradeHits} from "@/utils/artifacts"
import {highlightedMainStat} from '@/utils/character-artifact-highlights'
import {useI18n} from "@/i18n/i18n"
import type {IArtifact} from "@/types/artifact"
import ArtifactIcon from "@/components/display/ArtifactIcon.vue"
import UiHoverDetails from "@/components/ui/UiHoverDetails.vue"

const props = defineProps<{ item: IArtifact, iconSrc?: string, highlightTags?: string[], score?: number | null, scoreLabel?: string, grade?: string, showGrade?: boolean, selected?: boolean, readonly?: boolean,
    scoreDetails?: () => { main: number, subs: { score: number }[] } | null, scoreSide?: string, hideFixedMainStat?: boolean }>()
const breakdown = computed(() => props.scoreDetails?.())
const emit = defineEmits<{ (e: "open"): void }>()
const { t, ta } = useI18n()

const set = computed(() => (artifactsData as any)[props.item.setName])
const setLabel = computed(() => ta(set.value.nameLocale))
const slotLabel = computed(() => t("misc", props.item.position))

const main = computed(() => displayedTagParts(props.item.mainTag.name, props.item.mainTag.value))
const fixedMainStat = computed(() => props.item.position === "flower" || props.item.position === "feather")
const mainStatClass = computed(() => {
    if (fixedMainStat.value) {
        return "fixed-main-stat"
    }
    return highlightedMainStat(props.item, props.highlightTags) ? "role-highlight" : undefined
})
const hits = computed(() => displayedUpgradeHits(props.item))
const subs = computed(() => props.item.normalTags.map((tag, index) => {
    const [label, value] = displayedTagParts(tag.name, tag.value)
    const statClass = {
        "role-highlight": props.highlightTags?.includes(tag.name),
        crit: !props.highlightTags && (tag.name === "critical" || tag.name === "criticalDamage"),
    }
    return { name: tag.name, label, value, statClass, hits: hits.value[index] }
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

    &.readonly {
        cursor: default;

        &:hover {
            transform: none;
            box-shadow: none;
        }
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

    .sub-label { display: flex; align-items: baseline; gap: 3px; min-width: 0; color: var(--cx-dim); }
    .sub-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    // 数值不换行，窄卡片里让词条名省略
    b {
        flex: none;
        white-space: nowrap;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .crit b {
        color: var(--cx-gold);
    }
}

.art-card .role-highlight > :is(span, b) { color: var(--cx-gold); }
.art-main.fixed-main-stat > :is(span, b) { color: var(--cx-letter); }

.art-score {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--cx-dim);
    font-size: 12px;

    b {
        font-size: 14px;
    }
}

.score-trigger { border: 0; border-radius: 4px; background: transparent; padding: 4px 2px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700; }
.score-trigger:focus-visible { outline: 2px solid currentColor; }
.score-breakdown header, .score-breakdown dl > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.score-breakdown header { padding-bottom: 6px; border-bottom: 1px solid var(--cx-step-2); font-size: 14px; }
.score-breakdown dl { display: grid; gap: 5px; margin: 8px 0 0; font-size: 13px; }
.score-breakdown small { color: var(--cx-dim); }
.score-breakdown .role-highlight, .score-breakdown .crit dd { color: var(--cx-gold); }
.score-breakdown .fixed-main-stat { color: var(--cx-letter); }
.score-breakdown dd { flex: none; margin: 0; font-variant-numeric: tabular-nums; }
.roll-hits, .score-breakdown .roll-hits { flex: none; display: inline-block; padding: 0 3px; border-radius: 4px; background: var(--cx-step-2); color: inherit; font-size: 10px; font-weight: 600; line-height: 1.4; }
@media (prefers-reduced-motion: reduce) {
    .art-card {
        transition: none;
    }
}
</style>
<style scoped src="../../styles/artifact-score.css"></style>
