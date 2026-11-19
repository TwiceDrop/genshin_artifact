<template>
    <!-- 在线账号：邮箱、用户名、头像、改邮箱、改密码、注销账号、退出登录。只在已登录时由账户管理与同步页显示 -->
    <section v-if="onlineUser" class="oa-card" aria-labelledby="oa-account">
        <div class="oa-head">
            <h3 id="oa-account">在线账号</h3>
            <button type="button" class="oa-plain" :disabled="onlineBusy" @click="logout">退出登录</button>
        </div>
        <div class="oa-line">
            <span class="oa-line-label">邮箱</span>
            <span class="oa-value">{{ onlineUser.email }}</span>
        </div>
        <form class="oa-line" @submit.prevent="saveUsername">
            <label class="oa-line-label" for="oa-username">用户名</label>
            <span class="oa-edit">
                <el-input id="oa-username" v-model="usernameDraft" class="oa-username" maxlength="16"
                          placeholder="2–16 个字" :disabled="onlineBusy" />
                <button type="submit" class="oa-plain"
                        :disabled="onlineBusy || !usernameDraft.trim() || usernameDraft.trim() === (onlineUser.username || '')">保存</button>
            </span>
        </form>
        <div class="oa-line">
            <span class="oa-line-label">头像</span>
            <span class="oa-edit">
                <img v-if="avatarUrl(onlineUser.avatar)" :src="avatarUrl(onlineUser.avatar)" alt="" class="oa-avatar" />
                <button type="button" class="oa-plain" :disabled="onlineBusy" @click="avatarOpen = true">更换头像</button>
            </span>
        </div>
        <div class="oa-line">
            <span class="oa-line-label">修改邮箱</span>
            <button type="button" class="oa-plain" :disabled="onlineBusy" @click="emailOpen = !emailOpen">{{ emailOpen ? '收起' : '修改' }}</button>
        </div>
        <form v-if="emailOpen" class="oa-form" @submit.prevent="changeEmail">
            <el-input v-model="emailDraft" type="email" autocomplete="email" placeholder="新邮箱" aria-label="新邮箱" :disabled="onlineBusy" />
            <button type="button" class="oa-plain" :disabled="onlineBusy || !emailDraft.trim() || emailCooldown > 0" @click="sendEmailCode">
                {{ emailCooldown ? `${emailCooldown} 秒后重发` : '发送验证码' }}</button>
            <el-input v-model="emailCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="验证码" aria-label="验证码" :disabled="onlineBusy" />
            <button type="submit" class="oa-plain" :disabled="onlineBusy || !emailChallenge || emailCode.length !== 6">确认修改</button>
        </form>
        <div class="oa-line">
            <span class="oa-line-label">修改密码</span>
            <button type="button" class="oa-plain" :disabled="onlineBusy" @click="passwordOpen = !passwordOpen">{{ passwordOpen ? '收起' : '修改' }}</button>
        </div>
        <form v-if="passwordOpen" class="oa-form" @submit.prevent="changePassword">
            <el-input v-model="currentPassword" type="password" show-password autocomplete="current-password" placeholder="当前密码" aria-label="当前密码" :disabled="onlineBusy" />
            <el-input v-model="newPassword" type="password" show-password autocomplete="new-password" placeholder="新密码（8–64 位）" aria-label="新密码" :disabled="onlineBusy" />
            <el-input v-model="newPasswordConfirm" type="password" show-password autocomplete="new-password" placeholder="再次输入新密码" aria-label="再次输入新密码" :disabled="onlineBusy" />
            <button type="submit" class="oa-plain" :disabled="onlineBusy || !currentPassword || !newPassword || newPassword !== newPasswordConfirm">保存</button>
        </form>
        <div class="oa-line">
            <span class="oa-line-label">注销账号<p>永久删除在线账号、云端档案和云端 Cookie，本机数据保留</p></span>
            <button type="button" class="oa-danger" :disabled="onlineBusy" @click="deleteAccount">注销账号</button>
        </div>
        <el-dialog v-model="avatarOpen" title="选择头像" width="min(640px, 92vw)" append-to-body>
            <div class="avatar-grid">
                <button v-for="choice in avatarList" :key="choice.key" type="button" class="avatar-choice"
                        :class="{ active: onlineUser.avatar === choice.key }" :title="ta(choice.nameLocale)" :aria-label="ta(choice.nameLocale)"
                        :disabled="onlineBusy" @click="saveAvatar(choice.key)">
                    <img :src="choice.url" alt="" loading="lazy" />
                </button>
            </div>
            <template #footer>
                <button type="button" class="oa-plain" :disabled="onlineBusy || !onlineUser.avatar" @click="saveAvatar(null)">不使用头像</button>
            </template>
        </el-dialog>
        <p v-if="onlineError" class="oa-error" role="alert">{{ onlineError }}</p>
    </section>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue"
