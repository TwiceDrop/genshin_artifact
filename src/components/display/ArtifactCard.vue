<template>
    <component :is="readonly ? 'div' : UiButton" class="art-card" :class="{ selected, readonly }"
               :aria-label="readonly ? undefined : `${setLabel} · ${slotLabel} +${item.level}`" @click="readonly || emit('open')">
        <span class="art-overview">
            <span class="art-head">
                <span class="art-portrait">
                    <slot name="icon"><artifact-icon :item="item" :src="iconSrc" :size="66" /></slot>
                    <span v-if="item.omit && !readonly" class="art-lock" title="已锁定"><icon-ep-lock aria-hidden="true" /></span>
                </span>
                <span class="art-name">
                    <b>{{ setLabel }}</b>
                    <small>{{ slotLabel }}</small>
                    <slot name="metadata" />
                </span>
            </span>
            <span class="art-stats">
                <span v-if="!hideFixedMainStat || !fixedMainStat" class="art-main" :class="mainStatClass">
                    <span>{{ shortRecharge && item.mainTag.name === 'recharge' ? t('stat.shortRecharge') : main[0] }}</span>
                    <b>{{ main[1] }}</b>
                </span>
                <span v-if="subs.length" class="art-subs">
                    <span v-for="sub in subs" :key="sub.name" class="art-sub" :class="sub.statClass">
                        <span class="sub-label">
                            <span>{{ shortRecharge && sub.name === 'recharge' ? t('stat.shortRecharge') : sub.label }}</span>
                            <ArtifactUpgradeCount :count="sub.hits" />
                        </span>
                        <b>{{ sub.value }}</b>
                    </span>
                </span>
            </span>
        </span>
        <span v-if="score !== null && score !== undefined" class="art-score">
            <span>喵喵评分<template v-if="scoreLabel"> · {{ scoreLabel }}</template></span>
            <UiHoverDetails v-if="readonly && scoreDetails" enabled :tap-label="slotLabel + ' · 喵喵评分'" :side="scoreSide">
                <template #trigger>
                    <UiButton class="score-trigger miao-score" :data-grade="grade"
                        :aria-label="slotLabel + ' · 喵喵评分 ' + score.toFixed(1) + ' ' + grade">
                        {{ score.toFixed(1) }} <small v-if="showGrade">{{ grade }}</small>
                    </UiButton>
                </template>
                <div v-if="breakdown" class="score-breakdown">
                    <header><strong>{{ slotLabel }} · 喵喵评分</strong><b class="miao-score" :data-grade="grade">{{ score.toFixed(1) }} {{ grade }}</b></header>
                    <dl>
                        <div :class="mainStatClass"><dt><small>主词条</small> {{ main[0] }} +{{ main[1] }}</dt><dd>{{ breakdown.main.toFixed(1) }} 分</dd></div>
                        <div v-for="(sub, index) in subs" :key="sub.name" :class="sub.statClass">
                            <dt><small>副词条</small> {{ sub.label }} +{{ sub.value }}
                                <ArtifactUpgradeCount :count="sub.hits" />
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
// 圣遗物卡片：库存、历史和角色面板共用。readonly 时卡片本身不可点击。
import UiButton from '@/components/ui/UiButton.vue'
import IconEpLock from "~icons/ep/lock"
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import {displayedTagParts, displayedUpgradeHits} from "@/utils/artifacts"
import {highlightedMainStat} from '@/utils/character-artifact-highlights'
import {useI18n} from "@/i18n/i18n"
import type {IArtifact} from "@/types/artifact"
import ArtifactIcon from "@/components/display/ArtifactIcon.vue"
import ArtifactUpgradeCount from "@/components/display/ArtifactUpgradeCount.vue"
import UiHoverDetails from "@/components/ui/UiHoverDetails.vue"

