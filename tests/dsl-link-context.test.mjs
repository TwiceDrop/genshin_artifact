import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { computed, effectScope, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { CloudGateway } from '../server/cloud.mjs'
import { withDefaultCloudUrl } from '../server/cloud-config.mjs'
import { dslShareId, validateDslDocument } from '../src/algorithms/dsl-library.mjs'

const firstService = 'https://first.example.test'
const secondService = 'https://second.example.test'
const shareId = '10203040-1234-1234-1234-123412341234'
const document = { name:'合成链接手法', character:'Amber', source:'result = 1', generator:null, weapon:null }
const existing = { ...document, id:'existing', name:'原有手法' }
const reloaded = { ...document, id:'reloaded', name:'重载手法' }
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

function gate() {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return { promise, resolve }
}


function load(path, modules, globals = {}) {
    const exports = {}
    const compilerOptions = { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, esModuleInterop:true }
    runInNewContext(ts.transpileModule(read(path), { compilerOptions }).outputText, {
        exports, require(name) { assert.ok(name in modules, name); return modules[name] },
        crypto, console, ...globals,
    }, { filename:path })
    return exports
}

function createGateway(platform, events) {
    let saved = { url:firstService }
    const reached = gate()
    const remote = gate()
    const delivery = gate()
    async function serve(url, headers) {
        assert.equal(url, firstService + '/v1/dsl-shares/' + shareId)
        assert.equal(headers.Authorization, undefined)
        reached.resolve()
        await remote.promise
        return { document }
    }
    const desktop = new CloudGateway({
        sessionStore:{ get:async () => saved, upsert:async value => { saved=value } },
        fetcher:async (url, options) => Response.json(await serve(url, options.headers)),
    })
    const { mobileCloudApi } = load('src/platform/cloud-mobile.mjs', {
        '@capacitor/core':{ CapacitorHttp:{ request:async options => ({ status:200, data:await serve(options.url, options.headers) }) } },
        './native.mjs':{ MonaLocal:{
            readCloudVault:async () => ({ text:JSON.stringify(saved) }),
            writeCloudVault:async ({ text }) => { saved=JSON.parse(text) },
        } },
        '../../server/cookie.mjs':{}, '../../server/cloud-config.mjs':{ withDefaultCloudUrl },
    }, { URL, Error })
    const { cloudApi } = load('src/platform/cloud.mjs', {
        './native.mjs':{ isNative:platform === 'android' },
        './cloud-mobile.mjs':{ mobileCloudApi:async (...args) => {
            const result = await mobileCloudApi(...args)
            if (args[0].startsWith('v1/dsl-shares/')) await delivery.promise
            return result
        } },
    }, { window:events, Event, Error, fetch:async (path, options) => {
        const headers=options.headers, url=headers['X-Mona-Cloud-Url']
        const context=url ? { url:decodeURIComponent(url), userId:headers['X-Mona-Cloud-User'] } : undefined
        const result=await desktop.handle(path.slice('/api/cloud'.length), options.method,
            options.body ? JSON.parse(options.body) : undefined, context)
        if (path.includes('/v1/dsl-shares/')) await delivery.promise
        return Response.json(result.data, { status:result.status })
    } })
    const changeServiceFromOutside = () => platform === 'android'
        ? mobileCloudApi('config', 'PUT', { url:secondService })
        : desktop.handle('/config', 'PUT', { url:secondService })
    return { cloudApi, changeServiceFromOutside, reached, remote, delivery }
}

async function fixture(t, platform = 'windows') {
    const events = new EventTarget()
    const gateway = createGateway(platform, events)
    const account = { currentAccountId:ref(1), reloadGeneration:ref(0), applyingCloud:ref(false) }
    const rows = new Map([[1,[existing]],[2,[{ ...existing, id:'other', name:'另一个账号的手法' }]]])
    const queued = gate(), committed = gate()
    const beforeWrite = gate(), finishMirror = gate()
    const { listDslEntries, saveDslEntry } = load('src/store/dsl-library.ts', {
        './backend':{
            getItem:async key => rows.get(Number(key.split('_').at(-1))),
            async updateAccountItem(id, key, update) {
                assert.equal(key, 'mona_account_dsl_library_' + id)
                queued.resolve()
                await beforeWrite.promise
                // This is the synchronous read/modify/write callback of the IndexedDB transaction.
                const entries = update(rows.get(id))
                if (entries !== undefined) rows.set(id, entries)
                committed.resolve()
                await finishMirror.promise
                return { entries }
            },
        },
    })
    const { useDslManagement } = load('src/pages/dsl-management/useDslManagement.ts', {
        vue:{ computed, onActivated() {}, reactive, shallowRef, watch },
        '@vueuse/core':{ useMediaQuery:() => ref(false) },
        '@/assets/character':{ characterData:{ Amber:{ name:'Amber' } } },
        '@/assets/weapon':{}, '@/assets/buff':{}, '@/assets/target_function':{},
        '@/i18n/i18n':{ useI18n:() => ({ ta:x => x }) },
        '@/composables/character':{ useCharacter:() => ({ characterName:ref('Amber') }) },
        '@/composables/enemy':{ newEnemyConfig:() => ({}) },
        '@/utils/weapon':{}, '@/utils/common':{},
        '@/import/character-summary.mjs':{ isPickerCharacter:() => true },
        '@/wasm/mona':{ useMona:async () => ({}) },
        '@/store/pinia/account':{ useAccountStore:() => account },
        '@/platform/cloud.mjs':{ cloudApi:gateway.cloudApi }, '@/components/share/content-share.mjs':{},
        '@/store/dsl-library':{ listDslEntries, saveDslEntry }, '@/algorithms/dsl-generator.mjs':{},
        '@/algorithms/dsl-library.mjs':{ dslShareId, validateDslDocument },
        './default-target-preview':{ defaultTargetPreview:() => ({ hits:[], source:'', language:'Rust' }) },
        '../../../beta-data/dsl-skill-names.json':{ Amber:[] },
    }, { window:events, Error })
    const scope = effectScope()
    t.after(() => scope.stop())
    const vm = scope.run(useDslManagement)
    await nextTick()
    vm.openLinkImport()
    vm.shareLink = firstService + '/s/' + shareId
    const importing = vm.importLink()
    await gateway.reached.promise
    return { ...gateway, vm, account, rows, importing, queued, committed, beforeWrite, finishMirror,
        finishRequest() { gateway.remote.resolve(); gateway.delivery.resolve() },
    }
}

for (const platform of ['windows', 'android']) {
    test('link import ignores an old service response after a queued service change on ' + platform, { timeout:3000 }, async t => {
        const f = await fixture(t, platform)
        // A config write from another renderer does not dispatch this page's event.
        const change = f.changeServiceFromOutside()
        f.remote.resolve()
        await change
        assert.equal((await f.cloudApi('config')).url, secondService)
        f.delivery.resolve()
        f.beforeWrite.resolve()
        f.finishMirror.resolve()
        await f.importing
        assert.equal(f.rows.get(1).length, 1)
        assert.equal(f.vm.entries.length, 1)
    })
}

for (const change of ['账号切换', '同账号重载']) {
    test('link import ignores a request spanning ' + change, { timeout:3000 }, async t => {
        const f = await fixture(t)
        if (change === '账号切换') f.account.currentAccountId.value = 2
        else {
            f.rows.set(1, [reloaded])
            f.account.reloadGeneration.value++
        }
        await nextTick()
        f.beforeWrite.resolve()
        f.finishMirror.resolve()
        f.finishRequest()
        await f.importing
        assert.equal(f.rows.get(1).length, 1)
        assert.equal(f.rows.get(2).length, 1)
        assert.equal(f.vm.entries[0].id, change === '账号切换' ? 'other' : reloaded.id)
    })
}

test('a service change invalidates a pending write after the config recheck', { timeout:3000 }, async t => {
    const f = await fixture(t)
    f.finishRequest()
    await f.queued.promise
    await f.cloudApi('config', 'PUT', { url:secondService })
    f.beforeWrite.resolve()
    f.finishMirror.resolve()
    await f.importing
    assert.equal(f.rows.get(1).length, 1)
    assert.equal(f.vm.entries.length, 1)
})

test('a cloud restore in progress invalidates the write even before the reload generation advances', { timeout:3000 }, async t => {
    const f = await fixture(t)
    f.finishRequest()
    await f.queued.promise
    f.account.applyingCloud.value = true
    f.beforeWrite.resolve()
    await f.committed.promise
    f.account.applyingCloud.value = false
    f.finishMirror.resolve()
    await f.importing
    assert.equal(f.rows.get(1).length, 1)
    assert.equal(f.vm.error, '')
})

test('link import revalidates the local generation at the queued write boundary', { timeout:3000 }, async t => {
    const f = await fixture(t)
    f.finishRequest()
    await f.queued.promise
    f.rows.set(1, [reloaded])
    f.account.reloadGeneration.value++
    await nextTick()
    f.beforeWrite.resolve()
    f.finishMirror.resolve()
    await f.importing
    assert.deepEqual(Array.from(f.rows.get(1), entry => entry.id), [reloaded.id])
    assert.equal(f.vm.entries[0].id, reloaded.id)
})

test('late save completion cannot replace the list after a same-account reload', { timeout:3000 }, async t => {
    const f = await fixture(t)
    f.finishRequest()
    f.beforeWrite.resolve()
    await f.committed.promise
    assert.equal(f.rows.get(1).length, 2)
    f.rows.set(1, [reloaded])
    f.account.reloadGeneration.value++
    await nextTick()
    f.finishMirror.resolve()
    await f.importing
    assert.deepEqual(Array.from(f.vm.entries, entry => entry.id), [reloaded.id])
    assert.equal(f.vm.linkImportOpen, true)
})

test('unchanged unsigned context saves the shared hand as a new local entry', { timeout:3000 }, async t => {
    const f = await fixture(t)
    f.finishRequest()
    f.beforeWrite.resolve()
    f.finishMirror.resolve()
    await f.importing
    assert.equal(f.rows.get(1).length, 2)
    assert.equal(f.rows.get(1)[0].id, existing.id)
    assert.equal(f.vm.entries[1].name, document.name)
    assert.equal(f.vm.linkImportOpen, false)
})
