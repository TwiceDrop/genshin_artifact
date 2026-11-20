import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdir, mkdtemp, rm} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {activePatch, refreshPatchInfo, patchDebugInfo} from '../src/platform/patch-info.mjs'
import {PatchStore} from '../server/patch-store.mjs'
import {PatchUpdater} from '../server/patch-updater.mjs'
import {createLocalServer} from '../server/local.mjs'
import {createUsageStatsRecorder} from '../src/usage-stats/recorder.mjs'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {testKeyPair, makeSignedPackage} from './helpers/patch-signing.mjs'

const reply = (body, ok = true, status = 200) => async () => ({ok, status, json: async () => body})
const base = fileURLToPath(new URL('../.cache/test/patch-info/', import.meta.url))
await mkdir(base, {recursive: true})

test('refreshPatchInfo exposes the active patch to the settings row and a Debug snapshot', async () => {
    const requests = []
    const body = {current: {status: 'applied', patch: '7.2.04.01', baseVersion: {min: '7.2.04', max: '7.2.04.99'}, files: [{path: 'beta-data/vodyanitsa.json', sha256: 'ab'}]},
        pending: '7.2.04.02', lastCheck: {status: 'installed', patch: '7.2.04.02', checkedAt: '2026-11-20T08:00:00.000Z'}}
    const snapshot = await refreshPatchInfo({fetchImpl: async (url, options) => { requests.push([url, options.headers]); return reply(body)() }, version: '7.2.04', native: false})
    assert.equal(activePatch.value, '7.2.04.01')
    assert.deepEqual(requests, [['/api/patch/info?version=7.2.04', {'x-mona-local': '1'}]])
    assert.deepEqual(snapshot.active, {patch: '7.2.04.01', baseVersion: {min: '7.2.04', max: '7.2.04.99'}, files: [{path: 'beta-data/vodyanitsa.json', sha256: 'ab'}]})
    assert.equal(snapshot.pending, '7.2.04.02')
    assert.equal(snapshot.rejected, null)
    const debug = patchDebugInfo()
    assert.equal(typeof debug.configured, 'boolean')
    assert.equal(debug.automatic, true)
    assert.equal(debug.active.patch, '7.2.04.01')
    assert.equal(debug.lastCheck.status, 'installed')
    assert.ok(!JSON.stringify(debug).includes('overlay'), 'the Debug export must not carry patch data')
})

test('a patch that was refused keeps its stage and reason, and the active patch is empty', async () => {
    await refreshPatchInfo({fetchImpl: reply({current: {status: 'applied', patch: 'p'}, pending: null, lastCheck: {status: 'none'}}), native: false})
    assert.equal(activePatch.value, 'p')
    const snapshot = await refreshPatchInfo({fetchImpl: reply({current: {status: 'rejected', stage: '哈希', reason: '内容补丁哈希：x'}, pending: null, lastCheck: {status: 'failed', stage: '下载', reason: 'y'}}), native: false})
    assert.equal(activePatch.value, null)
    assert.deepEqual(snapshot.rejected, {stage: '哈希', reason: '内容补丁哈希：x'})
    assert.equal(snapshot.lastCheck.stage, '下载')
    assert.equal(snapshot.active, null)
    const none = await refreshPatchInfo({fetchImpl: reply({current: {status: 'none'}, pending: null, lastCheck: {status: 'idle'}}), native: false})
    assert.equal(none.active, null); assert.equal(activePatch.value, null)
})

test('an unreachable local service, an error answer and Android leave no active patch and say why', async () => {
    await refreshPatchInfo({fetchImpl: reply({current: {status: 'applied', patch: 'p'}, pending: null, lastCheck: null}), native: false})
    const down = await refreshPatchInfo({fetchImpl: async () => { throw new Error('refused') }, native: false})
    assert.equal(activePatch.value, null)
    assert.match(down.unavailable, /refused/)
    assert.match((await refreshPatchInfo({fetchImpl: reply({error: '服务出错'}, false, 502), native: false})).unavailable, /服务出错/)
    assert.match((await refreshPatchInfo({native: true})).unavailable, /Android/)
    assert.match(patchDebugInfo().unavailable, /Android/)
})

test('the local server reports the active patch without its data, the pending one and the last check', async () => {
    const directory = await mkdtemp(base)
    const keys = await testKeyPair()
    try {
        const store = new PatchStore({directory: path.join(directory, 'patches')})
        const updater = new PatchUpdater({store})
        const make = async (patch, name) => makeSignedPackage(keys.privateKey, {[PATCHABLE_DATA.weapons]: {weapons: [{name}]}}, {patch, min: '7.2.05EA', max: '7.2.05EA.99'})
        const install = async pack => store.install({manifest: JSON.parse(Buffer.from(pack.manifest).toString('utf8')), files: pack.files})
        await install(await make('7.2.05EA.01', 'First'))
        const server = createLocalServer({patchStore: store, patchUpdater: updater, credentialStore: {}})
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
        const info = async version => (await fetch('http://127.0.0.1:' + server.address().port + '/api/patch/info?version=' + version, {headers: {'x-mona-local': '1'}})).json()
        try {
            const first = await info('7.2.05EA')
            assert.equal(first.current.status, 'applied')
            assert.equal(first.current.patch, '7.2.05EA.01')
            assert.equal(first.current.overlay, undefined, 'the patch data must not be sent to the page for a status read')
            assert.deepEqual(first.current.files.map(file => file.path), [PATCHABLE_DATA.weapons])
            assert.equal(first.pending, null)
            assert.equal(first.lastCheck.status, 'idle')
            await install(await make('7.2.05EA.02', 'Second'))
            assert.equal((await info('7.2.05EA')).pending, '7.2.05EA.02', 'a newer installed patch waits for the next start')
            assert.equal((await info('7.2.06')).current.stage, '版本')
            assert.equal((await info('7.2.06')).pending, '7.2.05EA.02', 'a rejected current patch is never reported as the pending one')
        } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    } finally { await rm(directory, {recursive: true, force: true}) }
})

test('the usage stats upload carries the patch only when one is active', async () => {
    const sent = []
    let patch = null
    const storage = new Map()
    const recorder = createUsageStatsRecorder({
        storage: {getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k)},
        endpoint: 'https://stats.example.test', platform: 'windows', version: '7.2.04', patch: () => patch, clock: () => new Date(2026, 10, 12, 10),
        randomId: () => '00000000-0000-4000-8000-000000000001', send: async body => { sent.push(structuredClone(body)); return {ok: true, status: 200} },
    })
    recorder.setConsent('on')
    recorder.record('page.calculate'); await recorder.flush()
    assert.equal('patch' in sent[0], false, 'without a patch the upload has exactly the fields it had before')
    patch = '7.2.04.01'
    recorder.record('page.artifacts'); await recorder.flush()
    assert.equal(sent[1].patch, '7.2.04.01')
    assert.equal(sent[1].version, '7.2.04', 'version keeps the base version')
})
