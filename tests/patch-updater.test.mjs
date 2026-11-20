import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {PatchStore} from '../server/patch-store.mjs'
import {PatchUpdater} from '../server/patch-updater.mjs'
import {createLocalServer} from '../server/local.mjs'
import {createPatchChecker, startPatchChecks, isAutomaticPatchEnabled, setAutomaticPatchEnabled} from '../src/platform/patch-update.mjs'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {testKeyPair, makeSignedPackage} from './helpers/patch-signing.mjs'

const WEAPONS = PATCHABLE_DATA.weapons
const keys = await testKeyPair(), other = await testKeyPair()
const publicKey = Buffer.from(keys.publicKey).toString('base64')
const base = fileURLToPath(new URL('../.cache/test/patch-updater/', import.meta.url))
await mkdir(base, {recursive: true})

// 把合成补丁包当作静态目录发布出去：/manifest.json、/manifest.sig、/files/<键>.json
function routesOf(pack, {etag = '"v1"'} = {}) {
    const routes = new Map([['/manifest.json', {body: pack.manifest, etag}], ['/manifest.sig', {body: pack.signature}]])
    for (const [file, bytes] of Object.entries(pack.files)) routes.set('/files/' + Object.entries(PATCHABLE_DATA).find(([, p]) => p === file)[0] + '.json', {body: bytes})
    return routes
}
async function withSetup(run) {
    const directory = await mkdtemp(base), hits = [], routes = new Map()
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://x').pathname
        hits.push(pathname + (req.headers['if-none-match'] ? ' [conditional]' : ''))
        const route = routes.get(pathname)
        if (!route) { res.writeHead(404); return res.end() }
        if (route.hang) return
        if (route.etag && req.headers['if-none-match'] === route.etag) { res.writeHead(304); return res.end() }
        const headers = {'Content-Length': route.body.length, ...(route.etag ? {ETag: route.etag} : {})}
        res.writeHead(route.status || 200, headers)
        if (route.truncate) { res.write(Buffer.from(route.body).subarray(0, Math.floor(route.body.length / 2))); return setTimeout(() => res.destroy(), 20) }
        res.end(Buffer.from(route.body))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}`
    const store = new PatchStore({directory: path.join(directory, 'patches')})
    const updater = new PatchUpdater({store, timeouts: {manifest: 300, file: 300}, now: () => new Date('2026-11-20T08:00:00Z')})
    const input = (extra = {}) => ({version: '7.2.05EA', baseUrl: url, publicKey, ...extra})
    try { return await run({directory, hits, routes, url, store, updater, input, publish: (pack, options) => { routes.clear(); for (const [k, v] of routesOf(pack, options)) routes.set(k, v) } }) }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, {recursive: true, force: true}) }
}
const pack = (contents, options) => makeSignedPackage(keys.privateKey, contents, options)
const filesHit = hits => hits.filter(hit => hit.startsWith('/files/'))

test('nothing published yet is not a failure and nothing is installed', () => withSetup(async ({updater, input, store}) => {
    const result = await updater.check(input())
    assert.equal(result.status, 'none')
    assert.equal(await store.latestPatch(), null)
}))

test('a published patch is downloaded, verified and installed for the next start, not for this run', () => withSetup(async ({updater, input, store, publish}) => {
    publish(await pack({[WEAPONS]: {weapons: [{name: 'Patched'}]}}))
    const result = await updater.check(input())
    assert.deepEqual({status: result.status, patch: result.patch, checkedAt: result.checkedAt}, {status: 'installed', patch: '7.2.05EA.01', checkedAt: '2026-11-20T08:00:00.000Z'})
    assert.equal(await store.latestPatch(), '7.2.05EA.01')
    assert.deepEqual(await store.load('7.2.05EA'), {status: 'none'}, 'the running app keeps its data until the next start')
    await store.activatePending()
    assert.deepEqual((await store.load('7.2.05EA')).overlay, {weapons: {weapons: [{name: 'Patched'}]}})
    assert.deepEqual(updater.status(), result)
}))

test('an unchanged manifest answers 304 and downloads nothing; a lower or equal patch number is not downloaded', () => withSetup(async ({updater, input, hits, publish}) => {
    publish(await pack(undefined, {patch: '7.2.05EA.02'}))
    assert.equal((await updater.check(input())).status, 'installed')
    const before = filesHit(hits).length
    assert.equal((await updater.check(input())).status, 'unchanged')
    assert.ok(hits.includes('/manifest.json [conditional]'))
    publish(await pack(undefined, {patch: '7.2.05EA.02'}), {etag: '"v2"'})
    assert.deepEqual((await updater.check(input())).status, 'up-to-date')
    publish(await pack(undefined, {patch: '7.2.05EA.01'}), {etag: '"v3"'})
    assert.equal((await updater.check(input())).patch, '7.2.05EA.02', 'an older remote patch never replaces a newer installed one')
    assert.equal(filesHit(hits).length, before, 'no file may be downloaded again')
    publish(await pack({[WEAPONS]: {weapons: [{name: 'Newer'}]}}, {patch: '7.2.05EA.03'}), {etag: '"v4"'})
    assert.equal((await updater.check(input())).status, 'installed')
}))

test('a damaged installed patch does not count as installed, so the same patch number is downloaded again', () => withSetup(async ({updater, input, publish, store, directory}) => {
    publish(await pack({[WEAPONS]: {weapons: [{name: 'Good'}]}}))
    assert.equal((await updater.check(input())).status, 'installed')
    await store.activatePending()
    assert.equal(await store.latestPatch(), '7.2.05EA.01')
    const damaged = path.join(directory, 'patches', 'current', 'files', 'weapons.json')
    const bytes = await readFile(damaged); bytes[bytes.length - 3] ^= 1; await writeFile(damaged, bytes)
    assert.equal((await store.load('7.2.05EA')).stage, '哈希')
    assert.equal(await store.latestPatch(), null, 'a damaged patch is not an installed patch')
    const again = await updater.check(input())
    assert.deepEqual([again.status, again.patch], ['installed', '7.2.05EA.01'], 'the same patch number is repaired by downloading it again')
    assert.equal(await store.pendingPatch(), '7.2.05EA.01')
    await store.activatePending()
    assert.equal((await store.load('7.2.05EA')).status, 'applied')
}))

test('a patch for another base version is ignored without downloading its files', () => withSetup(async ({updater, input, hits, publish, store}) => {
    publish(await pack(undefined, {min: '7.2.06', max: '7.2.06.99'}))
    const result = await updater.check(input())
    assert.equal(result.status, 'not-applicable')
    assert.match(result.reason, /只适用于/)
    assert.deepEqual(filesHit(hits), [])
    assert.equal(await store.latestPatch(), null)
}))

test('a manifest signed with another key is refused before any file is downloaded', () => withSetup(async ({updater, input, hits, publish, store}) => {
    publish(await makeSignedPackage(other.privateKey))
    const result = await updater.check(input())
    assert.equal(result.status, 'failed')
    assert.equal(result.stage, '签名')
    assert.deepEqual(filesHit(hits), [])
    assert.equal(await store.latestPatch(), null)
}))

test('a tampered, oversized or missing file is refused and nothing is installed', () => withSetup(async ({updater, input, routes, publish, store}) => {
    const good = await pack({[WEAPONS]: {weapons: [{name: 'Good'}]}})
    publish(good)
    const original = routes.get('/files/weapons.json').body
    const sameSize = new Uint8Array(original); sameSize[sameSize.length - 3] ^= 1
    routes.set('/files/weapons.json', {body: sameSize})
    assert.deepEqual(await updater.check(input()).then(r => [r.status, r.stage]), ['failed', '哈希'])
    routes.set('/files/weapons.json', {body: new Uint8Array(Buffer.concat([original, Buffer.from('padding')]))})
    assert.deepEqual(await updater.check(input()).then(r => [r.status, r.stage]), ['failed', '哈希'])
    routes.delete('/files/weapons.json')
    const missing = await updater.check(input())
    assert.deepEqual([missing.status, missing.stage], ['failed', '下载'])
    assert.equal(await store.latestPatch(), null)
    routes.set('/files/weapons.json', {body: original})
    assert.equal((await updater.check(input())).status, 'installed', 'a failed check must not be remembered as done: the next check retries')
}))

test('an interrupted download, a hanging server and an unreachable server fail quietly with the stage', () => withSetup(async ({updater, input, routes, publish, store, url}) => {
    publish(await pack({[WEAPONS]: {weapons: [{name: 'Interrupted'}]}}))
    routes.get('/files/weapons.json').truncate = true
    const interrupted = await updater.check(input())
    assert.deepEqual([interrupted.status, interrupted.stage], ['failed', '下载'])
    assert.equal(await store.latestPatch(), null)
    routes.get('/manifest.json').hang = true
    const hanging = await updater.check(input())
    assert.deepEqual([hanging.status, hanging.stage], ['failed', '下载'])
    const unreachable = await updater.check(input({baseUrl: 'http://127.0.0.1:9'}))
    assert.deepEqual([unreachable.status, unreachable.stage], ['failed', '下载'])
    assert.match(unreachable.reason, /无法访问/)
}))

test('missing or malformed configuration is reported, an empty configuration is simply off', () => withSetup(async ({updater, input, hits}) => {
    assert.equal((await updater.check({version: '7.2.05EA', baseUrl: '', publicKey})).status, 'disabled')
    assert.equal((await updater.check({version: '7.2.05EA', baseUrl: 'http://127.0.0.1', publicKey: ''})).status, 'disabled')
    for (const baseUrl of ['http://example.com/patches', 'https://user:pass@example.com', 'https://example.com/?x=1', 'not a url']) {
        const result = await updater.check(input({baseUrl}))
        assert.deepEqual([result.status, result.stage], ['failed', '配置'], baseUrl)
    }
    assert.equal((await updater.check(input({publicKey: 'AAAA'}))).stage, '配置')
    assert.deepEqual(hits, [], 'no request may be sent for a bad configuration')
}))

test('two checks at the same time share one run', () => withSetup(async ({updater, input, hits, publish}) => {
    publish(await pack())
    const [first, second] = await Promise.all([updater.check(input()), updater.check(input())])
    assert.equal(first, second)
    assert.equal(hits.filter(hit => hit.startsWith('/manifest.json')).length, 1)
}))

test('the local server runs the check and reports the last result', () => withSetup(async ({updater, input, publish, store}) => {
    publish(await pack())
    const server = createLocalServer({patchStore: store, patchUpdater: updater, credentialStore: {}})
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const call = async (route, body) => {
        const response = await fetch('http://127.0.0.1:' + server.address().port + route, {method: body ? 'POST' : 'GET', headers: {'x-mona-local': '1', 'Content-Type': 'application/json'}, body: body && JSON.stringify(body)})
        return {status: response.status, body: await response.json()}
    }
    try {
        const checked = await call('/api/patch/check', input())
        assert.deepEqual([checked.status, checked.body.status, checked.body.patch], [200, 'installed', '7.2.05EA.01'])
        assert.equal((await call('/api/patch/status')).body.patch, '7.2.05EA.01')
        const refused = await fetch('http://127.0.0.1:' + server.address().port + '/api/patch/check', {method: 'POST', body: '{}'})
        assert.equal(refused.status, 403)
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}))

const memoryStorage = (initial = {}) => { const data = {...initial}; return {getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = String(value) }} }
const reply = (body, ok = true, status = 200) => async () => ({ok, status, json: async () => body})

test('the page checker stays off without configuration, on Android or when the player turned it off', async () => {
    let calls = 0
    const fetchImpl = async () => { calls++; return {ok: true, json: async () => ({status: 'none'})} }
    const make = extra => createPatchChecker({fetchImpl, version: '7.2.05EA', baseUrl: 'https://example.com/p', publicKey: 'key', storage: memoryStorage(), native: false, log: () => {}, ...extra})
    assert.equal((await make({baseUrl: ''})()).status, 'disabled')
    assert.equal((await make({publicKey: ''})()).status, 'disabled')
    assert.match((await make({native: true})()).reason, /Android/)
    const off = memoryStorage(); assert.equal(setAutomaticPatchEnabled(false, off), true)
    assert.equal(isAutomaticPatchEnabled(off), false)
    assert.match((await make({storage: off})()).reason, /已关闭/)
    assert.equal(calls, 0, 'a disabled checker must not touch the network')
    assert.equal(isAutomaticPatchEnabled(memoryStorage()), true, 'on by default')
})

test('the page checker sends the version, address and key, throttles repeats and reports failures', async () => {
    const requests = [], logged = []
    let clock = 1_000_000, answer = {status: 'installed', patch: 'p'}
    const check = createPatchChecker({fetchImpl: async (url, options) => { requests.push({url, body: JSON.parse(options.body), headers: options.headers}); return {ok: true, status: 200, json: async () => answer} },
        version: '7.2.05EA', baseUrl: 'https://example.com/p', publicKey: 'key', storage: memoryStorage(), native: false, now: () => clock, minGap: 600000, log: text => logged.push(text)})
    assert.equal((await check()).status, 'installed')
    assert.deepEqual(requests[0], {url: '/api/patch/check', body: {version: '7.2.05EA', baseUrl: 'https://example.com/p', publicKey: 'key'}, headers: requests[0].headers})
    assert.equal(requests[0].headers['x-mona-local'], '1')
    await check(); clock += 599999; await check()
    assert.equal(requests.length, 1, 'repeats inside the minimum gap reuse the last result')
    clock += 2; answer = {status: 'failed', stage: '哈希', reason: 'x'}
    assert.equal((await check()).status, 'failed')
    assert.equal(requests.length, 2)
    assert.match(logged.join('\n'), /保持现有数据/)
    await check({force: true})
    assert.equal(requests.length, 3, 'force ignores the gap')
    const down = await createPatchChecker({fetchImpl: async () => { throw new Error('refused') }, version: 'v', baseUrl: 'https://e.com', publicKey: 'k', storage: memoryStorage(), native: false, log: () => {}})()
    assert.equal(down.status, 'unavailable'); assert.match(down.reason, /refused/)
    const broken = await createPatchChecker({fetchImpl: reply({error: '服务出错'}, false, 502), version: 'v', baseUrl: 'https://e.com', publicKey: 'k', storage: memoryStorage(), native: false, log: () => {}})()
    assert.deepEqual(broken, {status: 'unavailable', reason: '服务出错'})
})

test('startPatchChecks checks at once, then on a timer, and stops', async () => {
    const calls = []
    let tick, cleared = false
    const started = startPatchChecks({check: async options => { calls.push(options ?? null); return {status: 'none'} }, interval: 1234,
        setTimer: (fn, ms) => { tick = fn; assert.equal(ms, 1234); return 7 }, clearTimer: id => { cleared = id === 7 }})
    assert.deepEqual(calls, [null])
    tick(); assert.deepEqual(calls[1], {force: true})
    started.requestCheck(); assert.equal(calls.length, 3)
    started.stop(); assert.equal(cleared, true)
})
