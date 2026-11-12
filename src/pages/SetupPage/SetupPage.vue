<template>
    <div>
        <el-form label-width="120px" label-position="left">
            <el-form-item :label="t('setupPage.appearance')">
                <el-radio-group :model-value="colorMode" @update:model-value="setColorMode" :aria-label="t('setupPage.appearance')">
                    <el-radio-button label="light">{{ t('setupPage.light') }}</el-radio-button>
                    <el-radio-button label="dark">{{ t('setupPage.dark') }}</el-radio-button>
                    <el-radio-button label="auto">{{ t('setupPage.system') }}</el-radio-button>
                </el-radio-group>
            </el-form-item>
            <el-form-item>
                <template #label>
                    <div class="setup-item-label">
<!--                        <el-icon class="icon" :size="20"><i-fa6-solid-language></i-fa6-solid-language></el-icon>-->
                        {{ t("misc.lang") }}
                    </div>
                </template>

                <el-select :model-value="locale" @update:modelValue="handleSetLocale($event)">
                    <el-option label="简体中文" value="zh-cn"></el-option>
                    <el-option label="English" value="en"></el-option>
                </el-select>
            </el-form-item>

            <el-form-item v-if="usageStatsAvailable" :label="t('usageStats.title')">
                <el-switch :model-value="usageStatsConsent === 'on'" :aria-label="t('usageStats.title')"
                    @update:model-value="setUsageStatsConsent($event ? 'on' : 'off')"></el-switch>
            </el-form-item>

            <el-form-item>
                <template #label>
                    <div class="setup-item-label">
<!--                        <el-icon class="icon" :size="18"><i-fa6-solid-database></i-fa6-solid-database></el-icon>-->
                        {{ t("setupPage.storage") }}
                    </div>
                </template>
                <el-popconfirm @confirm="handleClearLocalStorage" :title="t('setupPage.confirmClear')">
                    <template #reference>
                        <el-button type="danger" :icon="IconEpDelete">{{ t("setupPage.clear") }}</el-button>
                    </template>
                </el-popconfirm>
            </el-form-item>
        </el-form>
    </div>
</template>

<script setup lang="ts">
import localforage from "localforage"
import {colorMode,setColorMode} from "@/styles/color-mode.mjs"
import {useI18n} from "@/i18n/i18n"
import {usageStatsAvailable, usageStatsConsent, setUsageStatsConsent} from "@/usage-stats/index.mjs"
import IconEpDelete from "~icons/ep/delete"

const { t, setLocale, locale } = useI18n()


function handleClearLocalStorage() {
    localStorage.clear()
    localforage.clear()
}

async function handleSetLocale(lang: string) {
    const loading = ElLoading.service({
        fullscreen: true,
        lock: true,
        text: t("setupPage.loading"),
    })

    await nextTick()

    await setLocale(lang).finally(() => {
        loading.close()
    })
}
</script>

<style scoped lang="scss">
.setup-item-label {
    display: flex;
    align-items: center;

    //.icon {
    //    //margin-right: 4px;
    //    width: 36px;
    //}
}
</style>
