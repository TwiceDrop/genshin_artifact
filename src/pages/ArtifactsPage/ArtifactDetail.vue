<template>
    <div class="art-detail">
        <div class="art-detail-hero">
            <artifact-icon :item="item" :size="84" />
            <div>
                <b>{{ setLabel }}</b>
                <small>{{ slotLabel }} · {{ item.star }} 星 · {{ item.omit ? "已锁定" : "未锁定" }}</small>
            </div>
        </div>

        <div class="art-detail-main">
            <span>{{ main[0] }}</span>
            <b>{{ main[1] }}</b>
        </div>

        <div class="art-detail-subs">
            <div v-for="(sub, index) in subs" :key="index" :class="{ crit: sub.crit }">
                <span>{{ sub.label }}</span><b>{{ sub.value }}</b>
            </div>
        </div>

        <button type="button" class="art-detail-score" @click="emit('score')">
            <span>喵喵评分<template v-if="scoreLabel"> · {{ scoreLabel }}</template></span>
            <b v-if="score !== null && score !== undefined">{{ score.toFixed(1) }} <small>{{ grade }}</small></b>
            <em>评分详情 ›</em>
        </button>

        <div v-if="effect2 || effect4" class="art-detail-set">
            <p v-if="effect2"><b>2 件套</b>：<span v-html="effect2"></span></p>
            <p v-if="effect4"><b>4 件套</b>：<span v-html="effect4"></span></p>
        </div>

        <div class="art-detail-actions">
            <button type="button" @click="emit('edit')">编辑</button>
            <button type="button" @click="emit('toggle-lock')">
                <icon-ep-lock v-if="!item.omit" aria-hidden="true" /><icon-ep-unlock v-else aria-hidden="true" />
                {{ item.omit ? '解锁' : '锁定' }}
            </button>
            <button type="button" class="danger" @click="emit('delete')">删除</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import IconEpLock from "~icons/ep/lock"
import IconEpUnlock from "~icons/ep/unlock"
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import {displayedTagParts} from "@/utils/artifacts"
import {useI18n} from "@/i18n/i18n"
import type {IArtifact} from "@/types/artifact"
import ArtifactIcon from "./ArtifactIcon.vue"

const props = defineProps<{ item: IArtifact, score?: number | null, scoreLabel?: string, grade?: string }>()
const emit = defineEmits<{
    (e: "edit"): void
    (e: "toggle-lock"): void
    (e: "delete"): void
    (e: "score"): void
}>()
const { t, ta } = useI18n()

const set = computed(() => (artifactsData as any)[props.item.setName])
const setLabel = computed(() => ta(set.value.nameLocale))
const slotLabel = computed(() => t("misc", props.item.position))
const effect2 = computed(() => set.value.effect2 ? ta(set.value.effect2) : "")
const effect4 = computed(() => set.value.effect4 ? ta(set.value.effect4) : "")
const main = computed(() => displayedTagParts(props.item.mainTag.name, props.item.mainTag.value))
const subs = computed(() => props.item.normalTags.map(tag => {
    const [label, value] = displayedTagParts(tag.name, tag.value)
    return { label, value, crit: tag.name === "critical" || tag.name === "criticalDamage" }
}))
</script>

<style lang="scss" scoped>
.art-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--cx-letter);
}

.art-detail-hero {
    display: flex;
    align-items: center;
    gap: 16px;

    b {
        display: block;
        font-size: 18px;
    }

    small {
        color: var(--cx-dim);
    }
}

.art-detail-main {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--cx-step);

    span {
        color: var(--cx-dim);
    }

    b {
        font-size: 28px;
        font-variant-numeric: tabular-nums;
    }
}

.art-detail-subs div {
    display: flex;
    justify-content: space-between;
    padding: 8px 2px;

    span {
        color: var(--cx-dim);
    }

    b {
        font-variant-numeric: tabular-nums;
    }

    &.crit b {
        color: var(--cx-gold);
    }
}

.art-detail-score {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 0;
    border-radius: 12px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font: inherit;
    text-align: left;
    cursor: pointer;

    > span {
        color: var(--cx-dim);
    }

    b {
        margin-left: auto;
        color: var(--cx-gold);
        font-size: 22px;
        font-variant-numeric: tabular-nums;

        small {
            font-size: 13px;
        }
    }

    em {
        margin-left: auto;
        color: var(--cx-gold);
        font-style: normal;
        font-size: 13px;
    }

    b + em {
        margin-left: 6px;
    }

    &:hover {
        background: var(--cx-step-2);
    }
}

.art-detail-set {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--cx-step);
    color: var(--cx-dim);
    font-size: 13px;
    line-height: 1.7;

    p {
        margin: 0;
    }

    p + p {
        margin-top: 6px;
    }

    b {
        color: var(--cx-letter);
    }
}

.art-detail-actions {
    display: flex;
    gap: 10px;

    button {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 42px;
        border: 0;
        border-radius: 10px;
        background: var(--cx-step);
        color: var(--cx-letter);
        font: inherit;
        cursor: pointer;

        &:hover {
            background: var(--cx-step-2);
        }

        &.danger {
            color: var(--cx-up);
        }
    }
}

.art-detail button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}
</style>
