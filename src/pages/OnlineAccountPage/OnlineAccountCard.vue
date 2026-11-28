<template>
    <section v-if="onlineUser" class="oa-panel oa-account" aria-labelledby="oa-account">
        <header class="oa-panel-head">
            <h3 id="oa-account" class="oa-panel-title">在线账号</h3>
            <UiButton :disabled="onlineBusy" @click="logout">退出登录</UiButton>
        </header>
        <div class="oa-identity">
            <UiAvatar :src="avatarUrl(onlineUser.avatar)" class="oa-avatar" aria-hidden="true">
                <i-ep-user />
            </UiAvatar>
            <div class="oa-identity-text">
                <strong v-if="onlineUser.username">{{ onlineUser.username }}</strong>
                <div class="oa-meta" :title="onlineUser.email">{{ onlineUser.email }}</div>
            </div>
            <UiButton ref="avatarTrigger" size="small" :disabled="onlineBusy" @click="avatarOpen = true">更换头像</UiButton>
        </div>
        <form class="oa-username-form" @submit.prevent="saveUsername">
            <label for="oa-username">用户名</label>
            <div class="oa-username-controls">
                <UiInput id="oa-username" v-model="usernameDraft" maxlength="16" placeholder="2–16 个字" :disabled="onlineBusy" />
                <UiButton type="submit" :disabled="onlineBusy || !usernameDraft.trim() || usernameDraft.trim() === (onlineUser.username || '')">保存</UiButton>
            </div>
        </form>
        <div class="oa-security">
            <div class="oa-line">
                <strong>修改邮箱</strong>
                <UiButton size="small" :disabled="onlineBusy" :aria-expanded="emailOpen" @click="emailOpen = !emailOpen">{{ emailOpen ? '收起' : '修改' }}</UiButton>
            </div>
            <form v-if="emailOpen" class="oa-form" @submit.prevent="changeEmail">
                <UiInput v-model="emailDraft" type="email" autocomplete="email" placeholder="新邮箱" aria-label="新邮箱" :disabled="onlineBusy" />
                <div class="oa-actions oa-actions-end">
                    <UiButton :disabled="onlineBusy || !emailDraft.trim() || emailCooldown > 0" @click="sendEmailCode">{{ emailCooldown ? emailCooldown + ' 秒后重发' : '发送验证码' }}</UiButton>
                </div>
                <UiInput v-model="emailCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="验证码" aria-label="验证码" :disabled="onlineBusy" />
                <div class="oa-actions oa-actions-end">
                    <UiButton type="submit" :disabled="onlineBusy || !emailChallenge || emailCode.length !== 6">确认修改</UiButton>
                </div>
            </form>
            <div class="oa-line">
                <strong>修改密码</strong>
                <UiButton size="small" :disabled="onlineBusy" :aria-expanded="passwordOpen" @click="passwordOpen = !passwordOpen">{{ passwordOpen ? '收起' : '修改' }}</UiButton>
            </div>
            <form v-if="passwordOpen" class="oa-form" @submit.prevent="changePassword">
                <UiPasswordInput v-model="currentPassword" autocomplete="current-password" placeholder="当前密码" aria-label="当前密码" :disabled="onlineBusy" />
                <UiPasswordInput v-model="newPassword" autocomplete="new-password" placeholder="新密码（8–64 位）" aria-label="新密码（8–64 位）" :disabled="onlineBusy" />
                <UiPasswordInput v-model="newPasswordConfirm" autocomplete="new-password" placeholder="再次输入新密码" aria-label="再次输入新密码" :disabled="onlineBusy" />
                <div class="oa-actions oa-actions-end">
                    <UiButton type="submit" :disabled="onlineBusy || !currentPassword || !newPassword || newPassword !== newPasswordConfirm">保存</UiButton>
                </div>
            </form>
        </div>
        <div class="oa-delete-row">
            <span class="oa-meta">永久删除在线账号、云端档案和云端 Cookie，本机数据保留</span>
            <UiButton ref="deletionTrigger" class="oa-quiet-danger" variant="danger" :disabled="onlineBusy" @click="deletionOpen = true">注销账号</UiButton>
        </div>
        <UiDialog v-model="avatarOpen" title="选择头像" width="var(--app-dialog-width, min(640px, 92vw))"
                  top="var(--app-dialog-top)" content-class="app-dialog" focus-container
                  :return-focus="() => avatarTrigger?.$el.focus({ preventScroll: true })">
            <div class="avatar-grid">
                <button v-for="choice in avatarList" :key="choice.key" type="button" class="avatar-choice"
                        :class="{ active: onlineUser.avatar === choice.key }" :title="ta(choice.nameLocale)" :aria-label="ta(choice.nameLocale)"
                        :disabled="onlineBusy" @click="saveAvatar(choice.key)">
                    <img :src="choice.url" alt="" loading="lazy" />
                </button>
            </div>
            <template #footer>
                <UiButton :disabled="onlineBusy || !onlineUser.avatar" @click="saveAvatar(null)">不使用头像</UiButton>
            </template>
        </UiDialog>
        <UiDialog v-model="deletionOpen" title="注销账号" width="min(420px, calc(100vw - 32px))"
                  :initial-focus="focusDeletionPassword"
                  :return-focus="() => deletionTrigger?.$el.focus({ preventScroll: true })">
            <form id="oa-delete-account" class="oa-delete-form" @submit.prevent="deleteAccount">
                <p>注销后在线账号、云端档案和云端 Cookie 会被永久删除，无法恢复；本机数据保留。请输入当前密码确认。</p>
                <UiInput id="oa-delete-password" :model-value="deletionPassword ?? ''" type="password"
                         placeholder="当前密码" aria-label="当前密码" @update:model-value="deletionPassword = $event" />
            </form>
            <template #footer>
                <div class="oa-delete-actions">
                    <UiButton @click="deletionOpen = false">取消</UiButton>
                    <UiButton type="submit" form="oa-delete-account" variant="danger">注销账号</UiButton>
                </div>
            </template>
        </UiDialog>
        <p v-if="onlineError" class="oa-error" role="alert">{{ onlineError }}</p>
    </section>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onDeactivated, onMounted, ref, watch} from "vue"
