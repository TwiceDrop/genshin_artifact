<template>
<!--    <div class="root-div">-->
    <aside class="nav-bar mona-scroll-hidden" v-if="geSmall">
        <side-bar></side-bar>
    </aside>

    <el-drawer
        v-model="drawerVisible"
        direction="ltr"
        size="min(82%, 300px)"
        :with-header="false"
        class="sb-drawer"
        v-if="!geSmall"
    >
        <side-bar
            :do-route="false"
            @select="handleSelect"
        ></side-bar>
    </el-drawer>

    <div class="header" v-if="!geSmall">
        <div class="flex-row" style="height: 100%">
            <el-button
                aria-label="打开全部功能"
                :icon="IconEpMenu"
                @click="drawerVisible = true"
                class="header-menu"
                link
            ></el-button>
            <span class="header-title">{{ $route.meta.title }}</span>
            <small v-if="isNative" class="local-badge">本机离线版</small>
        </div>
    </div>

    <div class="main" :class="{ mobile: !geSmall, notMobile: geSmall, 'mona-scroll': $route.name !== 'calculate' }">
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

<style lang="scss">
// 外框（侧栏、手机顶栏、抽屉、底部导航）在浅色和深色模式下都用夜空色。变量名避开
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
}

.sb-drawer .el-drawer__body {
    padding: 0;
    background: var(--sh-night);
}
</style>

<style scoped lang="scss">
$contentPadding: 24px;
$side-bar-width: unquote("clamp(224px, 15vw, 256px)");
$header-height: 48px;
.local-badge{margin-left:auto;margin-right:16px;color:var(--sh-dim);font-size:11px}
.mobile-bottom-nav{position:fixed;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(4,1fr);background:var(--sh-night);padding-bottom:env(safe-area-inset-bottom);z-index:1900}
.mobile-bottom-nav button{display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;height:60px;border:0;background:transparent;color:var(--sh-quiet);font-size:12px;transition:color .15s ease}
.mobile-bottom-nav button svg{font-size:21px}.mobile-bottom-nav button.active{color:var(--sh-gold);font-weight:600}
.mobile-bottom-nav button:focus-visible{outline:2px solid var(--sh-gold);outline-offset:-4px}

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
