<script setup lang="ts">
import { useI18n } from '@/i18n/i18n'

defineProps<{ description?: string }>()
const { locale } = useI18n()
</script>

<template>
    <div class="ui-empty" role="status">
        <div class="ui-empty-image"><i-ep-box aria-hidden="true" /></div>
        <p>{{ description ?? (locale === 'en' ? 'No Data' : '暂无数据') }}</p>
    </div>
</template>

<style scoped>
.ui-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 0; color: var(--cx-dim); }
.ui-empty-image { display: grid; place-items: center; width: 160px; aspect-ratio: 79 / 86; }
.ui-empty-image svg { width: 48px; height: 48px; }
.ui-empty p { margin: 20px 0 0; font-size: 14px; text-align: center; }
</style>
