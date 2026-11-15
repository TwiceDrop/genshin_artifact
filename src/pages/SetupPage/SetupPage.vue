<template>
    <div class="setup-page cx-scope">
        <h2>设置</h2>

        <section class="setup-card">
            <h3 id="setup-appearance">{{ t('setupPage.appearance') }}</h3>
            <div class="mode-options" role="radiogroup" aria-labelledby="setup-appearance">
                <button v-for="mode in modes" :key="mode.value" type="button" role="radio" class="mode-option"
                        :aria-checked="colorMode === mode.value" @click="handleSetColorMode(mode.value)">
                    <span class="mode-preview" :class="mode.value" aria-hidden="true">
                        <span class="pv day"><i></i><span><b></b><b></b><em></em></span></span>
                        <span class="pv night"><i></i><span><b></b><b></b><em></em></span></span>
                    </span>
                    <span class="mode-label">{{ t(mode.label) }}</span>
                </button>
            </div>
        </section>

        <section class="setup-card setup-rows">
            <div class="setup-row">
                <label class="setup-row-label" for="setup-locale">{{ t("misc.lang") }}</label>
                <el-select id="setup-locale" class="setup-locale" :model-value="locale" @update:modelValue="handleSetLocale($event)">
                    <el-option label="简体中文" value="zh-cn"></el-option>
                    <el-option label="English" value="en"></el-option>
                </el-select>
            </div>

            <div v-if="usageStatsAvailable" class="setup-row">
                <div class="setup-row-label">
                    <span>{{ t('usageStats.title') }}</span>
                    <p>{{ t('usageStats.notice') }}</p>
                </div>
                <el-switch :model-value="usageStatsConsent === 'on'" :aria-label="t('usageStats.title')"
                    @update:model-value="setUsageStatsConsent($event ? 'on' : 'off')"></el-switch>
            </div>

            <div class="setup-row">
                <span class="setup-row-label">{{ t("setupPage.storage") }}</span>
                <el-popconfirm @confirm="handleClearLocalStorage" :title="t('setupPage.confirmClear')">
                    <template #reference>
                        <button type="button" class="setup-danger"><icon-ep-delete aria-hidden="true" />{{ t("setupPage.clear") }}</button>
                    </template>
                </el-popconfirm>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import localforage from "localforage"
import {colorMode,setColorMode} from "@/styles/color-mode.mjs"
import {useI18n} from "@/i18n/i18n"
import {usageStatsAvailable, usageStatsConsent, setUsageStatsConsent, refreshUsageStatsConsent, recordUsage} from "@/usage-stats/index.mjs"

// 外观选项：值与 color-mode.mjs 一致，文字沿用 setupPage 的 i18n
const modes = [
    { value: "light", label: "setupPage.light" },
    { value: "dark", label: "setupPage.dark" },
    { value: "auto", label: "setupPage.system" },
]

const { t, setLocale, locale } = useI18n()


function handleSetColorMode(mode: string) {
    setColorMode(mode)
    recordUsage('action.color-mode-change')
}

function handleClearLocalStorage() {
    localStorage.clear()
    localforage.clear()
    refreshUsageStatsConsent()
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
    recordUsage('action.locale-change')
}
</script>

<style scoped lang="scss">
// 设置页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-*
.setup-page {
    box-sizing: border-box;
    min-height: calc(100vh - 48px);
    padding: 16px clamp(10px, 1.3vw, 18px) 18px;
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);

    h2 {
        margin: 0 0 14px;
        font-size: 20px;
        font-weight: 700;
    }
}

.setup-card {
    max-width: 760px;
    margin-bottom: 12px;
    padding: 16px 18px;
    border-radius: 16px;
    background: var(--cx-card);

    h3 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 700;
    }
}

// 外观：三张带缩略图的选项卡
.mode-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.mode-option {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 8px 10px;
    border: 0;
    border-radius: 14px;
    background: var(--cx-step);
    color: var(--cx-dim);
    font: inherit;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
        color: var(--cx-letter);
    }

    &[aria-checked=true] {
        box-shadow: 0 0 0 2px var(--cx-gold);
        color: var(--cx-letter);
        font-weight: 700;
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 3px;
    }
}

.mode-label {
    text-align: center;
    font-size: 14px;
}

// 缩略图：侧栏 + 两条内容卡 + 金色小圆点。颜色固定为两种模式的样子，不随当前模式变化，
// 所以写成带默认值的 var()（构建时的配色插件不改写 var() 值）。
.mode-preview {
    position: relative;
    display: block;
    height: 76px;
    border-radius: 10px;
    overflow: hidden;
}

.pv {
    position: absolute;
    inset: 0;
    display: flex;
    gap: 8px;

    i {
        width: 20%;
    }

    > span {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 9px 9px 9px 0;
    }

    b {
        height: 16px;
        border-radius: 4px;
    }

    b + b {
        width: 70%;
    }

    em {
        width: 32%;
        height: 8px;
        margin-top: auto;
        border-radius: 999px;
    }

    &.day {
        background: var(--setup-day-ground, #eef0f6);

        i { background: var(--setup-day-side, #e4e0f2); }
        b { background: var(--setup-day-card, #ffffff); }
        em { background: var(--setup-day-gold, #8a6420); }
    }

    &.night {
        background: var(--setup-night-ground, #0f1428);

        i { background: var(--setup-night-side, #0a0e20); }
        b { background: var(--setup-night-card, #1b2343); }
        em { background: var(--setup-night-gold, #e2c078); }
    }
}

.mode-preview.light .night,
.mode-preview.dark .day {
    display: none;
}

// 跟随系统：左上浅色、右下深色
.mode-preview.auto .night {
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

// 其余设置：左边名称（可带说明），右边控件
.setup-rows {
    padding: 4px 18px;
}

.setup-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 56px;
    padding: 10px 0;

    & + & {
        box-shadow: 0 -1px 0 var(--cx-step-2);
    }
}

.setup-row-label {
    min-width: 0;
    font-size: 15px;
    font-weight: 600;

    p {
        max-width: 44rem;
        margin: 4px 0 0;
        color: var(--cx-dim);
        font-size: 12px;
        font-weight: 400;
        line-height: 1.6;
    }
}

.setup-locale {
    width: 180px;
}

.setup-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    height: 36px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-step);
    color: var(--cx-up);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

@media (max-width: 520px) {
    .mode-options {
        gap: 8px;
    }

    .mode-preview {
        height: 60px;
    }

    .setup-locale {
        width: 140px;
    }
}
</style>
