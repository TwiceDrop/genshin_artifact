<template>
    <div class="welcome wl-palette" :data-phase="phase" @click="showLaunch">
        <star-field />

        <astrolabe-dial class="welcome-dial" />
        <div class="welcome-hero">
            <div class="welcome-brand" :class="{ rising: playRise }" @animationend="playRise = false">
                <mona-portrait class="welcome-icon" />
                <h1 class="welcome-name">{{ webTitle }}</h1>
            </div>
        </div>
        <quick-launch-grid :visible="phase === 'ready'" />
        <footer class="welcome-footer">
            <nav class="welcome-links" aria-label="GitHub">
                <a v-for="link in githubLinks" :key="link.name" class="welcome-link"
                   :href="link.url" target="_blank" rel="noopener" @click.stop>
                    <icon-fa6-brands-github aria-hidden="true" />
                    <span>{{ link.name }}</span>
                </a>
            </nav>
            <span class="welcome-version">V{{ version }}</span>
            <div class="welcome-update" @click.stop>
                <el-button link @click="requestManualUpdateCheck">{{ t('intro.checkForUpdates') }}</el-button>
                <el-switch v-model="automaticUpdates" size="small" :active-text="t('intro.automaticUpdateCheck')"
                           @change="changeAutomaticUpdates" />
            </div>
        </footer>
    </div>
</template>

<script setup lang="ts">
import IconFa6BrandsGithub from "~icons/fa6-brands/github"
import AstrolabeDial from "./AstrolabeDial.vue"
import StarField from "./StarField.vue"
import QuickLaunchGrid from "./QuickLaunchGrid.vue"
import MonaPortrait from "@/components/misc/MonaPortrait.vue"

import {onActivated, onBeforeUnmount, onDeactivated, onMounted, ref} from "vue"
import {ElMessage} from "element-plus"
import {useI18n} from "@/i18n/i18n"
import {AUTOMATIC_UPDATE_CHANGED_EVENT, isAutomaticUpdateEnabled,
    requestManualUpdateCheck, setAutomaticUpdateEnabled} from "@/platform/release-update.mjs"

const version = process.env.MONA_VERSION
const webTitle = process.env.MONA_TITLE

const phase = ref<'splash' | 'ready'>(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'ready' : 'splash')
const playRise = ref(phase.value === 'splash')
let splashTimer: number | undefined

function clearSplash() {
    window.clearTimeout(splashTimer)
    window.removeEventListener('keydown', skipOnKey)
}
function showLaunch() {
    if (phase.value === 'ready') return
    phase.value = 'ready'
    clearSplash()
}
function skipOnKey(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    // 侧栏、链接和更新控件保留自己的键盘操作。
    if (event.target !== document.body && event.target !== document.documentElement) return
    event.preventDefault()
    showLaunch()
}
onMounted(() => {
    if (phase.value === 'splash') {
        window.addEventListener('keydown', skipOnKey)
        splashTimer = window.setTimeout(showLaunch, 950)
    }
})
onDeactivated(() => {
    playRise.value = false
    showLaunch()
})
onBeforeUnmount(clearSplash)

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
    --wl-gap: clamp(20px, 3vw, 40px);
    --wl-dial: clamp(560px, min(78cqi, 104vh), 1000px);
    --wl-splash-center: 41vh;
    --wl-dock-top: clamp(20px, 7vh, 84px);
    --wl-name-size: clamp(52px, 15cqi, 220px);
    --wl-portrait-size: calc(var(--wl-dial) * .2);
    --wl-brand-gap: calc(var(--wl-dial) * .05);
    --wl-hero-scale: .46;
    --wl-hero-dock-height: calc(var(--wl-dock-top) + (var(--wl-portrait-size) + var(--wl-brand-gap) + var(--wl-name-size)) * var(--wl-hero-scale) + 28px);
    --wl-ease: cubic-bezier(.22, 1, .36, 1);

    container-type: inline-size;
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    align-items: center;
    // 抵消 .main 的内边距，让欢迎页铺满工作区
    margin: -24px -24px;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 0 var(--wl-gap) var(--wl-gap);
    box-sizing: border-box;
    overflow: hidden;
    color: var(--wl-letter);
    background:
        radial-gradient(circle at 50% 30%, var(--wl-glow) 0, transparent 46%),
        var(--wl-art) center / cover no-repeat,
        var(--wl-ground);
}


.welcome-hero {
    position: absolute;
    inset: 0 0 auto;
    transform-origin: center top;
    transform: translateY(calc(var(--wl-splash-center) - var(--wl-portrait-size) / 2)) scale(1);
    transition: transform .72s var(--wl-ease);
    pointer-events: none;
}
.welcome[data-phase="ready"] .welcome-hero {
    transform: translateY(var(--wl-dock-top)) scale(var(--wl-hero-scale));
}
.welcome-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--wl-brand-gap);
}
.welcome-brand.rising {
    animation: wl-rise .72s var(--wl-ease) both;
}

.welcome-dial {
    position: absolute;
    left: 50%;
    top: var(--wl-splash-center);
    width: var(--wl-dial);
    height: var(--wl-dial);
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition: transform .72s var(--wl-ease), opacity .72s var(--wl-ease);
}
.welcome[data-phase="ready"] .welcome-dial {
    transform: translate(-50%, -60%);
    opacity: .42;
}

.welcome-icon {
    width: var(--wl-portrait-size);
    aspect-ratio: 1;
}

.welcome-name {
    margin: 0;
    font-family: "Mona Brand", "KaiTi", "STKaiti", serif;
    font-weight: 400;
    font-size: var(--wl-name-size);
    line-height: 1;
    letter-spacing: .04em;
    // 末字后的字距会让整体偏左，补回同样的量
    padding-left: .04em;
    white-space: nowrap;
    color: var(--wl-letter);
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
    .welcome-name {
        background: linear-gradient(110deg, var(--wl-sheen-1) 8%, var(--wl-sheen-2) 52%, var(--wl-sheen-3) 96%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }
}

.welcome-footer {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
    align-items: end;
    margin-top: 28px;
}

.welcome-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    grid-column: 1 / -1;
    grid-row: 1;
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
    grid-row: 2;
    font-size: 13px;
    color: var(--wl-dim);
}

.welcome-version {
    grid-column: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: .06em;
}

.welcome-update {
    grid-column: 2 / -1;
    justify-self: end;
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

@media (prefers-reduced-motion: reduce) {
    .welcome-dial,
    .welcome-hero,
    .welcome-brand {
        animation: none;
        transition: none;
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
        --wl-dial: clamp(560px, 68vh, 720px);
        --wl-hero-scale: .56;
        --wl-splash-center: 32vh;
        --wl-dock-top: clamp(16px, 5vh, 44px);
        margin: -14px -12px calc(-80px - env(safe-area-inset-bottom));
        // mobile.scss 给 .main-view 的子元素限了 max-width: 100%，负边距需要解开它
        max-width: none;
        min-height: calc(100vh - 48px);
        min-height: calc(100dvh - 48px);
        padding-bottom: calc(76px + env(safe-area-inset-bottom));
    }
    .welcome-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    .welcome-links {
        margin-bottom: 6px;
        gap: 8px;
    }
    .welcome-link { height: 40px; padding: 0 14px; }
    .welcome-update {
        flex-wrap: wrap;
        justify-content: center;
    }
}
</style>
