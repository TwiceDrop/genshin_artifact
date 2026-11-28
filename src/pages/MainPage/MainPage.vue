<template>
<!--    <div class="root-div">-->
    <aside v-if="geSmall && !bare" class="nav-bar">
        <side-bar collapsible />
    </aside>
    <SidebarSheet v-if="!geSmall && !bare" v-model:open="drawerVisible" :label="t('nav.nav')">
        <side-bar :do-route="false" @select="handleSelect" @close="drawerVisible = false" />
    </SidebarSheet>

    <div class="header" v-if="!geSmall && !bare">
        <div class="flex-row" style="height: 100%">
            <button type="button" class="header-menu" data-tour="nav.mobile-menu" aria-label="打开全部功能" aria-haspopup="dialog"
                    :aria-expanded="drawerVisible" @click="drawerVisible = true">
                <IconEpMenu aria-hidden="true" />
            </button>
            <span class="header-title">{{ $route.meta.title }}</span>
            <small v-if="isNative" class="local-badge">本机离线版</small>
        </div>
    </div>

    <div class="main" :class="{ mobile: !geSmall && !bare, notMobile: geSmall && !bare, bare, 'mona-scroll': $route.name !== 'calculate' }">
        <div class="main-view">
            <router-view v-slot="{ Component }">
                <template v-if="Component">
                    <!-- 旧页面直接移除、新页面淡入：out-in 会先等旧页面淡出，中间有一段内容区全空，看起来像抖了一下 -->
                    <transition name="page-swap">
                        <keep-alive>
                            <component :is="Component"></component>
                        </keep-alive>
<!--                        <keep-alive>-->
<!--                            <suspense>-->
<!--                                <component :is="Component"></component>-->

<!--                                <template #fallback>-->
<!--                                    <div class="loading-container">-->
<!--                                        <simple-loading></simple-loading>-->
<!--                                    </div>-->

<!--                                </template>-->
<!--                            </suspense>-->
<!--                        </keep-alive>-->
                    </transition>
                </template>
            </router-view>
        </div>


<!--            <keep-alive>-->
<!--                <router-view v-if="$route.meta.keepAlive" class="router-view"></router-view>-->
<!--            </keep-alive>-->
<!--            <router-view v-if="!$route.meta.keepAlive" class="router-view"></router-view>-->
<!--            <router-view class="router-view"></router-view>-->

        <mona-footer v-if="$route.name !== 'home' && !bare" class="main-footer" />
    </div>
    <nav v-if="!geSmall && !bare" class="mobile-bottom-nav" data-tour="nav.mobile-bottom" aria-label="手机主导航">
        <button :class="{ active: $route.path === '/calculate' }" @click="router.push('/calculate')"><i-ep-cpu /><span>计算</span></button>
        <button :class="{ active: $route.path === '/artifacts' }" @click="router.push('/artifacts')"><i-ep-help-filled /><span>圣遗物</span></button>
        <button :class="{ active: $route.path === '/uid-data' }" @click="router.push('/uid-data')"><i-ep-user /><span>{{ t("misc.character") }}</span></button>
        <button aria-haspopup="dialog" :aria-expanded="drawerVisible" @click="drawerVisible = true"><i-ep-menu /><span>全部功能</span></button>
    </nav>
<!--    </div>-->
</template>

<script setup lang="ts">
import SideBar from "./SideBar.vue"
import SidebarSheet from "@/components/ui/sidebar/SidebarSheet.vue"
import {onMounted, watch} from "vue"
import {loadOnlineUser} from "@/cloud/online-user.mjs"
import { default as MonaFooter } from "./Footer.vue"
import IconEpMenu from "~icons/ep/menu"
import {useRoute, useRouter} from "vue-router"
import {useI18n} from "@/i18n/i18n"
import {useScreen} from "@/composables/screen"
import { isNative } from '@/platform/native.mjs'

const { geSmall } = useScreen()
onMounted(() => { loadOnlineUser().catch(() => {}) })

const drawerVisible = ref(false)

const router = useRouter()
// 登录页等整屏页面（路由 meta.bare）不显示外框
const route = useRoute()
const bare = computed(() => !!route.meta.bare)

watch([geSmall, () => route.fullPath], () => { drawerVisible.value = false })

function handleSelect(index: string) {
    drawerVisible.value = false
    router.push(index)
}

const { t } = useI18n()
</script>

<style lang="scss">
// 切页过渡：只有新页面淡入，离开的页面立即隐藏（没有过渡时间，Vue 当帧移除）
.page-swap-enter-active {
    transition: opacity .15s ease-out;
}

.page-swap-enter-from {
    opacity: 0;
}

.page-swap-leave-active {
    display: none;
}

@media (prefers-reduced-motion: reduce) {
    .page-swap-enter-active {
        transition: none;
    }
}

