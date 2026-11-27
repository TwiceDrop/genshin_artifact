<template>
    <main class="login wl-palette">
        <star-field />
        <astrolabe-dial class="login-dial" />

        <section class="login-card cx-scope" aria-labelledby="login-title">
            <mona-portrait class="login-portrait" />
            <h1 id="login-title" class="login-name">{{ webTitle }}</h1>

            <!-- 还没有用户名的老账号登录后，先提示设置用户名，可以稍后在设置页再设 -->
            <form v-if="mode === 'naming'" class="login-form" @submit.prevent="saveUsername">
                <h2 class="login-step">设置用户名</h2>
                <el-input v-model="username" size="large" maxlength="16" placeholder="2–16 个字" aria-label="用户名" :disabled="busy" />
                <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
                <el-button class="login-submit" type="primary" size="large" round native-type="submit" :loading="busy"
                           :disabled="!username.trim()">保存</el-button>
                <el-button class="login-link login-center" link :disabled="busy" @click="leave">稍后设置</el-button>
            </form>

            <template v-else>
                <div v-if="mode === 'password' || mode === 'code'" class="login-tabs" role="tablist" aria-label="登录方式">
                    <button v-for="tab in tabs" :key="tab.mode" type="button" role="tab" class="login-tab"
                            :class="{ active: mode === tab.mode }" :aria-selected="mode === tab.mode" :disabled="busy"
                            @click="switchMode(tab.mode)">{{ tab.label }}</button>
                </div>
                <h2 v-else class="login-step">{{ mode === 'register' ? '注册账号' : '重设密码' }}</h2>

                <form class="login-form" @submit.prevent="submit">
                    <template v-if="mode === 'password'">
                        <el-input v-model="account" size="large" autocomplete="username" placeholder="邮箱或用户名"
                                  aria-label="邮箱或用户名" :disabled="busy" />
                        <el-input v-model="password" type="password" show-password size="large" autocomplete="current-password"
                                  placeholder="密码" aria-label="密码" :disabled="busy" />
                    </template>

                    <template v-else>
                        <el-input v-model="email" type="email" size="large" autocomplete="email" placeholder="邮箱" aria-label="邮箱"
                                  :disabled="busy" />
                        <div class="login-code">
                            <el-input v-model="code" size="large" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                                      placeholder="验证码" aria-label="邮箱验证码" :disabled="busy" />
                            <el-button size="large" round :disabled="busy || !email.trim() || cooldown > 0" @click="requestCode">
                                {{ cooldown ? `${cooldown} 秒后重发` : '发送验证码' }}
                            </el-button>
                        </div>
                        <el-input v-if="mode === 'register'" v-model="username" size="large" maxlength="16" autocomplete="username"
                                  placeholder="用户名（2–16 个字）" aria-label="用户名" :disabled="busy" />
                        <template v-if="mode === 'register' || mode === 'reset'">
                            <el-input v-model="password" type="password" show-password size="large" autocomplete="new-password"
                                      :placeholder="mode === 'reset' ? '新密码（8–64 个字符）' : '密码（8–64 个字符）'"
                                      :aria-label="mode === 'reset' ? '新密码' : '密码'" :disabled="busy" />
                            <el-input v-model="confirmPassword" type="password" show-password size="large" autocomplete="new-password"
                                      placeholder="再次输入密码" aria-label="再次输入密码" :disabled="busy" />
                        </template>
                    </template>

                    <el-alert v-if="notice" :title="notice" type="success" :closable="false" show-icon />
                    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
                    <el-button class="login-submit" type="primary" size="large" round native-type="submit" :loading="busy"
                               :disabled="!ready">{{ submitLabel }}</el-button>

                    <p v-if="mode !== 'reset'" class="login-terms">
                        登录或注册即表示同意<a :href="legal('terms')" target="_blank" rel="noopener">《用户协议》</a>和<a
                            :href="legal('privacy')" target="_blank" rel="noopener">《隐私政策》</a>
                    </p>

                    <div class="login-links">
                        <template v-if="mode === 'password' || mode === 'code'">
                            <el-button v-if="mode === 'password'" class="login-link" link :disabled="busy"
                                       @click="switchMode('reset')">忘记密码</el-button>
                            <el-button class="login-link" link :disabled="busy" @click="switchMode('register')">注册账号</el-button>
                        </template>
                        <el-button v-else class="login-link" link :disabled="busy" @click="switchMode('password')">
                            {{ mode === 'register' ? '已有账号，去登录' : '返回登录' }}
                        </el-button>
                    </div>
                </form>
            </template>
        </section>

        <button v-if="mode !== 'naming'" type="button" class="login-offline" :disabled="busy" @click="continueOffline">
            以离线模式继续<icon-ep-right aria-hidden="true" />
        </button>
    </main>
