<template>
    <main class="login wl-palette">
        <star-field />
        <astrolabe-dial class="login-dial" />

        <section class="login-card cx-scope" aria-labelledby="login-title">
            <mona-portrait class="login-portrait" />
            <h1 id="login-title" class="login-name">{{ webTitle }}</h1>

            <!-- 第一次登录（还没有用户名）时，登录成功后先提示设置用户名，可以稍后在设置页再设 -->
            <form v-if="namingStep" class="login-form" @submit.prevent="saveUsername">
                <h2 class="login-step">设置用户名</h2>
                <el-input v-model="username" size="large" maxlength="16" placeholder="2–16 个字" aria-label="用户名" :disabled="busy" />
                <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
                <el-button class="login-submit" type="primary" size="large" round native-type="submit" :loading="busy"
                           :disabled="!username.trim()">保存</el-button>
                <el-button class="login-skip" link :disabled="busy" @click="leave">稍后设置</el-button>
            </form>

            <form v-else class="login-form" @submit.prevent="verifyCode">
                <el-input v-model="email" type="email" size="large" autocomplete="email" placeholder="邮箱" aria-label="邮箱"
                          :disabled="busy" />
                <div class="login-code">
                    <el-input v-model="code" size="large" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                              placeholder="验证码" aria-label="邮箱验证码" :disabled="busy" />
                    <el-button size="large" round :disabled="busy || !email.trim() || cooldown > 0" @click="requestCode">
                        {{ cooldown ? `${cooldown} 秒后重发` : '发送验证码' }}
                    </el-button>
                </div>
                <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
                <el-button class="login-submit" type="primary" size="large" round native-type="submit" :loading="busy"
                           :disabled="!challengeId || code.length !== 6">注册／登录</el-button>
            </form>
        </section>

        <button v-if="!namingStep" type="button" class="login-offline" :disabled="busy" @click="continueOffline">
            以离线模式继续<icon-ep-right aria-hidden="true" />
        </button>
    </main>
</template>

<script setup>
// 登录页（2026-11-17 与开发者约定）：进入软件先到这里；邮箱验证码登录，或「以离线模式继续」（即游客，选择记在本机）。
// 登录接口沿用在线服务的邮箱验证码流程，与在线账号页相同；服务地址和设备名称不在这里填写。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconEpRight from '~icons/ep/right'
import StarField from '@/pages/about/IntroPage/StarField.vue'
import AstrolabeDial from '@/pages/about/IntroPage/AstrolabeDial.vue'
import MonaPortrait from '@/components/misc/MonaPortrait.vue'
import { cloudApi } from '@/platform/cloud.mjs'
import { isNative } from '@/platform/native.mjs'
import { chooseOffline, clearOfflineChoice } from '@/platform/login-gate.mjs'

const webTitle = process.env.MONA_TITLE
const route = useRoute(), router = useRouter()
const email = ref(''), code = ref(''), challengeId = ref(''), busy = ref(false), error = ref('')
const namingStep = ref(false), username = ref('')
const resendAt = ref(0), now = ref(Date.now())
const cooldown = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)))
let timer
watch(email, () => { challengeId.value = ''; code.value = '' })

function leave() {
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    router.replace(redirect)
}
async function run(action) {
    busy.value = true; error.value = ''
    try { await action() }
    catch (e) { error.value = e.message }
    finally { busy.value = false }
}
function requestCode() {
    return run(async () => {
        const result = await cloudApi('v1/auth/email/request', 'POST', { email: email.value.trim() })
        challengeId.value = result.challengeId
        now.value = Date.now(); resendAt.value = now.value + result.resendAfterSeconds * 1000
    })
}
function verifyCode() {
    if (!challengeId.value || code.value.length !== 6) return
    return run(async () => {
        const result = await cloudApi('v1/auth/email/verify', 'POST', { challengeId: challengeId.value, code: code.value, deviceName: isNative ? 'Android' : 'Windows' })
        clearOfflineChoice()
        if (result.user?.username) leave()
        else namingStep.value = true
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

.login-skip {
    justify-self: center;
    color: var(--wl-dim);
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
