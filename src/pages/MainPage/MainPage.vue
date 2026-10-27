<template>
<!--    <div class="root-div">-->
    <aside class="nav-bar mona-scroll-hidden" v-if="geSmall">
        <side-bar></side-bar>
    </aside>

    <el-drawer
        :title="t('nav.nav')"
        v-model="drawerVisible"
        direction="ltr"
        size="80%"
        v-if="!geSmall"
    >
        <div style="height: 100%; overflow: auto">
            <side-bar
                :do-route="false"
                @select="handleSelect"
            ></side-bar>
        </div>
    </el-drawer>

    <div class="header" v-if="!geSmall">
        <div class="flex-row" style="height: 100%">
            <el-button
                aria-label="打开全部功能"
                :icon="IconEpMenu"
                @click="drawerVisible = true"
                style="color: white"
                link
            ></el-button>
            <span class="header-title">{{ $route.meta.title }}</span>
            <small v-if="isNative" class="local-badge">本机离线版</small>
        </div>
    </div>

    <div class="main mona-scroll" :class="{ mobile: !geSmall, notMobile: geSmall }">
        <div class="main-view">
            <router-view v-slot="{ Component }">
                <template v-if="Component">
                    <transition mode="out-in" name="el-fade-in-linear">
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

        <mona-footer style="margin-top: 24px"></mona-footer>
    </div>
    <nav v-if="!geSmall" class="mobile-bottom-nav" aria-label="手机主导航">
        <button :class="{ active: $route.path === '/calculate' }" @click="router.push('/calculate')"><i-ep-cpu /><span>计算</span></button>
        <button :class="{ active: $route.path === '/artifacts' }" @click="router.push('/artifacts')"><i-ep-help-filled /><span>圣遗物</span></button>
        <button :class="{ active: $route.path === '/uid-data' }" @click="router.push('/uid-data')"><i-ep-user /><span>UID 数据</span></button>
        <button @click="drawerVisible = true"><i-ep-menu /><span>全部功能</span></button>
    </nav>
<!--    </div>-->
</template>

<script setup lang="ts">
import SideBar from "./SideBar.vue"
import { default as MonaFooter } from "./Footer.vue"
import IconEpMenu from "~icons/ep/menu"
import {useRouter} from "vue-router"
import {useI18n} from "@/i18n/i18n"
import {useScreen} from "@/composables/screen"
import { isNative } from '@/platform/native.mjs'

const { geSmall } = useScreen()

const drawerVisible = ref(false)

const router = useRouter()

function handleSelect(index: string) {
    drawerVisible.value = false
    router.push(index)
}

const { t } = useI18n()
</script>

<style scoped lang="scss">
$contentPadding: 24px;
$side-bar-width: 15%;
$header-height: 48px;
.local-badge{margin-left:auto;margin-right:16px;color:#fff;font-size:11px;opacity:.85}
.mobile-bottom-nav{position:fixed;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-top:1px solid #e6eaf0;padding-bottom:env(safe-area-inset-bottom);z-index:1900;box-shadow:0 -3px 16px #26364d08}
.mobile-bottom-nav button{display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;height:60px;border:0;background:transparent;color:#778299;font-size:12px}
.mobile-bottom-nav button svg{font-size:21px}.mobile-bottom-nav button.active{color:#409eff;font-weight:600}

.nav-bar {
    width: $side-bar-width;
    height: 100vh;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
}

.header {
    height: $header-height;
    background-color: #409EFF;
    padding-left: 16px;
    box-sizing: border-box;
    position: fixed;
    top: 0;
    width: 100vw;
    z-index: 2000;

    .header-title {
        color: white;
        margin-left: 16px;
    }
}

.main {
    padding: $contentPadding;

    &.mobile {
        margin-top: 48px;
        padding: 14px 12px calc(80px + env(safe-area-inset-bottom));
        // The document scrolls on phones; a second overflow container offsets
        // sticky calculator tabs by another header height and covers controls.
        overflow: visible;
    }

    &.notMobile {
        margin-left: $side-bar-width;

        .main-view {
            min-height: calc(100vh - 2 * #{$contentPadding});
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
