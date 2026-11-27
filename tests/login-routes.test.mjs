import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { compileScript, parse } from '@vue/compiler-sfc'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { CloudGateway } from '../server/cloud.mjs'
import { publicAccount } from '../server/cookie.mjs'
import { withDefaultCloudUrl } from '../server/cloud-config.mjs'
import { followCloudSession } from '../src/platform/login-gate.mjs'

// 合成数据：令牌、用户和服务地址都是虚构的。
const token = '00000000-0000-4000-8000-000000000001.synthetic-session-secret'
const user = { id: 'synthetic-user', email: 'synthetic@example.test', username: '合成用户' }
const session = { sessionToken: token, user, expiresAt: '2099-01-01T00:00:00Z' }
const sessionRoutes = ['v1/auth/register', 'v1/auth/password/login']

test('the login page opens Home for online and offline entry even with an old redirect URL', async () => {
    const source = fs.readFileSync(new URL('../src/pages/LoginPage/LoginPage.vue', import.meta.url), 'utf8')
    const script = compileScript(parse(source).descriptor, { id: 'login-routes' }).content
        .replace(/^import .*\r?\n/gm, '').replace('export default', 'module.exports =')
    function openPage({ configUser = null, loginUser = user, offlineChosen = false, sharePath = '' } = {}) {
        const events = []
        let mount
        const module = {}
        vm.runInNewContext(script, {
            module, computed, ref, watch, process, isNative: false, setInterval: () => 0,
            IconEpRight: null, StarField: null, AstrolabeDial: null, MonaPortrait: null,
            onMounted: fn => { mount = fn }, onBeforeUnmount() {},
            useRoute: () => ({ query: { redirect: '/team-optimization?share=resume' } }),
            useRouter: () => ({ replace: destination => events.push(destination.name ?? destination) }),
            cloudApi: async path => ({ user: path === 'config' ? configUser : loginUser }),
            isOfflineChosen: () => offlineChosen, contentShareReturnPath: ref(sharePath),
            chooseOffline: () => events.push('offline'), clearOfflineChoice: () => events.push('online'),
        })
        const page = module.exports.setup({}, { expose() {} })
        return { events, mount, page }
    }
    const offline = openPage()
    offline.page.continueOffline()
    assert.deepEqual(offline.events, ['offline', 'home'])

    const online = openPage()
    online.page.account.value = 'synthetic'
    online.page.password.value = 'synthetic-password'
    await online.page.submit()
    assert.deepEqual(online.events, ['online', 'home'])

    const legacy = openPage({ loginUser: { ...user, username: '' } })
    legacy.page.account.value = 'synthetic'
    legacy.page.password.value = 'synthetic-password'
    await legacy.page.submit()
    assert.equal(legacy.page.mode.value, 'naming')
    legacy.page.leave()
    assert.deepEqual(legacy.events, ['online', 'home'])

    const activeSession = openPage({ configUser: user })
    await activeSession.mount()
    assert.deepEqual(activeSession.events, ['home'])

    const sharePath = '/calculate?mode=synthetic'
    const shareLogin = openPage({ offlineChosen: true, sharePath })
    shareLogin.page.account.value = 'synthetic'
    shareLogin.page.password.value = 'synthetic-password'
    await shareLogin.page.submit()
    assert.deepEqual(shareLogin.events, ['online', sharePath])

    const shareOffline = openPage({ sharePath })
    shareOffline.page.continueOffline()
    assert.deepEqual(shareOffline.events, ['offline', sharePath])
})

