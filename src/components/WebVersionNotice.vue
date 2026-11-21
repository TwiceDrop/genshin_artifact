<template>
    <!-- 网页版停止维护的提醒，只在在线托管的网页版出现，每次打开都提示 -->
    <el-dialog v-model="visible" :width="deviceIsPC ? '440px' : '92%'" :show-close="false" append-to-body>
        <p class="web-version-notice">网页版将不再维护，后续更新请使用桌面版/请加入群获取最新版本。</p>
        <template #footer>
            <el-button type="primary" @click="visible = false">{{ t('usageStats.gotIt') }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import {ref} from 'vue'
import {useI18n} from '@/i18n/i18n'
import {isNative} from '@/platform/native.mjs'
import {isHostedWebVersion} from '@/platform/web-version.mjs'
import {deviceIsPC} from '@/utils/device'

const {t} = useI18n()
const visible = ref(isHostedWebVersion({native: isNative, hostname: globalThis.location?.hostname}))
</script>

<style scoped>
.web-version-notice {
    margin: 0;
    line-height: 1.7;
}
</style>
