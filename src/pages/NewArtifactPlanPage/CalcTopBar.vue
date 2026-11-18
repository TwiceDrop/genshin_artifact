<template>
    <header class="calc-top-bar">
        <h2 class="calc-top-title">单次计算</h2>
        <div class="calc-top-preset">
            <slot name="preset" />
        </div>
        <button type="button" class="calc-top-chip calc-top-target" aria-haspopup="dialog" @click="emit('target')">
            <small>配装目标</small>
            <b>{{ targetLabel }}</b>
            <icon-ep-arrow-down aria-hidden="true" />
        </button>
        <span class="calc-top-spacer"></span>
        <button type="button" class="calc-top-chip" @click="emit('calculation-settings')">计算设置</button>
        <button type="button" class="calc-top-chip" @click="emit('artifact-settings')">圣遗物设置</button>
        <button type="button" class="calc-top-run" :disabled="running" @click="emit('run')">
            <icon-ep-loading v-if="running" class="calc-top-spin" aria-hidden="true" />
            <span v-else aria-hidden="true">✦</span>
            {{ running ? '计算中' : '自动配装' }}
        </button>
    </header>
</template>

<script setup lang="ts">
import IconEpArrowDown from "~icons/ep/arrow-down"
import IconEpLoading from "~icons/ep/loading"

defineProps<{ targetLabel: string, running: boolean }>()
const emit = defineEmits<{
    (e: "target"): void
    (e: "calculation-settings"): void
    (e: "artifact-settings"): void
    (e: "run"): void
}>()
</script>

<style lang="scss" scoped>
.calc-top-bar {
    position: sticky;
    top: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 12px;
    padding: 14px 0;
    margin-bottom: 8px;
    background: var(--cx-ground);
}

.calc-top-title {
    margin: 0 6px 0 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--cx-letter);
}

.calc-top-preset {
    display: flex;
    align-items: center;
    gap: 8px;
}

.calc-top-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: var(--cx-card);
    color: var(--cx-letter);
    font: inherit;
    cursor: pointer;
    transition: background-color .15s ease;

    small {
        color: var(--cx-dim);
        font-size: 12px;
        white-space: nowrap;
    }

    b {
        max-width: 16em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
    }

    &:hover {
        background: var(--cx-step-2);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.calc-top-spacer {
    flex: 1;
}

.calc-top-run {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 22px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-gold);
    color: var(--cx-gold-on);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: filter .15s ease, transform .15s ease;

    &:hover:not(:disabled) {
        filter: brightness(1.08);
    }

    &:active:not(:disabled) {
        transform: scale(.97);
    }

    &:disabled {
        cursor: progress;
        opacity: .75;
    }

    &:focus-visible {
        outline: 2px solid var(--cx-letter);
        outline-offset: 2px;
    }
}

.calc-top-spin {
    animation: calc-top-spin 1s linear infinite;
}

@keyframes calc-top-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .calc-top-run,
    .calc-top-chip {
        transition: none;
    }

    .calc-top-spin {
        animation: none;
    }
}

// 手机上站点顶栏固定在最上方（48px），顶部条吸在它下面
@media (max-width: 767px) {
    .calc-top-bar {
        top: 48px;
        padding: 10px 0;
    }
}

// 窄屏：预设独占一行，设置与配装操作按可用宽度换行。
@container single-calculator (max-width: 820px) {
    .calc-top-title {
        display: none;
    }

    .calc-top-chip b {
        max-width: 8em;
    }

    // 预设占一整行；配装目标和自动配装并排在第二行
    .calc-top-preset {
        flex: 1 1 100%;
        min-width: 0;
    }

    .calc-top-spacer {
        display: none;
    }

    .calc-top-target {
        flex: 1 1 0;
        min-width: 0;
    }

    .calc-top-run {
        padding: 0 18px;
    }
}
</style>