test('preset and DSL share forms keep their draft until navigation returns to the source page', async () => {
    const source = fs.readFileSync(new URL('../src/components/share/ContentShareDialog.vue', import.meta.url), 'utf8')
    const script = compileScript(parse(source).descriptor, { id: 'content-share-login' }).content
        .replace(/^import .*\r?\n/gm, '').replace('export default', 'module.exports =')
    for (const kind of ['preset', 'dsl']) {
        const route = reactive({ name: 'calculate', fullPath: '/calculate?mode=synthetic' })
        const sourcePath = route.fullPath
        const draft = ref(null)
        const module = {}
        const events = new EventTarget()
        const destinations = []
        let signedIn = false
        let published
        function navigate(name, fullPath) { Object.assign(route, { name, fullPath }) }
        vm.runInNewContext(script, {
            module, computed, ref, watch, draft, returnPath: ref(''),
            CharacterPortrait: null, characterData: {}, locale: {},
            useRoute: () => route,
            useRouter: () => ({ push: destination => { destinations.push(destination); navigate('login', '/login') } }),
            useAccountStore: () => ({ currentAccountId: ref(1) }),
            onBeforeUnmount() {}, window: events, clearTimeout, setTimeout,
            navigator: { clipboard: { writeText: async () => {} } },
            cloudApi: async (path, method, body) => {
                if (path === 'config') return { user: signedIn ? user : null, url: 'https://cloud.example.test' }
                assert.equal(path, 'v1/shares')
                assert.equal(method, 'POST')
                published = body
                return { status: 'active', id: 'synthetic-share' }
            },
        })
        const page = module.exports.setup({}, { expose() {} })
        draft.value = { kind, content: { title: 'Initial title' }, equipment: [{ slot: 'Flower' }], requestId: 'synthetic' }
        page.title.value = 'Edited title'
        page.term.value = '7'
        page.withGear.value = kind === 'preset'
        await page.publish()
        assert.equal(page.visible.value, false)

        signedIn = true
        events.dispatchEvent(new Event('mona-cloud-context-change'))
        navigate('home', '/')
        await nextTick()
        assert.equal(page.visible.value, false)
        navigate('calculate', sourcePath)
        await nextTick()
        assert.equal(page.visible.value, true)
        assert.deepEqual(JSON.parse(JSON.stringify(destinations)), [{ name: 'login' }])
        assert.equal(page.title.value, 'Edited title')
        assert.equal(page.term.value, '7')
        assert.equal(page.withGear.value, kind === 'preset')
        await page.publish()
        assert.equal(published.content.title, 'Edited title')
        assert.equal(published.days, 7)
        if (kind === 'preset') assert.deepEqual(published.content.equipment, draft.value.equipment)
    }
})

test('the team axis share dialog waits for a signed-in session when returning from login', async () => {
    const source = fs.readFileSync(new URL('../src/pages/TeamOptimizationPage/axis-sharing.mjs', import.meta.url), 'utf8')
        .replace(/^import .*\r?\n/gm, '').replace(/^export /gm, '')
    let signedIn = false
    const useAxisSharing = vm.runInNewContext(source + '\nuseAxisSharing', {
        computed, ref, onBeforeUnmount() {}, window: new EventTarget(),
        cloudApi: async () => ({ user: signedIn ? user : null }),
    })
    const share = useAxisSharing({ entry: ref(null) })
    const offline = share.show({ returning: true })
    assert.equal(share.open.value, false)
    await offline
    assert.equal(share.open.value, false)

    signedIn = true
    await share.show({ returning: true })
    assert.equal(share.open.value, true)
    assert.equal(share.verified.value, true)
})

function memoryStore(initial) {
    let value = initial
    return {
        get: async () => value && { ...value },
        upsert: async next => { value = { ...next } },
        update: async (_, patch) => { value = { ...value, ...patch } },
        peek: () => value,
    }
}

process.env.VUE_APP_MONA_CLOUD_URL = 'https://cloud.example.test'

test('a fresh desktop gateway can request a code before a service address is saved', async () => {
    const store = memoryStore()
    const gateway = new CloudGateway({ sessionStore: store, fetcher: async url => {
        assert.equal(url, 'https://cloud.example.test/v1/auth/email/request')
        return Response.json({ challengeId: 'synthetic' })
    } })
    assert.deepEqual(await gateway.handle('/v1/auth/email/request', 'POST', { email: 'synthetic@example.test' }),
        { status: 200, data: { challengeId: 'synthetic' } })
    assert.equal((await gateway.handle('/config', 'GET')).data.url, 'https://cloud.example.test')
    assert.equal(store.peek(), undefined)
})

