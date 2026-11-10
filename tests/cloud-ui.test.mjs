import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { JSDOM } = require('../mobile/node_modules/jsdom')
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')

test('online account component completes email login, explicit Cookie upload and snapshot import without touching local profiles', async () => {
    const dom = new JSDOM('<html><body><div id="app"></div></body></html>', { url: 'http://127.0.0.1/online-account', pretendToBeVisual: true })
    for (const key of ['window', 'document', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle', 'Event', 'MouseEvent']) globalThis[key] = typeof dom.window[key] === 'function' && key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key]
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
    globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
    const Vue = require('vue'), ElementPlus = require('element-plus')
    const profile = { currentAccountId: Vue.ref(7), currentAccountName: Vue.ref('合成配置') }, calls = [], imports = []
    const user = { id: 'user-a', email: 'synthetic@example.test' }
    const account = { id: 'cloud-a', accountUid: '123456', platform: 'miyoushe', roles: [{ uid: '111111111', nickname: '合成角色', region: 'cn_gf01' }], status: 'ready', syncEnabled: true, intervalMinutes: 360, activeJobId: null }
    const snapshot = { version: 1, source: 'miyoushe', role: account.roles[0], characters: [{ base: { id: 10000021 } }] }
    let loggedIn = false, hosted = false
    async function cloudApi(path, method = 'GET', body) {
        calls.push({ path, method, body })
        if (path === 'config') return { url: 'https://fixture.example.test', user: null }
        if (path === 'v1/auth/email/request') return { challengeId: 'email-1', resendAfterSeconds: 60 }
        if (path === 'v1/auth/email/verify') { loggedIn = true; return { user } }
        if (path === 'v1/game-accounts') return { accounts: hosted ? [{ ...account }] : [] }
        if (path === 'v1/sessions') return { sessions: [{ id: 'session-a', deviceName: '合成设备', current: true, lastUsedAt: '2026-11-07T00:00:00Z' }] }
        if (path === 'local-accounts') return { accounts: [{ ...account, id: '123456' }] }
        if (path === 'game-accounts/import-local') { hosted = true; return { account } }
        if (path === 'v1/game-accounts/cloud-a/sync') { account.activeJobId = 'job-a'; return { jobId: 'job-a', status: 'queued' } }
        if (path === 'v1/jobs/job-a') return { job: { id: 'job-a', status: 'running' } }
        if (path === 'v1/game-accounts/cloud-a/snapshots') return { snapshots: [{ uid: '111111111', region: 'cn_gf01', updatedAt: '2026-11-07T00:00:00Z', snapshot }] }
        if (path === 'v1/sessions/session-a' && method === 'DELETE') { loggedIn = false; return { ok: true } }
        throw new Error(`Unexpected API ${method} ${path}`)
    }
    const filename = 'src/pages/OnlineAccountPage/OnlineAccountPage.vue'
    const { descriptor } = parse(fs.readFileSync(new URL('../' + filename, import.meta.url), 'utf8'), { filename })
    const script = compileScript(descriptor, { id: 'online-component' })
    const template = compileTemplate({ source: descriptor.template.content, filename, id: 'online-component', compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
    const scriptCode = script.content.replace(/^import .*\r?\n/gm, '').replace('export default', 'const component =')
    const renderCode = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names) => `const {${names.replace(/\s+as\s+/g, ':')}} = Vue`).replace('export function render', 'function render')
    const component = new Function('Vue', 'cloudApi', 'isNative', 'useAccountStore', 'saveGameSnapshot', `const {ref,computed,onMounted,onBeforeUnmount,watch}=Vue;const CloudProfilesPanel={render:()=>null};\n${scriptCode}\n${renderCode}\ncomponent.render=render; return component`)(Vue, cloudApi, false, () => profile, async (value, id, source, check) => { check(); imports.push({ value, id, source }); return { imported: 1, added: 2, rejected: 0, warnings: [] } })
    const app = Vue.createApp(component).use(ElementPlus)
    const settle = async () => { for (let i = 0; i < 5; i++) { await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick() } }
    const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label)
    const click = async label => { const item = button(label); assert.ok(item, `button ${label}`); assert.equal(item.disabled, false, `${label} enabled`); item.click(); await settle() }
    const fill = async (label, text) => { const input = document.querySelector(`input[aria-label="${label}"], [aria-label="${label}"] input`); assert.ok(input, label); input.value = text; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await settle() }
    try {
        app.mount('#app'); await settle()
        await fill('邮箱', user.email); await click('发送验证码')
        assert.deepEqual(calls.find(call => call.path === 'v1/auth/email/request').body, { email: user.email })
        await fill('邮箱验证码', '123456'); await click('注册／登录')
        assert.equal(loggedIn, true); assert.ok(document.body.textContent.includes(user.email))
        assert.equal(hosted, false); assert.equal(imports.length, 0)
        await click('上传所选 Cookie')
        assert.deepEqual(calls.find(call => call.path === 'game-accounts/import-local').body, { id: '123456' })
        assert.ok(document.body.textContent.includes('已托管')); assert.equal(imports.length, 0)
        await click('立即同步'); assert.ok(document.body.textContent.includes('等待同步'))
        await click('查看最新快照'); assert.equal(imports.length, 0)
        await click('导入 合成配置')
        assert.equal(imports.length, 1); assert.equal(imports[0].id, 7); assert.deepEqual(imports[0].value, snapshot)
        assert.ok(document.body.textContent.includes('已导入 1 名角色')); assert.equal(profile.currentAccountId.value, 7)
        await click('退出此设备'); assert.equal(loggedIn, false); assert.ok(button('注册／登录'))
    } finally { app.unmount(); dom.window.close() }
})