import UiAvatar from "@/components/ui/UiAvatar.vue"
import UiButton from "@/components/ui/UiButton.vue"
import UiDialog from "@/components/ui/UiDialog.vue"
import UiInput from "@/components/ui/UiInput.vue"
import UiPasswordInput from "@/components/ui/UiPasswordInput.vue"
import {showCalculationNotice} from "@/store/calculation-history"
import {useI18n} from "@/i18n/i18n"
import {cloudApi} from "@/platform/cloud.mjs"
import {onlineUser as onlineState, setOnlineUser, avatarUrl, avatarChoices} from "@/cloud/online-user.mjs"

const { ta } = useI18n()

// 登录用户与侧栏、页面共用（online-user.mjs）；失败原因照实显示
const onlineUser = computed<any>(() => onlineState.user), usernameDraft = ref(''), onlineBusy = ref(false), onlineError = ref('')
watch(onlineUser, user => { usernameDraft.value = user?.username || '' }, { immediate: true })
function showUser(user: any) { setOnlineUser(user) }
async function onlineRun(action: () => Promise<void>) {
    onlineBusy.value = true; onlineError.value = ''
    try { await action() } catch (e: any) { onlineError.value = e.message } finally { onlineBusy.value = false }
}
// 头像：从角色头像里选，存角色英文键名
const avatarOpen = ref(false), avatarList = avatarChoices()
const avatarTrigger = ref<InstanceType<typeof UiButton> | null>(null)
function saveAvatar(key: string | null) {
    return onlineRun(async () => {
        showUser((await cloudApi('v1/me', 'PATCH', { avatar: key })).user)
        avatarOpen.value = false
    })
}
// 修改邮箱：验证码发到新邮箱，核对后更换
const emailOpen = ref(false), emailDraft = ref(''), emailCode = ref(''), emailChallenge = ref(''), emailResendAt = ref(0), clock = ref(Date.now())
const emailCooldown = computed(() => Math.max(0, Math.ceil((emailResendAt.value - clock.value) / 1000)))
let clockTimer: number | undefined
watch(emailDraft, () => { emailChallenge.value = ''; emailCode.value = '' })
function sendEmailCode() {
    return onlineRun(async () => {
        const result = await cloudApi('v1/auth/email/request', 'POST', { email: emailDraft.value.trim() })
        emailChallenge.value = result.challengeId; clock.value = Date.now(); emailResendAt.value = clock.value + result.resendAfterSeconds * 1000
    })
}
function changeEmail() {
    return onlineRun(async () => {
        showUser((await cloudApi('v1/me/email', 'POST', { challengeId: emailChallenge.value, code: emailCode.value })).user)
        emailOpen.value = false; emailDraft.value = ''
        showCalculationNotice('success', '邮箱已更换')
    })
}
// 修改密码：成功后其他设备退出登录，本设备保持登录
const passwordOpen = ref(false), currentPassword = ref(''), newPassword = ref(''), newPasswordConfirm = ref('')
function changePassword() {
    return onlineRun(async () => {
        await cloudApi('v1/me/password', 'POST', { currentPassword: currentPassword.value, newPassword: newPassword.value })
        passwordOpen.value = false; currentPassword.value = newPassword.value = newPasswordConfirm.value = ''
        showCalculationNotice('success', '密码已修改，其他设备已退出登录')
    })
}
// 注销账号：输入当前密码确认；删除在线账号和云端数据，本机数据不动
const deletionOpen = ref(false), deletionPassword = ref<string | null>(null)
const deletionTrigger = ref<InstanceType<typeof UiButton> | null>(null)
watch(deletionOpen, open => {
    if (!open) deletionPassword.value = null
})
onDeactivated(() => { deletionOpen.value = false })
function focusDeletionPassword() {
    document.getElementById('oa-delete-password')?.focus({ preventScroll: true })
}
function deleteAccount() {
    const password = deletionPassword.value
    deletionOpen.value = false
    return onlineRun(async () => {
        await cloudApi('v1/me', 'DELETE', { password })
        showUser(null)
        showCalculationNotice('success', '在线账号已注销')
    })
}
function saveUsername() {
    return onlineRun(async () => {
        showUser((await cloudApi('v1/me', 'PATCH', { username: usernameDraft.value.trim() })).user)
        showCalculationNotice('success', '用户名已保存')
    })
}
function logout() {
    return onlineRun(async () => { await cloudApi('v1/auth/logout', 'POST'); showUser(null) })
}
onMounted(() => { clockTimer = window.setInterval(() => { clock.value = Date.now() }, 1000) })
onBeforeUnmount(() => window.clearInterval(clockTimer))
</script>

