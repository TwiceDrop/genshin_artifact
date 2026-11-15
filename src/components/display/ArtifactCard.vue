<template>
    <component :is="readonly ? 'div' : 'button'" :type="readonly ? undefined : 'button'" class="art-card" :class="{ selected, readonly }"
               :aria-label="readonly ? undefined : `${setLabel} · ${slotLabel} +${item.level}`" @click="readonly || emit('open')">
        <span v-if="item.omit && !readonly" class="art-lock" title="已锁定"><icon-ep-lock aria-hidden="true" /></span>
        <span class="art-head">
            <artifact-icon :item="item" />
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
    </component>
</template>

<script setup lang="ts">
// 圣遗物卡片：圣遗物页的网格和历史记录详情共用。readonly 时只展示（不可点、不显示锁定），用于计算记录里的快照。
import IconEpLock from "~icons/ep/lock"
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import {displayedTagParts} from "@/utils/artifacts"
import {useI18n} from "@/i18n/i18n"
import type {IArtifact} from "@/types/artifact"
import ArtifactIcon from "@/components/display/ArtifactIcon.vue"

const props = defineProps<{ item: IArtifact, score?: number | null, scoreLabel?: string, grade?: string, selected?: boolean, readonly?: boolean }>()
const emit = defineEmits<{ (e: "open"): void }>()
const { t, ta } = useI18n()

const set = computed(() => (artifactsData as any)[props.item.setName])
const setLabel = computed(() => ta(set.value.nameLocale))
const slotLabel = computed(() => t("misc", props.item.position))

const main = computed(() => displayedTagParts(props.item.mainTag.name, props.item.mainTag.value))
const subs = computed(() => props.item.normalTags.map(tag => {
    const [label, value] = displayedTagParts(tag.name, tag.value)
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

    span span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--cx-dim);
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