test('desktop gateway forwards register, password login and reset, and keeps the new session token to itself', async () => {
    const sent = []
    const store = memoryStore({ id: 'online', url: 'https://cloud.example.test', sessionToken: null, user: null, expiresAt: null })
    const fetcher = async (url, init) => {
        sent.push({ path: new URL(url).pathname, body: JSON.parse(init.body) })
        const path = new URL(url).pathname
        const data = path === '/v1/auth/password/reset' ? { ok: true } : session
        return { ok: true, status: 200, json: async () => structuredClone(data) }
    }
    const gateway = new CloudGateway({ sessionStore: store, credentialStore: {}, fetcher })
    for (const route of sessionRoutes) {
        await store.update('online', { sessionToken: null, user: null })
        const result = await gateway.handle(`/${route}`, 'POST', { account: 'synthetic', password: 'synthetic-password' })
        assert.equal(result.status, 200)
        assert.equal(result.data.sessionToken, undefined, `${route} 不应把令牌交给页面`)
        assert.deepEqual(result.data.user, user)
        assert.equal(store.peek().sessionToken, token, `${route} 应保存会话`)
    }
    await store.update('online', { sessionToken: null, user: null })
    const reset = await gateway.handle('/v1/auth/password/reset', 'POST', { challengeId: 'synthetic', code: '123456', newPassword: 'synthetic-password' })
    assert.deepEqual(reset, { status: 200, data: { ok: true } })
    assert.equal(store.peek().sessionToken, null, '重设密码不登录')
    assert.deepEqual(sent.map(item => item.path), ['/v1/auth/register', '/v1/auth/password/login', '/v1/auth/password/reset'])
    assert.equal((await gateway.handle('/v1/auth/password/other', 'POST', {})).status, 404)
})

test('Android forwards register and password login and saves the session in its native vault', async () => {
    let vault = JSON.stringify({ url: 'https://cloud.example.test' })
    const paths = []
    globalThis.__loginRoutesMock = {
        publicAccount, withDefaultCloudUrl,
        MonaLocal: { readCloudVault: async () => ({ text: vault }), writeCloudVault: async ({ text }) => { vault = text } },
        CapacitorHttp: { request: async request => {
            const path = new URL(request.url).pathname
            paths.push(path)
            return { status: 200, data: structuredClone(path === '/v1/auth/password/reset' ? { ok: true } : session) }
        } },
    }
    const source = fs.readFileSync(new URL('../src/platform/cloud-mobile.mjs', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '')
    const { mobileCloudApi: api } = await import('data:text/javascript;base64,' + Buffer.from(`const { MonaLocal, CapacitorHttp, publicAccount, withDefaultCloudUrl } = globalThis.__loginRoutesMock;\n${source}`).toString('base64'))
    delete globalThis.__loginRoutesMock
    for (const path of sessionRoutes) {
        vault = JSON.stringify({ url: 'https://cloud.example.test' })
        const result = await api(path, 'POST', { account: 'synthetic', password: 'synthetic-password' })
        assert.equal(result.sessionToken, undefined)
        assert.equal(JSON.parse(vault).sessionToken, token, `${path} 应保存会话`)
    }
    vault = JSON.stringify({ url: 'https://cloud.example.test' })
    assert.deepEqual(await api('v1/auth/password/reset', 'POST', { challengeId: 'synthetic', code: '123456', newPassword: 'synthetic-password' }), { ok: true })
    assert.equal(JSON.parse(vault).sessionToken, undefined)
    assert.deepEqual(paths, ['/v1/auth/register', '/v1/auth/password/login', '/v1/auth/password/reset'])
})

test('cloud profile sync starts while signed in and stops after sign-out, following login state changes', async () => {
    let signedIn = true
    const calls = []
    const events = new EventTarget()
    const sync = { start: async () => { calls.push('start') }, stop: () => { calls.push('stop') } }
    const api = async path => { assert.equal(path, 'config'); return { user: signedIn ? user : null } }
    await followCloudSession(sync, { api, events })
    assert.deepEqual(calls, ['start'])
    const changed = async () => { events.dispatchEvent(new Event('mona-cloud-context-change')); await new Promise(resolve => setTimeout(resolve, 0)) }
    await changed()
    assert.deepEqual(calls, ['start'], '仍登录时不重复启动')
    signedIn = false; await changed()
    assert.deepEqual(calls, ['start', 'stop'])
    await changed()
    assert.deepEqual(calls, ['start', 'stop'], '未登录时不重复停止')
    signedIn = true; await changed()
    assert.deepEqual(calls, ['start', 'stop', 'start'])
})
