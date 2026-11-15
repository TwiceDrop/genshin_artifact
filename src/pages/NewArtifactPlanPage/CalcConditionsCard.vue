<template>
    <section class="cond-card" aria-labelledby="cond-card-title">
        <h3 id="cond-card-title">计算条件</h3>
        <div class="cond-list">
            <button v-for="row in rows" :key="row.key" type="button" class="cond-row" @click="emit('open', row.key)">
                <span class="cond-title">{{ row.title }}<em>{{ row.action }} ›</em></span>
                <span class="cond-summary">{{ row.summary }}</span>
            </button>
        </div>
    </section>
</template>

<script setup lang="ts">
defineProps<{ rows: { key: string, title: string, action: string, summary: string }[] }>()
const emit = defineEmits<{ (e: "open", key: string): void }>()
</script>

<style lang="scss" scoped>
.cond-card {
    padding: 22px 24px;
    border-radius: var(--cx-radius);
    background: var(--cx-card);
    color: var(--cx-letter);

    h3 {
        margin: 0 0 14px;
        font-size: 17px;
        font-weight: 700;
    }
}

.cond-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cond-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 0;
    border-radius: 14px;
    background: var(--cx-step);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color .15s ease;

    &:hover {
        background: var(--cx-step-2);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.cond-title {
    display: flex;
    font-weight: 600;

    em {
        margin-left: auto;
        color: var(--cx-gold);
        font-style: normal;
        font-weight: 400;
        font-size: 13px;
    }
}

.cond-summary {
    color: var(--cx-dim);
    font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
    .cond-row {
        transition: none;
    }
}
</style>
