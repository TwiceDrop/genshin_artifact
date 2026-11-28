<template>
    <div class="art-detail">
        <ArtifactCard :item="item" :highlight-tags="highlightTags" readonly>
            <template #icon><ArtifactIcon :item="item" :size="84" /></template>
            <template #metadata>
                <small class="art-detail-metadata">
                    <span>{{ item.star }} 星</span>
                    <span class="art-detail-lock-state" :data-locked="item.omit" aria-live="polite">
                        <IconEpLock v-if="item.omit" aria-hidden="true" />
                        <IconEpUnlock v-else aria-hidden="true" />
                        {{ item.omit ? '已锁定' : '未锁定' }}
                    </span>
                </small>
            </template>
        </ArtifactCard>

        <UiButton class="art-detail-score" @click="emit('score')">
            <span>喵喵评分<template v-if="scoreLabel"> · {{ scoreLabel }}</template></span>
            <b v-if="score !== null && score !== undefined" class="miao-score" :data-grade="grade">{{ score.toFixed(1) }} <small>{{ grade }}</small></b>
            <em>评分详情 ›</em>
        </UiButton>

        <div v-if="effect2 || effect4" class="art-detail-set">
            <p v-if="effect2"><b>2 件套</b>：<span v-html="effect2"></span></p>
            <p v-if="effect4"><b>4 件套</b>：<span v-html="effect4"></span></p>
        </div>

        <div class="art-detail-actions">
            <UiButton @click="emit('edit')">编辑</UiButton>
            <UiButton class="art-detail-lock-action" variant="primary" @click="emit('toggle-lock')">
                <IconEpLock v-if="!item.omit" aria-hidden="true" />
                <IconEpUnlock v-else aria-hidden="true" />
                {{ item.omit ? '解锁' : '锁定' }}
            </UiButton>
            <UiButton class="danger" @click="emit('delete')">删除</UiButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import IconEpLock from "~icons/ep/lock"
import IconEpUnlock from "~icons/ep/unlock"
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import {useI18n} from "@/i18n/i18n"
import type {IArtifact} from "@/types/artifact"
import ArtifactCard from "@/components/display/ArtifactCard.vue"
import ArtifactIcon from "@/components/display/ArtifactIcon.vue"

const props = defineProps<{ item: IArtifact, score?: number | null, scoreLabel?: string, grade?: string, highlightTags?: string[] }>()
const emit = defineEmits<{
    (e: "edit"): void
    (e: "toggle-lock"): void
    (e: "delete"): void
    (e: "score"): void
}>()
const { ta } = useI18n()

const set = computed(() => (artifactsData as any)[props.item.setName])
const effect2 = computed(() => set.value.effect2 ? ta(set.value.effect2) : "")
const effect4 = computed(() => set.value.effect4 ? ta(set.value.effect4) : "")
</script>

<style lang="scss" scoped>
.art-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--cx-letter);
}

.art-detail :deep(.art-name b) {
    font-size: 18px;
}

.art-detail :deep(.art-main b) {
    font-size: 28px;
}

.art-detail-metadata {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 6px;
}

.art-detail-lock-state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border: 1px solid var(--cx-step-2);
    border-radius: 8px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font-weight: 600;
    white-space: nowrap;

    &[data-locked="true"] {
        border-color: var(--cx-gold);
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
        border-radius: 10px;
        font: inherit;
        cursor: pointer;

        &[data-variant="outline"] {
            border: 0;
        }

        &.danger {
            color: var(--cx-up);
        }
    }

    .art-detail-lock-action {
        font-weight: 700;

        svg {
            width: 18px;
            height: 18px;
        }
    }
}

.art-detail button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}
</style>
<style scoped src="../../styles/artifact-score.css"></style>
