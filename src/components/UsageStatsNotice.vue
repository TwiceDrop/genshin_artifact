<template>
    <!-- Shown once until the player answers; nothing is sent before that. -->
    <UiDialog :model-value="visible" :title="t('usageStats.title')" width="var(--app-dialog-width, 480px)"
        top="var(--app-dialog-top)" content-class="app-dialog" focus-container hide-close prevent-outside
        @escape-key-down="$event.preventDefault()">
        <p class="usage-stats-notice">{{ t('usageStats.notice') }}</p>
        <template #footer>
            <UiButton @click="setUsageStatsConsent('off')">{{ t('usageStats.turnOff') }}</UiButton>
            <UiButton variant="primary" @click="setUsageStatsConsent('on')">{{ t('usageStats.gotIt') }}</UiButton>
        </template>
    </UiDialog>
</template>

<script setup>
import {computed} from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import {useI18n} from '@/i18n/i18n'
import {usageStatsAvailable, usageStatsConsent, setUsageStatsConsent} from '@/usage-stats/index.mjs'

const {t} = useI18n()
const visible = computed(() => usageStatsAvailable && usageStatsConsent.value === null)
</script>

<style scoped>
.usage-stats-notice {
    margin: 0;
    line-height: 1.7;
}
</style>