</template>

<script setup>
// 登录页（2026-11-17 与开发者约定，任务 06 补充密码登录和注册）：进入软件先到这里；
// 可用「邮箱或用户名 + 密码」或邮箱验证码登录，也可以注册、重设密码，或「以离线模式继续」（即游客，选择记在本机）。
// 验证码登录遇到未注册的邮箱时直接转到注册，沿用同一个验证码（服务端不会消耗它）。
// 服务地址和设备名称不在这里填写；服务端的错误原样显示，只在本机核对两次密码是否一致。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconEpRight from '~icons/ep/right'
import StarField from '@/pages/about/IntroPage/StarField.vue'
import AstrolabeDial from '@/pages/about/IntroPage/AstrolabeDial.vue'
import MonaPortrait from '@/components/misc/MonaPortrait.vue'
import { cloudApi } from '@/platform/cloud.mjs'
import { isNative } from '@/platform/native.mjs'
import { chooseOffline, clearOfflineChoice, isOfflineChosen } from '@/platform/login-gate.mjs'
import { contentShareReturnPath } from '@/components/share/content-share.mjs'

const webTitle = process.env.MONA_TITLE
const deviceName = isNative ? 'Android' : 'Windows'
const legal = name => `${process.env.BASE_URL}legal/${name}.html`
const tabs = [{ mode: 'password', label: '密码登录' }, { mode: 'code', label: '验证码登录' }]
const router = useRouter()
let returnToShare = isOfflineChosen()

// mode：password 密码登录 / code 验证码登录 / register 注册 / reset 重设密码 / naming 登录后设置用户名
const mode = ref('password')
const account = ref(''), password = ref(''), confirmPassword = ref('')
const email = ref(''), code = ref(''), challengeId = ref(''), username = ref('')
const busy = ref(false), error = ref(''), notice = ref('')
const resendAt = ref(0), now = ref(Date.now())
const cooldown = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)))
let timer
watch(email, () => { challengeId.value = ''; code.value = '' })

const codeReady = computed(() => !!challengeId.value && code.value.length === 6)
const ready = computed(() => ({
    password: !!account.value.trim() && !!password.value,
    code: codeReady.value,
    register: codeReady.value && !!username.value.trim() && !!password.value && !!confirmPassword.value,
    reset: codeReady.value && !!password.value && !!confirmPassword.value,
})[mode.value])
const submitLabel = computed(() => ({ password: '登录', code: '登录', register: '注册', reset: '重设密码' })[mode.value])

function switchMode(next) {
    mode.value = next
    error.value = ''; notice.value = ''; password.value = ''; confirmPassword.value = ''
}
function leave() {
    const path = returnToShare && contentShareReturnPath.value
    return router.replace(path || { name: 'home' })
}
async function run(action) {
    busy.value = true; error.value = ''; notice.value = ''
    try { await action() }
    catch (e) { error.value = e.message }
    finally { busy.value = false }
}
function signedIn(result) {
    clearOfflineChoice()
    if (result.user?.username) leave()
    else { username.value = ''; mode.value = 'naming' }
}
function requestCode() {
    return run(async () => {
        const result = await cloudApi('v1/auth/email/request', 'POST', { email: email.value.trim() })
        challengeId.value = result.challengeId
        now.value = Date.now(); resendAt.value = now.value + result.resendAfterSeconds * 1000
    })
}
function passwordsMatch() {
    if (password.value === confirmPassword.value) return true
    error.value = '两次输入的密码不一致'; notice.value = ''
    return false
}
function submit() {
    if (!ready.value) return
    if (mode.value === 'password') return run(async () => {
        signedIn(await cloudApi('v1/auth/password/login', 'POST', { account: account.value.trim(), password: password.value, deviceName }))
    })
    if (mode.value === 'code') return run(async () => {
        try {
            signedIn(await cloudApi('v1/auth/email/verify', 'POST', { challengeId: challengeId.value, code: code.value, deviceName }))
        } catch (e) {
            if (e.code !== 'ACCOUNT_NOT_FOUND') throw e
            // 未注册的邮箱：转到注册，邮箱、challengeId 和验证码原样带过去
            switchMode('register')
            notice.value = '该邮箱尚未注册，设置用户名和密码即可完成注册'
        }
    })
    if (!passwordsMatch()) return
    if (mode.value === 'register') return run(async () => {
        signedIn(await cloudApi('v1/auth/register', 'POST', {
            challengeId: challengeId.value, code: code.value, username: username.value.trim(), password: password.value, deviceName,
        }))
    })
    return run(async () => {
        await cloudApi('v1/auth/password/reset', 'POST', { challengeId: challengeId.value, code: code.value, newPassword: password.value })
        const resetEmail = email.value.trim()
        switchMode('password')
        account.value = resetEmail
        notice.value = '密码已重设，请用新密码登录'
    })
}
function saveUsername() {
    return run(async () => {
        await cloudApi('v1/me', 'PATCH', { username: username.value.trim() })
        leave()
    })
}
function continueOffline() {
    chooseOffline()
    returnToShare = true
    leave()
}

