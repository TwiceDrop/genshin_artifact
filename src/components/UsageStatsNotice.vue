<template>
    <!-- Shown once until the player answers; nothing is sent before that. -->
    <el-dialog :model-value="visible" :title="t('usageStats.title')" width="480px"
        :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false">
        <p class="usage-stats-notice">{{ t('usageStats.notice') }}</p>
        <template #footer>
            <el-button @click="setUsageStatsConsent('off')">{{ t('usageStats.turnOff') }}</el-button>
            <el-button type="primary" @click="setUsageStatsConsent('on')">{{ t('usageStats.gotIt') }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {computed} from 'vue'
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
