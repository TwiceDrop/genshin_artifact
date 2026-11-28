<template>
    <div class="oa-page cx-scope">
        <div class="oa-workspace" :class="{ 'oa-workspace--single': !user || !serviceUrl }">
            <header class="oa-page-head">
                <h2>账户管理与同步</h2>
                <PageGuideButton guide-id="detail-account-sync" />
            </header>
            <UiAlert v-if="loadError" tone="error" class="oa-load-error">{{ loadError }}</UiAlert>

            <div class="oa-workspace-grid">
                <div class="oa-stack">
                    <online-account-card v-if="user" />
                    <section v-else class="oa-panel oa-panel-head">
                        <h3 class="oa-panel-title"><i-ep-user aria-hidden="true" />未登录</h3>
                        <UiButton variant="primary" @click="router.push({ name: 'login' })">登录在线账号</UiButton>
                    </section>
                    <cookie-vault-panel v-if="user" :key="user.id" />
                </div>
                <div v-if="user && serviceUrl" class="oa-stack">
                    <cloud-profiles-panel :user="user" :service-url="serviceUrl" />
                    <my-axis-shares :key="serviceUrl + user.id" :service-url="serviceUrl" :user-id="user.id" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import UiAlert from "@/components/ui/UiAlert.vue"
import UiButton from "@/components/ui/UiButton.vue"
import {computed, onActivated, onMounted, ref} from "vue"
import {useRouter} from "vue-router"
import {cloudApi} from "@/platform/cloud.mjs"
import {onlineUser, loadOnlineUser} from "@/cloud/online-user.mjs"
import MyAxisShares from "./MyAxisShares.vue"
import OnlineAccountCard from "./OnlineAccountCard.vue"
import CloudProfilesPanel from "./CloudProfilesPanel.vue"
import CookieVaultPanel from "./CookieVaultPanel.vue"

const router = useRouter()
// 登录用户与侧栏共用；失败原因照实显示
const user = computed<any>(() => onlineUser.user)
const serviceUrl = ref(''), pageError = ref('')
const loadError = computed(() => pageError.value || onlineUser.error)

async function load() {
    try {
        serviceUrl.value = (await cloudApi('config')).url
        pageError.value = ''
        await loadOnlineUser()
    } catch (e: any) { pageError.value = e.message }
}
onMounted(load)
onActivated(load)
</script>

<style lang="scss">
.oa-page {
    min-height: calc(100vh - 48px);
    box-sizing: border-box;
    padding: 24px clamp(16px, 2vw, 24px);
    background: var(--cx-ground);
    color: var(--cx-letter);
    --oa-gap: 20px;
    --oa-pad: clamp(14px, 2vw, 22px);
    --oa-line: var(--cx-step-2);

    .oa-workspace {
        max-width: 80rem;
        margin-inline: auto;
    }

    .oa-workspace--single { max-width: 42rem; }

    .oa-page-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;

        h2 {
            margin: 0;
            font-size: clamp(22px, 2.1vw, 28px);
            font-weight: 700;
            line-height: 1.2;
        }
    }

    .oa-load-error { margin-bottom: var(--oa-gap); }

    .oa-workspace-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
        align-items: start;
        gap: var(--oa-gap);
        min-width: 0;
    }

    .oa-stack, .cookie-panel { display: contents; }

    .oa-panel {
        min-width: 0;
        border: 1px solid var(--oa-line);
        border-radius: 14px;
        padding: var(--oa-pad);
        background: var(--cx-card);
    }

    .oa-panel-head, .oa-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .oa-panel-head { justify-content: space-between; }
    .oa-panel-head:not(.oa-panel) { margin-bottom: 14px; }
    .oa-actions-end { justify-content: flex-end; }

    .oa-panel-title {
        display: flex;
        align-items: center;
        gap: 9px;
        margin: 0;
        font-size: 16px;
        line-height: 1.4;
        font-weight: 700;

        svg {
            flex: 0 0 17px;
            width: 17px;
            height: 17px;
            color: var(--cx-gold);
        }
    }

    .oa-list {
        border: 1px solid var(--oa-line);
        border-radius: 8px;
    }

    .oa-list-row {
        padding: 12px 14px;
    }

    .oa-list-row + .oa-list-row { border-top: 1px solid var(--oa-line); }

    .oa-list-summary {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    .oa-list-main {
        min-width: 0;
        flex: 1 1 8rem;
        overflow-wrap: anywhere;
    }

    .oa-meta {
        color: var(--cx-dim);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }


    .oa-quiet-danger[data-slot="button"] {
        color: var(--cx-up);
        background: transparent;

        &:hover:enabled { background: color-mix(in srgb, var(--cx-up) 9%, var(--cx-card)); }
    }
}

@media (max-width: 1279px) {
    .oa-page {
        .oa-account { order: 1; }
        .cloud-profiles { order: 2; }
        .shares { order: 3; }
        .cookie-alert, .oa-vault { order: 4; }
        .oa-devices { order: 5; }
    }
}

@media (min-width: 1280px) {
    .oa-page {
        --oa-gap: 24px;

        .oa-workspace:not(.oa-workspace--single) .oa-workspace-grid {
            grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
        }

        .oa-stack {
            display: flex;
            flex-direction: column;
            gap: var(--oa-gap);
            min-width: 0;
        }
    }
}

@media (prefers-reduced-motion: no-preference) {
    .oa-page [data-slot="button"] {
        transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
    }

    .oa-page [data-slot="button"]:active:enabled { transform: translateY(1px); }
}
</style>
