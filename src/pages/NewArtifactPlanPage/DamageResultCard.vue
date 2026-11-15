<template>
    <section class="dmg-card" aria-labelledby="dmg-card-title">
        <header class="dmg-head">
            <h3 id="dmg-card-title">伤害</h3>
            <slot name="actions" />
            <button type="button" class="dmg-link" @click="emit('details')">伤害明细 ›</button>
        </header>
        <div class="dmg-body">
            <nav class="dmg-skills" aria-label="技能">
                <div v-for="group in groups" :key="group.title" class="dmg-group">
                    <span class="dmg-group-title">{{ group.title }}</span>
                    <button v-for="skill in group.items" :key="skill.index" type="button"
                            :class="{ on: skill.index === modelValue }" :aria-pressed="skill.index === modelValue"
                            @click="emit('update:modelValue', skill.index)">{{ skill.label }}</button>
                </div>
            </nav>
            <div class="dmg-main">
                <slot />
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import type {SkillGroup} from "@/utils/character-skill-groups"

defineProps<{ groups: SkillGroup[], modelValue: number }>()
const emit = defineEmits<{ (e: "update:modelValue", value: number): void, (e: "details"): void }>()
</script>

<style lang="scss" scoped>
.dmg-card {
    padding: 22px 24px;
    border-radius: var(--cx-radius);
    background: var(--cx-card);
    color: var(--cx-letter);
}

.dmg-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;

    h3 {
        margin: 0 auto 0 0;
        font-size: 17px;
        font-weight: 700;
    }
}

.dmg-link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--cx-gold);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.dmg-body {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 24px;
}

.dmg-skills {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 520px;
    overflow-y: auto;
}

.dmg-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.dmg-group-title {
    padding: 10px 12px 4px;
    color: var(--cx-dim);
    font-size: 12px;
}

.dmg-group button {
    min-height: 36px;
    padding: 6px 12px;
    border: 0;
    border-radius: 9px;
    background: none;
    color: var(--cx-dim);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;

    &:hover {
        background: var(--cx-step);
        color: var(--cx-letter);
    }

    &.on {
        background: var(--cx-step-2);
        color: var(--cx-letter);
        font-weight: 600;
    }
}

.dmg-card button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

.dmg-main {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
    .dmg-group button {
        transition: none;
    }
}

// 窄屏：技能列表改成横向滚动的分组标签
@container single-calculator (max-width: 820px) {
    .dmg-card {
        padding: 18px 16px;
    }

    .dmg-body {
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
    }

    .dmg-skills {
        flex-direction: row;
        gap: 16px;
        max-height: none;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 4px;
    }

    .dmg-group {
        flex-direction: row;
        align-items: center;
        flex: none;
    }

    .dmg-group-title {
        padding: 0 4px 0 0;
        white-space: nowrap;
    }

    .dmg-group button {
        white-space: nowrap;
    }
}
</style>
