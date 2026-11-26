<template>
    <div class="oa-page cx-scope">
        <h2>账户管理与同步 <PageGuideButton guide-id="detail-account-sync" /></h2>
        <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />

        <template v-if="user">
            <online-account-card />
            <my-axis-shares v-if="serviceUrl" :key="serviceUrl + user.id" :service-url="serviceUrl" :user-id="user.id" />
            <cloud-profiles-panel v-if="serviceUrl" :user="user" :service-url="serviceUrl" />
            <cookie-vault-panel :key="user.id" />
        </template>
        <section v-else class="oa-card">
            <div class="oa-line">
                <span class="oa-line-label">未登录</span>
                <button type="button" class="oa-plain" @click="router.push({ name: 'login', query: { redirect: '/online-account' } })">登录在线账号</button>
            </div>
        </section>

        <!-- 服务地址：目前只有这里能填（docs/specs/online-accounts/spec.md「下一步」第 2 条，由开发者决定最终做法） -->
        <section class="oa-card">
            <h3>在线服务</h3>
            <div class="oa-url">
                <el-input v-model="urlDraft" label="服务地址" placeholder="https://" :disabled="urlBusy" @keyup.enter="saveConfig" />
                <button type="button" class="oa-plain" :disabled="urlBusy || !urlDraft.trim() || urlDraft.trim() === serviceUrl" @click="saveConfig">保存服务地址</button>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
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
const serviceUrl = ref(''), urlDraft = ref(''), urlBusy = ref(false), pageError = ref('')
const loadError = computed(() => pageError.value || onlineUser.error)

async function load() {
    try {
        serviceUrl.value = urlDraft.value = (await cloudApi('config')).url
        pageError.value = ''
        await loadOnlineUser()
    } catch (e: any) { pageError.value = e.message }
}
async function saveConfig() {
    urlBusy.value = true; pageError.value = ''
    try {
        // 换服务地址后本机服务清掉旧会话；cloudApi 会广播登录状态变化，侧栏和本页跟着刷新
        serviceUrl.value = urlDraft.value = (await cloudApi('config', 'PUT', { url: urlDraft.value.trim() })).url
        await loadOnlineUser()
    } catch (e: any) { pageError.value = e.message } finally { urlBusy.value = false }
}
onMounted(load)
onActivated(load)
</script>

<style scoped lang="scss">
// 账户管理与同步页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-*。子面板各自带卡片样式，这里只管外框和未登录、服务地址两块。
.oa-page {
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

    :deep(.el-alert) {
        max-width: 760px;
        margin-bottom: 12px;
    }
}

.oa-card {
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

.oa-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.oa-line-label {
    font-size: 15px;
    font-weight: 600;
}

.oa-url {
    display: flex;
    align-items: center;
    gap: 10px;

    > :first-child {
        flex: 1;
        min-width: 0;
    }
}

.oa-plain {
    flex: none;
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font: inherit;
    font-size: 13px;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: var(--cx-step-2);
    }

    &:disabled {
        opacity: .5;
        cursor: default;
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

@media (max-width: 640px) {
    .oa-url {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
