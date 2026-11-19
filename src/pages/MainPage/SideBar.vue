<template>
    <nav class="sb" :aria-label="t('nav.nav')">
        <button type="button" class="sb-brand" @click="go('/intro')">
            <mona-portrait class="sb-portrait" />
            <span class="sb-brand-text">
                <span class="sb-name">{{ webTitle }}</span>
                <span class="sb-version">V{{ version }}</span>
            </span>
        </button>

        <div class="sb-scroll">
            <section v-for="group in groups" :key="group.key" class="sb-group">
                <h2 v-if="group.title" class="sb-group-title">{{ group.title }}</h2>
                <button v-for="item in group.items" :key="item.path" type="button" class="sb-item"
                        :class="{ active: isActive(item.path) }"
                        :aria-current="isActive(item.path) ? 'page' : undefined"
                        @click="go(item.path)">
                    <component :is="item.icon" class="sb-icon" aria-hidden="true" />
                    <span class="sb-label">{{ item.label }}</span>
                </button>
            </section>
        </div>

        <div class="sb-foot">
            <!-- 在线账号入口：登录后显示头像和用户名，进账户管理与同步页；没登录显示「点击登录」，登录后回到那一页 -->
            <button type="button" class="sb-item sb-online" :class="{ active: isActive('/online-account') }"
                    :aria-current="isActive('/online-account') ? 'page' : undefined"
                    @click="go(onlineUser.user ? '/online-account' : '/login?redirect=/online-account')">
                <img v-if="onlineUser.user && avatarUrl(onlineUser.user.avatar)" :src="avatarUrl(onlineUser.user.avatar)" alt="" class="sb-avatar" />
                <icon-ep-avatar v-else class="sb-icon" aria-hidden="true" />
                <span class="sb-label">{{ onlineUser.user ? (onlineUser.user.username || onlineUser.user.email) : '点击登录' }}</span>
            </button>
            <button type="button" class="sb-item" :class="{ active: isActive('/account') }"
                    :aria-current="isActive('/account') ? 'page' : undefined" @click="go('/account')">
                <icon-ep-user class="sb-icon" aria-hidden="true" />
                <span class="sb-label">{{ t("nav.account") }} / {{ currentAccountName }}</span>
            </button>
            <button type="button" class="sb-item" :class="{ active: isActive('/setup') }"
                    :aria-current="isActive('/setup') ? 'page' : undefined" @click="go('/setup')">
                <icon-ep-setting class="sb-icon" aria-hidden="true" />
                <span class="sb-label">{{ t("nav.setup") }}</span>
            </button>
        </div>
    </nav>
</template>

<script setup lang="ts">
import IconEpHouse from "~icons/ep/house"
import IconEpDataAnalysis from "~icons/ep/data-analysis"
import IconEpConnection from "~icons/ep/connection"
import IconEpClock from "~icons/ep/clock"
import IconEpBox from "~icons/ep/box"
import IconEpCollection from "~icons/ep/collection"
import IconEpTickets from "~icons/ep/tickets"
import IconEpIphone from "~icons/ep/iphone"
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

const props = withDefaults(defineProps<{ doRoute?: boolean }>(), { doRoute: true })
const emit = defineEmits<{ (e: "select", path: string): void }>()

const version = process.env.MONA_VERSION
const webTitle = process.env.MONA_TITLE

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { currentAccountName } = useAccountStore()

// 计算放最前：它是玩家最常用的入口；设置和账号移到底部
const groups = computed(() => [
    { key: "home", items: [
        { path: "/intro", label: t("nav.home"), icon: IconEpHouse },
    ] },
    { key: "compute", title: t("nav.compute"), items: [
        { path: "/calculate", label: t("nav.calculate"), icon: IconEpDataAnalysis },
        { path: "/team-optimization", label: t("nav.teamOptimize"), icon: IconEpConnection },
        { path: "/calculation-history", label: "历史记录", icon: IconEpClock },
    ] },
    { key: "repo", title: t("nav.repo"), items: [
        { path: "/artifacts", label: t("nav.artifact"), icon: IconEpBox },
        { path: "/artifacts-kumi", label: t("nav.kumi"), icon: IconEpCollection },
        { path: "/presets", label: t("nav.preset"), icon: IconEpTickets },
        { path: "/uid-data", label: "UID 数据 / 手机互传", icon: IconEpIphone },
    ] },
    { key: "other", title: t("nav.other"), items: [
        { path: "/help/export-tools", label: t("nav.exportTool"), icon: IconEpDownload },
    ] },
])

function isActive(path: string) {
    // 首页另有别名 "/"
    return path === "/intro" ? route.name === "home" : route.path === path
}

function go(path: string) {
    if (props.doRoute) router.push(path)
    else emit("select", path)
}
</script>

<style lang="scss" scoped>
// 侧栏在浅色和深色模式下都是夜空色。颜色读 MainPage 定义的 --sh-* 变量。
.sb {
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    background: var(--sh-night);
    color: var(--sh-letter);
}

.sb-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    padding: 20px 18px 18px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
        outline: 2px solid var(--sh-gold);
        outline-offset: -4px;
        border-radius: 12px;
    }
}

.sb-portrait {
    flex: none;
    width: 40px;
    height: 40px;
    box-shadow: 0 0 0 1px var(--sh-gold-faint), 0 0 0 4px var(--sh-night), 0 0 0 5px var(--sh-gold-faint);
}

.sb-brand-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.sb-name {
    font-family: "Mona Brand", "KaiTi", "STKaiti", serif;
    font-size: 23px;
    line-height: 1.15;
    white-space: nowrap;
    color: var(--sh-gold);
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
    .sb-name {
        background: linear-gradient(110deg, var(--sh-sheen-1) 8%, var(--sh-sheen-2) 52%, var(--sh-sheen-3) 96%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }
}

.sb-version {
    font-size: 12px;
    color: var(--sh-dim);
    font-variant-numeric: tabular-nums;
    letter-spacing: .04em;
}

.sb-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 12px 16px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.sb-group + .sb-group {
    margin-top: 18px;
}

.sb-group-title {
    margin: 0 0 6px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--sh-quiet);
}

.sb-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 40px;
    margin: 2px 0;
    padding: 8px 12px;
    box-sizing: border-box;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--sh-dim);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background-color .15s ease, color .15s ease;

    &:hover {
        background: var(--sh-hover);
        color: var(--sh-letter);
    }

    &.active {
        background: var(--sh-raised);
        color: var(--sh-letter);
        font-weight: 600;

        .sb-icon {
            color: var(--sh-gold);
        }
    }

    &:focus-visible {
        outline: 2px solid var(--sh-gold);
        outline-offset: -2px;
    }
}

.sb-icon {
    flex: none;
    font-size: 18px;
}

.sb-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sb-foot {
    padding: 10px 12px 14px;
    background: var(--sh-foot);
}

.sb-avatar {
    flex: none;
    width: 24px;
    height: 24px;
    margin: -3px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--sh-raised);
}

@media (prefers-reduced-motion: reduce) {
    .sb-item {
        transition: none;
    }
}
</style>