onMounted(async () => {
    timer = setInterval(() => { now.value = Date.now() }, 1000)
    // 已登录时（例如从账号页进来）直接离开；读取失败就把原因显示出来
    try { if ((await cloudApi('config')).user) leave() }
    catch (e) { error.value = e.message }
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style lang="scss" scoped>
// 登录页（夜空风格）：星空和星盘沿用欢迎页，颜色读 src/styles/welcome-palette.css 的 --wl-*；
// 卡片内控件挂 cx-scope，主按钮为金色。
.login {
    position: relative;
    isolation: isolate;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 18px;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 32px 16px;
    box-sizing: border-box;
    overflow: hidden;
    color: var(--wl-letter);
    background:
        radial-gradient(circle at 50% 38%, var(--wl-glow) 0, transparent 52%),
        var(--wl-ground);
}

.login-dial {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: -1;
    width: min(980px, 150vmin);
    transform: translate(-50%, -50%);
    opacity: .55;
    pointer-events: none;
}

.login-card {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 14px;
    width: min(400px, 100%);
    padding: 28px 26px 26px;
    box-sizing: border-box;
    border: 1px solid var(--wl-gold-faint);
    border-radius: 22px;
    background: color-mix(in srgb, var(--wl-ground) 80%, transparent);
    backdrop-filter: blur(10px);
}

.login-portrait {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--wl-gold-stroke);
}

.login-name {
    margin: 0 0 6px;
    font-family: "Mona Brand", serif;
    font-size: 44px;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: .06em;
    background: linear-gradient(100deg, var(--wl-sheen-1), var(--wl-sheen-2) 55%, var(--wl-sheen-3));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.login-form {
    display: grid;
    gap: 12px;
    width: 100%;
}

.login-code {
    display: flex;
    gap: 8px;

    .el-input {
        flex: 1;
        min-width: 0;
    }

    .el-button {
        flex: none;
        margin: 0;
    }
}

.login-step {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
}

.login-link {
    margin: 0;
    color: var(--wl-dim);

    &:hover:not(:disabled) {
        color: var(--wl-gold);
    }
}

.login-center {
    justify-self: center;
}

.login-links {
    display: flex;
    justify-content: center;
    gap: 18px;
}

// 密码登录 / 验证码登录切换
.login-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: 999px;
    background: var(--wl-chip);
}

.login-tab {
    padding: 8px 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--wl-dim);
    font: inherit;
    font-size: 14px;
    cursor: pointer;

    &.active {
        background: var(--wl-ground);
        color: var(--wl-gold);
        font-weight: 700;
    }

    &:disabled {
        cursor: default;
    }

    &:focus-visible {
        outline: 2px solid var(--wl-gold);
        outline-offset: 2px;
    }
}

.login-terms {
    margin: 0;
    color: var(--wl-dim);
    font-size: 12px;
    line-height: 1.6;
    text-align: center;

    a {
        color: var(--wl-gold);
        text-decoration: none;

        &:hover {
            text-decoration: underline;
        }
    }
}

.login-submit {
    width: 100%;
    margin-top: 4px;
    font-weight: 700;
}

.login-offline {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--wl-dim);
    font: inherit;
    font-size: 14px;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: var(--wl-chip);
        color: var(--wl-gold);
    }

    &:disabled {
        opacity: .5;
        cursor: default;
    }

    &:focus-visible {
        outline: 2px solid var(--wl-gold);
        outline-offset: 2px;
    }
}

@media (max-width: 420px) {
    .login-card {
        padding: 24px 18px 22px;
    }

    .login-name {
        font-size: 38px;
    }
}
</style>
