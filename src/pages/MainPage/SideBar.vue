<template>
    <Sidebar data-tour="nav.sidebar" :collapsible="collapsible" :aria-label="t('nav.nav')">
        <SidebarHeader>
            <button type="button" class="sb-brand" :aria-label="webTitle" @click="go('/intro')">
                <mona-portrait class="sb-portrait" />
                <span class="sb-brand-text">
                    <span class="sb-name">{{ webTitle }}</span>
                    <span class="sb-version">V{{ version }}</span>
                </span>
            </button>

        </SidebarHeader>
        <SidebarContent>
            <SidebarGroup v-for="group in groups" :key="group.key">
                <h2 v-if="group.title" data-sidebar="group-label">{{ group.title }}</h2>
                <SidebarMenu>
                    <SidebarMenuItem v-for="item in group.items" :key="item.path">
                        <SidebarMenuButton :is-active="isActive(item.path)" :aria-label="item.label" @click="go(item.path)">
                            <component :is="item.icon" class="sb-icon" aria-hidden="true" />
                            <span class="sb-label">{{ item.label }}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem v-if="group.key === 'other'">
                        <SidebarMenuButton data-tour="nav.guide" aria-label="使用引导" @click="showGuideHub">
                            <IconEpQuestionFilled class="sb-icon" aria-hidden="true" />
                            <span class="sb-label">使用引导</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem v-for="item in accountItems" :key="item.path">
                    <SidebarMenuButton :is-active="isActive(item.path)" :aria-label="item.label" @click="go(item.to || item.path)">
                        <img v-if="item.avatar" :src="item.avatar" alt="" class="sb-avatar" />
                        <component v-else :is="item.icon" class="sb-icon" aria-hidden="true" />
                        <span class="sb-label">{{ item.label }}</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
</template>

<script setup lang="ts">
import Sidebar from "@/components/ui/sidebar/Sidebar.vue"
import SidebarHeader from "@/components/ui/sidebar/SidebarHeader.vue"
import SidebarContent from "@/components/ui/sidebar/SidebarContent.vue"
import SidebarFooter from "@/components/ui/sidebar/SidebarFooter.vue"
import SidebarGroup from "@/components/ui/sidebar/SidebarGroup.vue"
import SidebarMenu from "@/components/ui/sidebar/SidebarMenu.vue"
import SidebarMenuItem from "@/components/ui/sidebar/SidebarMenuItem.vue"
import SidebarMenuButton from "@/components/ui/sidebar/SidebarMenuButton.vue"
import {openHub} from "@/onboarding/controller.mjs"
import IconEpQuestionFilled from "~icons/ep/question-filled"
import IconEpHouse from "~icons/ep/house"
import {useFeatureLinks} from "./useFeatureLinks"
import IconEpDownload from "~icons/ep/download"
import IconEpUser from "~icons/ep/user"
import IconEpSetting from "~icons/ep/setting"
import IconEpAvatar from "~icons/ep/avatar"

import {computed} from "vue"
import {onlineUser, avatarUrl} from "@/cloud/online-user.mjs"
import {useRoute, useRouter} from "vue-router"
import {useI18n} from "@/i18n/i18n"
import {useAccountStore} from "@/store/pinia/account"
import MonaPortrait from "@/components/misc/MonaPortrait.vue"

const props = withDefaults(defineProps<{ doRoute?: boolean, collapsible?: boolean }>(), { doRoute: true })
const emit = defineEmits<{ (e: "select", path: string): void, (e: "close"): void }>()

const version = process.env.MONA_VERSION
const webTitle = process.env.MONA_TITLE

const { t } = useI18n()
const features = useFeatureLinks()
const route = useRoute()
const router = useRouter()
const { currentAccountName } = useAccountStore()

// 计算放最前：它是玩家最常用的入口；设置和账号移到底部
const groups = computed(() => [
    { key: "home", items: [
        { path: "/intro", label: t("nav.home"), icon: IconEpHouse },
        features.value.character,
    ] },
    { key: "compute", title: t("nav.compute"), items: [
        features.value.calculate, features.value.team, features.value.history,
    ] },
    { key: "repo", title: t("nav.repo"), items: [
        features.value.artifacts, features.value.kumi,
    ] },
    { key: "other", title: t("nav.other"), items: [
        { path: "/help/export-tools", label: t("nav.exportTool"), icon: IconEpDownload },
    ] },
])

const accountItems = computed(() => [
    { path: '/online-account', to: onlineUser.user ? '/online-account' : '/login?redirect=/online-account',
        label: onlineUser.user ? onlineUser.user.username || onlineUser.user.email : '点击登录',
        icon: IconEpAvatar, avatar: onlineUser.user && avatarUrl(onlineUser.user.avatar) },
    { path: '/account', label: t('nav.account') + ' / ' + currentAccountName.value, icon: IconEpUser },
    { path: '/setup', label: t('nav.setup'), icon: IconEpSetting },
])

function isActive(path: string) {
    // 首页另有别名 "/"
    return path === "/intro" ? route.name === "home" : route.path === path
}

function showGuideHub() {
    emit("close")
    openHub()
}

function go(path: string) {
    if (props.doRoute) router.push(path)
    else emit("select", path)
}
</script>

<style scoped>
.sb-brand { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: 0; border-radius: 8px; background: transparent; color: var(--sh-letter); text-align: left; cursor: pointer; }
.sb-portrait { flex: none; width: 32px; height: 32px; }
.sb-brand-text { display: grid; gap: 2px; white-space: nowrap; }
.sb-name { color: var(--sh-gold); font: 20px/1.2 "Mona Brand", "KaiTi", serif; }
.sb-version { color: var(--sh-dim); font-size: 11px; font-variant-numeric: tabular-nums; }
.sb-avatar { flex: none; width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
.sb-icon { flex: none; width: 20px; height: 20px; }
.sb-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-state="collapsed"] :is(.sb-brand-text, .sb-label) { visibility: hidden; }
</style>