// 外框（侧栏、手机顶栏、抽屉、底部导航）和计算器角色卡：深色模式用夜空色，浅色模式用淡紫灰
// （2026-11-15 开发者觉得浅色模式下夜空色对比太强）。变量名避开
// script/postcss-mona-colors.cjs 识别的角色词，否则深色模式下会被它再映射一次。
:root {
    --sh-night: #0b1124;
    --sh-foot: #0e1530;
    --sh-hover: #141c3a;
    --sh-raised: #1d2750;
    --sh-letter: #eeeaf6;
    --sh-dim: #a3abc6;
    --sh-quiet: #6c7596;
    --sh-gold: #e2c078;
    --sh-gold-faint: rgba(226, 192, 120, .35);
    --sh-sheen-1: #fbeecb;
    --sh-sheen-2: #e6bd6a;
    --sh-sheen-3: #b996ee;
    --sh-glow: #1d2750;
}

html[data-color-mode="light"] {
    --sh-night: #f4f2fa;
    --sh-foot: #ebe8f5;
    --sh-hover: #e6e2f3;
    --sh-raised: #ddd8ef;
    --sh-letter: #1b1838;
    --sh-dim: #5c5878;
    --sh-quiet: #8a86a3;
    --sh-gold: #9a6f22;
    --sh-gold-faint: rgba(154, 111, 34, .35);
    --sh-sheen-1: #3a2f7a;
    --sh-sheen-2: #7a4fb0;
    --sh-sheen-3: #a8782a;
    --sh-glow: #ffffff;
}

</style>

<style scoped lang="scss">
$contentPadding: 24px;
$side-bar-width: var(--sidebar-rail-width);
$header-height: 48px;
.local-badge{margin-left:auto;margin-right:16px;color:var(--sh-dim);font-size:11px}
.mobile-bottom-nav{position:fixed;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(4,1fr);background:var(--sh-night);padding-bottom:env(safe-area-inset-bottom);z-index:1900}
.mobile-bottom-nav button{display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;height:60px;border:0;background:transparent;color:var(--sh-quiet);font-size:12px;transition:color .15s ease}
.mobile-bottom-nav button svg{font-size:21px}.mobile-bottom-nav button.active{color:var(--sh-gold);font-weight:600}
.mobile-bottom-nav button:focus-visible{outline:2px solid var(--sh-gold);outline-offset:-4px}

.nav-bar {
    width: $side-bar-width;
    height: 100vh;
    height: 100dvh;
    z-index: 1800;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
}

.header {
    height: $header-height;
    display: flex;
    align-items: center;
    background-color: var(--sh-night);
    padding-left: 12px;
    box-sizing: border-box;
    position: fixed;
    top: 0;
    width: 100vw;
    z-index: 2000;

    .header-menu {
        display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; background: transparent; cursor: pointer;
        color: var(--sh-letter);
        font-size: 20px;
    }

    .header-title {
        color: var(--sh-letter);
        margin-left: 12px;
        font-size: 16px;
        font-weight: 600;
    }
}

.main {
    padding: $contentPadding;

    .main-footer {
        margin-block-start: 6px;
    }

    &.bare {
        padding: 0;
    }

    &.mobile {
        margin-top: 48px;
        padding: 14px 12px calc(80px + env(safe-area-inset-bottom));
        // The document scrolls on phones; a second overflow container offsets
        // sticky calculator tabs by another header height and covers controls.
        overflow: visible;
    }

    &.notMobile {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        min-height: 100vh;
        min-height: 100dvh;
        margin-left: $side-bar-width;

        .main-view {
            flex: 1;
        }

        &:has(> .main-footer) {
            padding-bottom: 4px;
        }
    }
}

//@media only screen and (min-width: 992px) {
//    //.root-div {
//    //    display: flex;
//    //    align-items: flex-start;
//    //    //justify-content: flex-start;
//    //}
//    .main-view {
//        min-height: calc(100vh - 2 * #{$contentPadding});
//    }
//
//    .header {
//        display: none;
//    }
//
//    .nav-bar {
//        width: $side-bar-width;
//        height: 100vh;
//        position: fixed;
//        top: 0;
//        bottom: 0;
//        left: 0;
//    }
//
//    .main {
//        //flex: 1;
//        height: 100vh;
//        margin-left: $side-bar-width;
//        //min-height: 100vh;
//        padding: $contentPadding;
//        box-sizing: border-box;
//    }
//
//    .loading-container {
//        height: 100%;
//        display: flex;
//        align-items: center;
//        justify-content: center;
//    }
//
//    //.router-view {
//    //    min-height: 100%;
//    //    //padding: $contentPadding;
//    //    box-sizing: border-box;
//    //}
//}
//
//@media only screen and (max-width: 992px) {
//    .header {
//        height: $header-height;
//        background-color: #409EFF;
//        padding-left: 16px;
//        position: fixed;
//        top: 0;
//        width: 100vw;
//        z-index: 2000;
//
//        .header-title {
//            color: white;
//            margin-left: 16px;
//        }
//    }
//
//    .main {
//        margin-top: 48px;
//        padding: $contentPadding;
//    }
//
//    .main-view {
//        min-height: calc(100vh - #{$header-height} - 2 * #{$contentPadding});
//    }
//
//    .nav-bar {
//        display: none;
//    }
//
//    .router-view {
//        min-height: calc(100% - 48px);
//        padding: $contentPadding;
//        box-sizing: border-box;
//        overflow-x: hidden;
//    }
//}

</style>
