<template>
  <ul v-if="hits?.length" class="dsl-item-hits">
    <li v-for="(hit, idx) in hits" :key="idx" class="dsl-item-hit">
      <span class="dsl-item-hit-text">{{ ta(hit.text) }}</span>
      <span v-if="hit.reaction !== 'normal'" class="dsl-item-hit-reaction" :data-reaction="hit.reaction">
        {{ damageReactionLabel(hit.reaction).replace(/^直接/, '') }}
      </span>
      <span class="dsl-item-hit-count">×{{ hit.count }}</span>
      <span v-if="hit.state" class="dsl-item-hit-state">{{ hit.state }}</span>
    </li>
  </ul>
  <details v-if="source" class="dsl-item-source-wrap">
    <summary class="dsl-item-source-toggle">{{ language === 'Rust' ? '查看仓库源码（Rust）' : '查看源码' }}</summary>
    <pre class="dsl-item-source" tabindex="0" :aria-label="language + ' ' + title">{{ source }}</pre>
  </details>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n/i18n'
import { damageReactionLabel } from '@/algorithms/reaction-labels.mjs'

withDefaults(defineProps<{
  title: string
  hits?: { text: number; reaction: string; count: number; state?: string }[]
  source: string
  language?: string
}>(), { language: 'MONA-DSL' })

const { ta } = useI18n()
</script>

<style scoped>
.dsl-item-source {
  margin: 0;
  padding: 8px 10px;
  max-height: 7.5em;
  overflow: auto;
  background: var(--cx-step);
  border: 1px solid var(--cx-step-2);
  border-radius: 6px;
  color: var(--cx-dim);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dsl-item-source:focus-visible,
.dsl-item-source-toggle:focus-visible {
  outline: 2px solid var(--cx-gold);
  outline-offset: 2px;
}

.dsl-item-hits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dsl-item-hit {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 8px;
  background: var(--cx-step);
  border: 1px solid var(--cx-step-2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--cx-letter);
  overflow-wrap: anywhere;
}

.dsl-item-hit-reaction {
  color: var(--dsl-reaction-day);
}

html[data-color-mode="dark"] .dsl-item-hit-reaction {
  color: var(--dsl-reaction-night);
}

/* 按游戏战斗中的反应文字取色，浅色背景上降低明度以保持可读。 */
.dsl-item-hit-reaction:is([data-reaction="melt"], [data-reaction="vaporize"]) {
  --dsl-reaction-day: #8b570c;
  --dsl-reaction-night: #ffcd73;
}

.dsl-item-hit-reaction[data-reaction="spread"] {
  --dsl-reaction-day: #09733f;
  --dsl-reaction-night: #31d868;
}

.dsl-item-hit-reaction[data-reaction="aggravate"] {
  --dsl-reaction-day: #7941a3;
  --dsl-reaction-night: #d28cf6;
}

.dsl-item-hit-reaction[data-reaction="direct_moonelectro"] {
  --dsl-reaction-day: #7552a2;
  --dsl-reaction-night: #e8ccff;
}

.dsl-item-hit-reaction[data-reaction="direct_moonbloom"] {
  --dsl-reaction-day: #41722d;
  --dsl-reaction-night: #d6fab7;
}

.dsl-item-hit-reaction[data-reaction="direct_mooncrystallize"] {
  --dsl-reaction-day: #826020;
  --dsl-reaction-night: #ffe2a3;
}

.dsl-item-hit-reaction[data-reaction="direct_stellarconduct"] {
  --dsl-reaction-day: #69528c;
  --dsl-reaction-night: #decfff;
}

.dsl-item-hit-reaction[data-reaction="direct_stellarswirl"] {
  --dsl-reaction-day: #1c6b60;
  --dsl-reaction-night: #b4f9eb;
}

.dsl-item-hit-count,
.dsl-item-hit-state {
  color: var(--cx-dim);
}

.dsl-item-source-wrap {
  min-width: 0;
}

.dsl-item-source-toggle {
  cursor: pointer;
  font-size: 12px;
  color: var(--cx-dim);
  user-select: none;
}

.dsl-item-source-wrap[open] .dsl-item-source-toggle {
  margin-bottom: 6px;
}
</style>
