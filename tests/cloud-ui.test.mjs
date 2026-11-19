import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { deriveCookieKey, encryptCookie, decryptCookie, checkNewPassphrase } from '../src/cloud/cookie-crypto.mjs'
import { communityAccount } from '../server/cookie.mjs'
const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')

// 合成数据。云端和本机网关用内存模拟；加解密用真实的 WebCrypto，验证页面只把密文和派生密钥交出去。
test('cookie vault panel encrypts Cookies before upload, unlocks with the passphrase on a new device and re-encrypts on passphrase change', async () => {
    const dom = new JSDOM('<html><body><div id="app"></div></body></html>', { url: 'http://127.0.0.1/online-account', pretendToBeVisual: true })
    for (const key of ['window', 'document', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle', 'Event', 'MouseEvent']) globalThis[key] = typeof dom.window[key] === 'function' && key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key]
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
    globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
    const Vue = require('vue'), ElementPlus = require('element-plus')
    const localCookie = 'ltuid=123456;ltoken=synthetic-ltoken;cookie_token=synthetic-cookie-token;account_id=123456;'
    const passphrase = '合成测试解密密码', nextPassphrase = '新的合成解密密码'
    const calls = [], vaults = new Map(), mysCalls = []
    let loggedIn = true, storedKey = null, failReplace = false, cookieSync = true
    const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }) }
    async function cloudApi(path, method = 'GET', body) {
        calls.push({ path, method, body })
        if (path === 'v1/sessions') return { sessions: [{ id: 'session-a', deviceName: '合成设备', current: true, lastUsedAt: '2026-11-07T00:00:00Z' }] }
        if (path === 'v1/sessions/session-a' && method === 'DELETE') { loggedIn = false; return { ok: true } }
        if (path === 'local-accounts') return { accounts: [{ id: '123456', accountUid: '123456', platform: 'miyoushe', roles: [] }] }
        if (path === 'local-accounts/cookie') { assert.deepEqual(body, { id: '123456' }); return { platform: 'miyoushe', accountUid: '123456', cookie: localCookie } }
        if (path === 'cookie-key' && method === 'GET') return { cookieKey: storedKey }
        if (path === 'cookie-key' && method === 'PUT') { storedKey = structuredClone(body); return { ok: true } }
        if (path === 'cookie-key' && method === 'DELETE') { storedKey = null; return { ok: true } }
        if (path === 'v1/cookie-vaults' && method === 'GET') return { vaults: [...vaults.values()].map(({ platform, accountUid, updatedAt }) => ({ platform, accountUid, updatedAt })) }
        if (path === 'v1/cookie-vaults' && method === 'PUT') {
            if (failReplace) fail(409, 'VAULT_SET_CHANGED', '云端的 Cookie 列表已变化，请刷新后重试')
            for (const entry of body.vaults) vaults.set(`${entry.platform}/${entry.accountUid}`, { ...entry, updatedAt: '2026-11-18T01:00:00Z' })
            return { vaults: [] }
        }
        const match = /^v1\/cookie-vaults\/(miyoushe|hoyolab)\/(\d+)$/.exec(path)
        if (match) {
            const key = `${match[1]}/${match[2]}`
            if (method === 'PUT') { vaults.set(key, { platform: match[1], accountUid: match[2], ...body, updatedAt: '2026-11-18T00:00:00Z' }); return { vault: {} } }
            if (!vaults.has(key)) fail(404, 'NOT_FOUND', '不存在')
            if (method === 'GET') return { vault: structuredClone(vaults.get(key)) }
            if (method === 'DELETE') { vaults.delete(key); return { ok: true } }
        }
        throw new Error(`Unexpected API ${method} ${path}`)
    }
    const mysApi = async (path, method, body) => { mysCalls.push({ path, method, body }); return { account: { id: '123456', accountUid: '123456', platform: 'miyoushe', roles: [{ nickname: '合成角色' }] } } }
    const profileSync = { getSyncSettings: () => ({ cookie: cookieSync }) }
    const setOnlineUserCalls = [], setOnlineUser = value => setOnlineUserCalls.push(value)
    const filename = 'src/pages/OnlineAccountPage/CookieVaultPanel.vue'
    const { descriptor } = parse(fs.readFileSync(new URL('../' + filename, import.meta.url), 'utf8'), { filename })
    const script = compileScript(descriptor, { id: 'online-component' })
    const template = compileTemplate({ source: descriptor.template.content, filename, id: 'online-component', compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
    const scriptCode = script.content.replace(/^import .*\r?\n/gm, '').replace('export default', 'const component =')
    const renderCode = template.code.replace(/import \{([^}]+)\} from "vue"/g, (_, names) => `const {${names.replace(/\s+as\s+/g, ':')}} = Vue`).replace('export function render', 'function render')
    const component = new Function('Vue', 'cloudApi', 'mysApi', 'profileSync', 'setOnlineUser', 'deriveCookieKey', 'encryptCookie', 'decryptCookie', 'checkNewPassphrase', 'communityAccount',
        `const {ref,onMounted,onBeforeUnmount}=Vue;\n${scriptCode}\n${renderCode}\ncomponent.render=render; return component`)(Vue, cloudApi, mysApi, profileSync, setOnlineUser, deriveCookieKey, encryptCookie, decryptCookie, checkNewPassphrase, communityAccount)
    const app = Vue.createApp(component).use(ElementPlus)
    const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label)
    const idle = () => [...document.querySelectorAll('button')].some(item => item.textContent.trim() === '刷新' && !item.disabled) || !button('刷新')
    // PBKDF2 在线程池里跑，等页面回到空闲（刷新按钮可用）再继续
    const settle = async () => { for (let i = 0; i < 400; i++) { await new Promise(resolve => setTimeout(resolve, 5)); await Vue.nextTick(); if (i > 3 && idle()) return } }
    const click = async label => { const item = button(label); assert.ok(item, `button ${label}`); assert.equal(item.disabled, false, `${label} enabled`); item.click(); await settle() }
    const fill = async (label, text) => { const input = document.querySelector(`input[aria-label="${label}"], [aria-label="${label}"] input`); assert.ok(input, label); input.value = text; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await settle() }
    const alert = () => document.querySelector('.el-alert')?.textContent || ''
    const sentSecrets = () => calls.some(call => JSON.stringify(call.body ?? '').includes('synthetic-cookie-token') || JSON.stringify(call.body ?? '').includes('合成解密密码'))
    try {
        app.mount('#app'); await settle()
        // 第一台设备：设置解密密码，本机只存派生密钥
        await fill('解密密码', passphrase); await fill('确认解密密码', passphrase); await click('设置解密密码')
        assert.deepEqual(Object.keys(storedKey).sort(), ['kdf', 'key', 'salt'])
        assert.equal(storedKey.key, (await deriveCookieKey(passphrase, { salt: storedKey.salt })).key)
        await click('加密上传所选 Cookie')
        const sealed = vaults.get('miyoushe/123456')
        assert.ok(sealed, alert()); assert.equal(sealed.salt, storedKey.salt); assert.equal(sealed.version, 1); assert.equal(sealed.kdf.iterations, 600000)
        assert.equal(await decryptCookie(await deriveCookieKey(passphrase, { salt: sealed.salt }), sealed), localCookie)
        assert.equal(sentSecrets(), false)

        // Cookie 同步关闭时不上传
        cookieSync = false; vaults.delete('miyoushe/123456')
        await click('加密上传所选 Cookie')
        assert.equal(vaults.size, 0); assert.match(alert(), /Cookie 同步已关闭/)
        cookieSync = true; await click('刷新'); await click('加密上传所选 Cookie'); assert.equal(vaults.size, 1)

        // 新设备：本机没有密钥，输错解密密码只提示，不改任何数据
        storedKey = null; await click('刷新')
        assert.equal(button('加密上传所选 Cookie'), undefined)
        const before = JSON.stringify([...vaults.entries()])
        await fill('解密密码', '错误的密码'); await click('解锁')
        assert.match(alert(), /解密密码不正确/); assert.equal(storedKey, null); assert.equal(JSON.stringify([...vaults.entries()]), before)
        await fill('解密密码', passphrase); await click('解锁')
        assert.equal(alert(), ''); assert.ok(storedKey)
        await click('导入本机')
        assert.deepEqual(mysCalls, [{ path: 'accounts', method: 'POST', body: { cookie: localCookie, platform: 'miyoushe' } }])

        // 修改解密密码：409 时什么都不改；成功后云端密文换成新密钥加密
        const oldKey = structuredClone(storedKey)
        await click('修改解密密码'); await fill('新解密密码', nextPassphrase); await fill('确认新解密密码', nextPassphrase)
        failReplace = true; await click('确认修改')
        assert.match(alert(), /请刷新后重试/); assert.deepEqual(storedKey, oldKey); assert.equal(JSON.stringify([...vaults.entries()]), before)
        failReplace = false
        await fill('新解密密码', nextPassphrase); await fill('确认新解密密码', nextPassphrase); await click('确认修改')
        const replaced = vaults.get('miyoushe/123456')
        assert.notEqual(replaced.salt, oldKey.salt); assert.equal(storedKey.salt, replaced.salt)
        assert.equal(await decryptCookie(await deriveCookieKey(nextPassphrase, { salt: replaced.salt }), replaced), localCookie)
        assert.equal(sentSecrets(), false)

        // 其他设备改过解密密码后，本机旧密钥作废，回到输入解密密码
        storedKey = oldKey; await click('刷新'); await click('导入本机')
        assert.match(alert(), /其他设备修改/); assert.equal(storedKey, null); assert.ok(button('解锁')); assert.equal(vaults.size, 1)

        await click('退出此设备'); assert.equal(loggedIn, false); assert.ok(!document.body.textContent.includes('合成设备'))
    } finally { app.unmount(); dom.window.close() }
})
