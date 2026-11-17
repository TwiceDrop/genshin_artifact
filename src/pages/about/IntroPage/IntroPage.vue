<template>
    <div class="welcome wl-palette">
        <star-field />

        <div class="welcome-emblem">
            <astrolabe-dial class="welcome-dial" />
            <mona-portrait class="welcome-icon" />
        </div>

        <div class="welcome-lockup">
            <h1 class="welcome-name">{{ webTitle }}</h1>

            <nav class="welcome-links" aria-label="GitHub">
                <a v-for="link in githubLinks" :key="link.name" class="welcome-link"
                   :href="link.url" target="_blank" rel="noopener">
                    <icon-fa6-brands-github aria-hidden="true" />
                    <span>{{ link.name }}</span>
                </a>
            </nav>
        </div>

        <span class="welcome-version">V{{ version }}</span>
        <div class="welcome-update">
            <el-button link @click="requestManualUpdateCheck">{{ t('intro.checkForUpdates') }}</el-button>
            <el-switch v-model="automaticUpdates" size="small" :active-text="t('intro.automaticUpdateCheck')"
                       @change="changeAutomaticUpdates" />
        </div>
    </div>
</template>

<script setup lang="ts">
import IconFa6BrandsGithub from "~icons/fa6-brands/github"
import AstrolabeDial from "./AstrolabeDial.vue"
import StarField from "./StarField.vue"
import MonaPortrait from "@/components/misc/MonaPortrait.vue"

import {onActivated, onBeforeUnmount, onMounted, ref} from "vue"
import {ElMessage} from "element-plus"
import {useI18n} from "@/i18n/i18n"
import {AUTOMATIC_UPDATE_CHANGED_EVENT, isAutomaticUpdateEnabled,
    requestManualUpdateCheck, setAutomaticUpdateEnabled} from "@/platform/release-update.mjs"

const version = process.env.MONA_VERSION
const webTitle = process.env.MONA_TITLE

// 底图接在 .welcome 的 --wl-art 上，开发者提供后替换。

const githubLinks = [
    { name: "TwiceDrop", url: "https://github.com/TwiceDrop" },
    { name: "SuperWoNiu12138", url: "https://github.com/SuperWoNiu12138" },
]

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
</script>

<style lang="scss" scoped>
// 颜色在 src/styles/welcome-palette.css 的 .wl-palette 上（登录页共用），这里只放布局变量。
.welcome {
    --wl-art: none;
    --wl-gap: 28px;
    --wl-dial: clamp(560px, min(78cqi, 104vh), 1000px);

    container-type: inline-size;
    position: relative;
    isolation: isolate;
    // 图标落在正中，星盘完整居中；店名和链接排在图标下方
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    justify-items: center;
    // 抵消 .main 的内边距，让欢迎页铺满工作区
    margin: -24px -24px 0;
    min-height: calc(100vh - 48px);
    padding: 56px var(--wl-gap) 104px;
    box-sizing: border-box;
    overflow: hidden;
    color: var(--wl-letter);
    background:
        radial-gradient(circle at 50% 30%, var(--wl-glow) 0, transparent 46%),
        var(--wl-art) center / cover no-repeat,
        var(--wl-ground);
}


.welcome-emblem {
    grid-row: 2;
    position: relative;
    display: grid;
    place-items: center;
    width: calc(var(--wl-dial) * .2);
    aspect-ratio: 1;
}

.welcome-lockup {
    grid-row: 3;
    align-self: start;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: calc(var(--wl-dial) * .07);
}

.welcome-dial {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: -1;
    width: var(--wl-dial);
    height: var(--wl-dial);
    transform: translate(-50%, -50%);
    pointer-events: none;
    animation: wl-dial-in 1.6s cubic-bezier(.2, .7, .2, 1) both;
}

.welcome-icon {
    width: 100%;
    height: 100%;
    animation: wl-rise .8s cubic-bezier(.2, .7, .2, 1) .2s both;
}