import {ElMessage, ElMessageBox} from "element-plus"
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
        ElMessage.success('邮箱已更换')
    })
}
// 修改密码：成功后其他设备退出登录，本设备保持登录
const passwordOpen = ref(false), currentPassword = ref(''), newPassword = ref(''), newPasswordConfirm = ref('')
function changePassword() {
    return onlineRun(async () => {
        await cloudApi('v1/me/password', 'POST', { currentPassword: currentPassword.value, newPassword: newPassword.value })
        passwordOpen.value = false; currentPassword.value = newPassword.value = newPasswordConfirm.value = ''
        ElMessage.success('密码已修改，其他设备已退出登录')
    })
}
// 注销账号：输入当前密码确认；删除在线账号和云端数据，本机数据不动
async function deleteAccount() {
    let password: string
    try {
        ({ value: password } = await ElMessageBox.prompt('注销后在线账号、云端档案和云端 Cookie 会被永久删除，无法恢复；本机数据保留。请输入当前密码确认。', '注销账号',
            { inputType: 'password', inputPlaceholder: '当前密码', confirmButtonText: '注销账号', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }) as any)
    } catch { return }
    return onlineRun(async () => {
        await cloudApi('v1/me', 'DELETE', { password })
        showUser(null)
        ElMessage.success('在线账号已注销')
    })
}
function saveUsername() {
    return onlineRun(async () => {
        showUser((await cloudApi('v1/me', 'PATCH', { username: usernameDraft.value.trim() })).user)
        ElMessage.success('用户名已保存')
    })
}
function logout() {
    return onlineRun(async () => { await cloudApi('v1/auth/logout', 'POST'); showUser(null) })
}
onMounted(() => { clockTimer = window.setInterval(() => { clock.value = Date.now() }, 1000) })
onBeforeUnmount(() => window.clearInterval(clockTimer))
</script>

<style scoped lang="scss">
// 夜空风格卡片：颜色读外层 .cx-scope 的 --cx-*
.oa-card {
    max-width: 760px;
    margin-bottom: 12px;
    padding: 16px 18px 6px;
    border-radius: 16px;
    background: var(--cx-card);
    color: var(--cx-letter);
}

.oa-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
    }
}

.oa-line {
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

.oa-line-label {
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

.oa-value {
    min-width: 0;
    overflow: hidden;
    color: var(--cx-dim);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.oa-edit {
    display: flex;
    align-items: center;
    gap: 8px;
}

.oa-username {
    width: 180px;
}

.oa-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--cx-step);
}

// 改邮箱、改密码的展开表单：宽屏两列，手机一列
.oa-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    padding: 0 0 14px;
}

.oa-error {
    margin: 0 0 10px;
    color: var(--cx-up);
    font-size: 13px;
    line-height: 1.6;
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

// 普通胶囊按钮
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

.oa-danger {
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
    .oa-form {
        grid-template-columns: 1fr;
    }
}
</style>