<style scoped lang="scss">
.oa-identity, .oa-username-controls, .oa-line, .oa-delete-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.oa-identity { gap: 12px; }
.oa-identity-text { flex: 1; min-width: 0; }
.oa-identity-text > strong, .oa-identity-text > .oa-meta {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.oa-identity-text > strong { font-size: 17px; }

.oa-avatar {
    display: grid;
    place-items: center;
    overflow: hidden;
    flex: 0 0 48px;
    height: 48px;
    border: 1px solid var(--oa-line);
    border-radius: 50%;
    background: var(--cx-step);
    color: var(--cx-dim);

    svg { width: 22px; height: 22px; }
}

.oa-username-form {
    display: grid;
    gap: 6px;
    margin-top: 16px;
    font-size: 13px;
}
.oa-username-controls > input { flex: 1; min-width: 0; }

.oa-security, .oa-delete-row {
    margin-top: 12px;
    border-top: 1px solid var(--oa-line);
    padding-top: 8px;
}

.oa-line, .oa-delete-row { justify-content: space-between; }
.oa-line { padding: 5px 0; font-size: 13px; }
.oa-delete-row { padding-top: 12px; }
.oa-delete-row > .oa-meta { flex: 1 1 8rem; }

.oa-form {
    display: grid;
    gap: 8px;
    margin: 5px 0 8px;
}

.oa-error {
    margin: 10px 0 0;
    color: var(--cx-up);
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
}

.avatar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 10px;
    max-height: 60vh;
    overflow-y: auto;
}

.avatar-choice {
    aspect-ratio: 1;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--cx-step);
    cursor: pointer;
    overflow: hidden;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &.active {
        border-color: var(--cx-gold);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.oa-delete-form {
    display: grid;
    gap: 15px;
    font-size: 14px;

    p {
        margin: 0;
    }

    input {
        min-height: 32px;
    }
}

.oa-delete-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

</style>