.welcome-name {
    margin: 0;
    font-family: "Mona Brand", "KaiTi", "STKaiti", serif;
    font-weight: 400;
    font-size: clamp(56px, 12vw, 220px);
    line-height: 1;
    letter-spacing: .04em;
    // 末字后的字距会让整体偏左，补回同样的量
    padding-left: .04em;
    white-space: nowrap;
    color: var(--wl-letter);
    animation: wl-rise .9s cubic-bezier(.2, .7, .2, 1) .32s both;
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
    .welcome-name {
        background: linear-gradient(110deg, var(--wl-sheen-1) 8%, var(--wl-sheen-2) 52%, var(--wl-sheen-3) 96%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }
}

@supports (font-size: 1cqi) {
    .welcome-name {
        font-size: clamp(56px, 15cqi, 220px);
    }
}

.welcome-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 44px;
    animation: wl-rise .9s cubic-bezier(.2, .7, .2, 1) .44s both;
}

.welcome-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 24px;
    border-radius: 999px;
    background: var(--wl-chip);
    color: var(--wl-letter);
    font-size: 16px;
    font-weight: 500;
    text-decoration: none;
    transition: background-color .2s ease, color .2s ease, transform .2s ease;

    svg {
        font-size: 18px;
        color: var(--wl-gold);
        transition: color .2s ease;
    }

    &:hover {
        background: var(--wl-chip-hover);
        color: var(--wl-chip-hover-on);

        svg {
            color: inherit;
        }
    }

    &:active {
        transform: scale(.97);
    }

    &:focus-visible {
        outline: 2px solid var(--wl-gold);
        outline-offset: 3px;
    }
}

.welcome-version,
.welcome-update {
    position: absolute;
    bottom: var(--wl-gap);
    font-size: 13px;
    color: var(--wl-dim);
}

.welcome-version {
    left: var(--wl-gap);
    font-variant-numeric: tabular-nums;
    letter-spacing: .06em;
}

.welcome-update {
    right: var(--wl-gap);
    display: flex;
    align-items: center;
    gap: 16px;

    :deep(.el-button.is-link) {
        --el-button-text-color: var(--wl-dim);
        --el-button-hover-link-text-color: var(--wl-letter);
        font-size: 13px;
    }

    :deep(.el-switch) {
        --el-switch-on-color: var(--wl-gold);
    }

    :deep(.el-switch__label) {
        color: var(--wl-dim);
    }

    :deep(.el-switch__label.is-active) {
        color: var(--wl-letter);
    }
}

@keyframes wl-rise {
    from {
        opacity: 0;
        transform: translateY(24px);
    }
}

@keyframes wl-dial-in {
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(.92) rotate(-12deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .welcome-dial,
    .welcome-icon,
    .welcome-name,
    .welcome-links {
        animation: none;
    }

    .welcome-link {
        transition: none;

        &:active {
            transform: none;
        }
    }
}

// 窄屏：.main 有顶栏和底部导航，内边距也更小
@media (max-width: 767px) {
    .welcome {
        --wl-gap: 16px;
        // 星盘随屏幕高度放大，高屏手机上不再挤在上半截
        --wl-dial: clamp(560px, 68vh, 720px);
        // 向下延伸到底部导航后面（.main 底部留了 80px，导航只有 60px，不延伸会露出一条外框底色）；
        // 底部内边距让版本号和更新开关仍停在导航上方
        margin: -14px -12px -80px;
        // mobile.scss 给 .main-view 的子元素限了 max-width: 100%，负边距需要解开它
        max-width: none;
        min-height: calc(100vh - 48px);
        // 上方留白略多于下方，星盘和店名整体稍往下，和底部的版本号更均衡
        grid-template-rows: 2fr auto auto 1fr auto auto;
        padding-top: 40px;
        padding-bottom: calc(24px + 80px);
    }

    .welcome-lockup {
        padding-bottom: 32px;
    }

    // 角落放不下，排在页面底部
    .welcome-version {
        grid-row: 5;
    }

    .welcome-update {
        grid-row: 6;
    }

    .welcome-links {
        margin-top: 32px;
    }

    // 角落放不下，改成页面底部依次排列
    .welcome-version,
    .welcome-update {
        position: static;
    }

    .welcome-update {
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 8px;
    }
}
</style>
