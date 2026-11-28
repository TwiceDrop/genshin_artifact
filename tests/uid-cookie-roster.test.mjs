import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const { parse } = require('@vue/compiler-sfc')

test('cached UID page picks up a cloud Cookie import and retains the selected game UID on return', async () => {
    const dom = new JSDOM('<div id="app"></div>')
    for (const key of ['window', 'document', 'Element', 'SVGElement']) globalThis[key] = dom.window[key]
    const Vue = require('vue')
    const source = readFileSync(new URL('../src/components/import/MiyousheImport.vue', import.meta.url), 'utf8')
    const body = parse(source).descriptor.scriptSetup.content.replace(/^import .*$/gm, '')
    const setup = new Function('Vue', 'mysApi', 'useMiyousheStore', 'useAccountStore', 'defineEmits',
        `const {ref,shallowRef,computed,onMounted,onDeactivated,onBeforeUnmount} = Vue;
         const useRoute = () => ({ path: '/uid-data' }), useRouter = () => ({});
         ${body}
         return {savedAccounts,activeId,roles,selectedUid,loggedIn}`)
    const calls = []
    let saved = { accounts: [], activeId: null }
    const readAccounts = async (path, method = 'GET') => {
        calls.push([path, method])
        assert.deepEqual([path, method], ['accounts', 'GET'])
        return structuredClone(saved)
    }
    const emptyStore = () => ({})
    const uidPage = {
        setup: () => setup(Vue, readAccounts, emptyStore, emptyStore, () => () => {}),
        render() { return Vue.h('span', String(this.savedAccounts.length)) },
    }
    const otherPage = { render: () => Vue.h('div') }
    const visible = Vue.ref(true), page = Vue.ref()
    const app = Vue.createApp({
        render: () => Vue.h(Vue.KeepAlive, null, {
            default: () => visible.value ? Vue.h(uidPage, { ref: page }) : Vue.h(otherPage),
        }),
    })
    async function visit(uid) {
        visible.value = uid
        await new Promise(resolve => setImmediate(resolve))
    }
    try {
        app.mount('#app')
        await visit(true)
        assert.equal(dom.window.document.querySelector('span').textContent, '0')
        await visit(false)
        const account = { id: 'test-account', platform: 'miyoushe', roles: [{ uid: '100000001' }, { uid: '100000002' }] }
        saved = { accounts: [account], activeId: account.id }
        window.dispatchEvent(new window.CustomEvent('mona-cloud-cookie-imported', { detail: { accounts: saved.accounts, account } }))
        await visit(true)
        assert.equal(dom.window.document.querySelector('span').textContent, '1')
        assert.equal(page.value.loggedIn, true)
        assert.equal(page.value.activeId, account.id)
        assert.deepEqual(page.value.roles, account.roles)
        assert.equal(page.value.selectedUid, account.roles[0].uid)
        page.value.selectedUid = account.roles[1].uid
        await visit(false)
        await visit(true)
        assert.equal(page.value.selectedUid, account.roles[1].uid)
        assert.equal(calls.length, 1, 'only the initial mount reads the local account list')
    } finally {
        app.unmount()
        dom.window.close()
    }
})
