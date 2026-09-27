<template>
    <div class="page-root">
        <p
            class="title"
        >
            <span class="mona">{{ webTitle }}</span>
            V{{ version }}
        </p>

        <div class="update-controls">
            <el-button type="primary" plain @click="requestManualUpdateCheck">{{ t('intro.checkForUpdates') }}</el-button>
            <el-switch v-model="automaticUpdates" :active-text="t('intro.automaticUpdateCheck')"
                       @change="changeAutomaticUpdates" />
        </div>

<!--        <el-button @click="handleTest"></el-button>-->

        <el-row :gutter="16">
            <el-col :sm="6" :xs="24" class="mb16">
                <use-case-item :text="t('intro.useCase1')" url="/calculate" :icon="IconFa6SolidCalculator"
                    :description="t('intro.useCase1Description')"
                ></use-case-item>
            </el-col>
            <el-col :sm="6" :xs="24" class="mb16">
                <use-case-item :text="t('intro.useCase2')" url="/team-optimization" :icon="IconFa6SolidUserGroup"
                               :description="t('intro.useCase2Description')"
                ></use-case-item>
            </el-col>
            <el-col :sm="6" :xs="24" class="mb16">
                <use-case-item :text="t('intro.useCase3')" url="/potential" :icon="IconFa6SolidRuler"
                               :description="t('intro.useCase3Description')"
                ></use-case-item>
            </el-col>
            <el-col :sm="6" :xs="24" class="mb16">
                <use-case-item :text="t('intro.useCase4')" url="/help/export-tools" :icon="IconFa6SolidFileExport"
                               :description="t('intro.useCase4Description')"
                ></use-case-item>
            </el-col>
        </el-row>

        <h2>{{ t("intro.opensource") }}</h2>
        <el-row :gutter="16">
            <el-col :xs="24" :sm="12" class="mb16">
                <use-case-item text="MONA" :icon="IconFa6BrandsGithub"
                               :description="t('intro.opensourceMonaDescription')"
                               @click="newPage('https://github.com/TwiceDrop/genshin_artifact')"
                ></use-case-item>

            </el-col>
            <el-col :xs="24" :sm="12" class="mb16">
                <use-case-item text="Yas" :icon="IconFa6BrandsGithub"
                               :description="t('intro.opensourceYasDescription')"
                               @click="newPage('https://github.com/1803233552/yas')"
                ></use-case-item>
            </el-col>
        </el-row>

    </div>
</template>

<script setup lang="ts">

import IconFa6SolidUserGroup from "~icons/fa6-solid/user-group"
import IconFa6SolidFileExport from "~icons/fa6-solid/file-export"
import IconFa6SolidCalculator from "~icons/fa6-solid/calculator"
import IconFa6SolidRuler from "~icons/fa6-solid/ruler"
import IconFa6BrandsGithub from "~icons/fa6-brands/github"

import UseCaseItem from "./UseCaseItem.vue"
import {useRouter} from "vue-router"
import {onActivated, onBeforeUnmount, onMounted, ref} from "vue"
import {ElMessage} from "element-plus"
import {useI18n} from "@/i18n/i18n"
import {AUTOMATIC_UPDATE_CHANGED_EVENT, isAutomaticUpdateEnabled,
    requestManualUpdateCheck, setAutomaticUpdateEnabled} from "@/platform/release-update.mjs"


const version = process.env.MONA_VERSION
const webTitle = process.env.MONA_TITLE
const needMigrate = process.env.MONA_NEED_MIGRATE
const buildDate = process.env.MONA_BUILD_DATA
const host = location.hostname


const router = useRouter()

const { t } = useI18n()
const automaticUpdates = ref(isAutomaticUpdateEnabled())
const refreshAutomaticUpdates = () => { automaticUpdates.value = isAutomaticUpdateEnabled() }
onActivated(refreshAutomaticUpdates)
onMounted(() => window.addEventListener(AUTOMATIC_UPDATE_CHANGED_EVENT, refreshAutomaticUpdates))
onBeforeUnmount(() => window.removeEventListener(AUTOMATIC_UPDATE_CHANGED_EVENT, refreshAutomaticUpdates))
function changeAutomaticUpdates(enabled: boolean) {
    if (!setAutomaticUpdateEnabled(enabled)) {
        refreshAutomaticUpdates()
        ElMessage.error('无法保存更新偏好，请检查浏览器存储设置')
    }
}

function navigateTo(r: any) {
    router.push(r)
}

function newPage(url: string) {
    window.open(url, "_blank")
}


</script>

<style lang="scss" scoped>
.page-root {
    //height: 100%;
    overflow: auto;

    -ms-overflow-style: none;
}

.page-root::-webkit-scrollbar {
    display: none;
}

.build-info {
    font-size: 12px;

}

.mb16 {
    margin-bottom: 16px;
}

.update-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin: -8px 0 24px;
}

.title {
    font-size: 3rem;
    margin: 0;
    margin-bottom: 24px;
    padding: 0;
}

@media (max-width: 767px) {
    .title { font-size: clamp(24px, 7vw, 32px); line-height: 1.5; }
}

.item {
    cursor: pointer;
}

.item-title {
    font-weight: bold;
    font-size: 1.2rem;
    padding: 0;
    margin: 16px 0 0 0;
}

.icon {
    font-size: 1.5rem;
}

.card-title {
    font-size: 1.2rem;
    margin: 0 0 16px 0;
}

.big-card-title {
    margin: 0;
    padding: 0 0 16px 0;
    font-size: 1.5rem;
}

.data-source {
    margin: 0;
    margin-right: 10px;
    margin-top: 10px;
}

.mona {
    background: rgb(86,72,132);
    border-radius: 3px;
    color: white;
    padding: 0 8px;
}

.source-code-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 15vh;
    border: 1px solid #00000011;
    cursor: pointer;

    &:hover {
        background: rgb(251, 249, 255);
    }
}
</style>