const props = defineProps<{ item: IArtifact, iconSrc?: string, highlightTags?: string[], score?: number | null, scoreLabel?: string, grade?: string, showGrade?: boolean, selected?: boolean, readonly?: boolean,
    scoreDetails?: () => { main: number, subs: { score: number }[] } | null, scoreSide?: string, hideFixedMainStat?: boolean, shortRecharge?: boolean }>()
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
    container: artifact-card / inline-size;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--cx-step-2);
    border-radius: 14px;
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

    .art-hover-grid &:hover:enabled {
        transform: none;
        background: var(--artifact-card-surface, var(--cx-card));
    }

    .art-hover-grid &:not(.selected):hover {
        box-shadow: none;
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

.art-overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.9fr);
    align-items: start;
    gap: 12px;
}

.art-portrait {
    position: relative;
    justify-self: start;
}

.art-lock {
    position: absolute;
    top: -4px;
    left: -4px;
    display: grid;
    place-items: center;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--cx-gold);
    background: var(--cx-card);
    color: var(--cx-gold);
    font-size: 11px;
}

.art-head {
    display: grid;
    justify-items: start;
    gap: 10px;
}

.art-name {
    display: grid;
    gap: 2px;
    min-width: 0;
    line-height: 1.35;
    overflow-wrap: anywhere;

    b {
        font-size: 15px;
    }

    :deep(small) {
        color: var(--cx-dim);
        font-size: 12px;
    }
}

.art-stats {
    display: grid;
    gap: 6px;
    min-width: 0;
}

.art-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 5px 9px;
    border: 1px solid var(--cx-step-2);
    border-radius: 8px;
    background: var(--cx-step);

    > span {
        color: var(--cx-dim);
        font-size: 13px;
        line-height: 1.3;
        overflow-wrap: anywhere;
    }

    b {
        flex: none;
        font-size: 21px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
}

.art-subs {
    display: grid;
    border: 1px solid var(--cx-step-2);
    border-radius: 8px;
    padding: 2px 9px;
}

.art-sub {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    padding: 3px 0;
    font-size: 13px;

    & + & {
        border-top: 1px solid var(--cx-step-2);
    }

    .sub-label {
        min-width: 0;
        color: var(--cx-dim);
        line-height: 1.4;
        overflow-wrap: anywhere;
    }

    b {
        flex: none;
        white-space: nowrap;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    &.crit b {
        color: var(--cx-gold);
    }
}

.art-card .role-highlight > :is(span, b) { color: var(--cx-gold); }
.art-main.fixed-main-stat > :is(span, b) { color: var(--cx-letter); }

.art-score {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    padding-top: 7px;
    border-top: 1px solid var(--cx-step-2);
    color: var(--cx-dim);
    font-size: 12px;

    > span {
        overflow-wrap: anywhere;
    }

    b {
        font-size: 14px;
        white-space: nowrap;
    }
}

.score-trigger { min-height: 0; border: 0; border-radius: 4px; background: transparent; padding: 4px 2px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700; }
.score-trigger:focus-visible { outline: 2px solid currentColor; }
.score-breakdown header, .score-breakdown dl > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.score-breakdown header { padding-bottom: 6px; border-bottom: 1px solid var(--cx-step-2); font-size: 14px; }
.score-breakdown dl { display: grid; gap: 5px; margin: 8px 0 0; font-size: 13px; }
.score-breakdown small { color: var(--cx-dim); }
.score-breakdown .role-highlight, .score-breakdown .crit dd { color: var(--cx-gold); }
.score-breakdown .fixed-main-stat { color: var(--cx-letter); }
.score-breakdown dd { flex: none; margin: 0; font-variant-numeric: tabular-nums; }
@container artifact-card (max-width: 239px) {
    .art-overview {
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
    }

    .art-head {
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 8px;
    }
}
@media (prefers-reduced-motion: reduce) {
    .art-card {
        transition: none;
    }
}
</style>
<style scoped src="../../styles/artifact-score.css"></style>
