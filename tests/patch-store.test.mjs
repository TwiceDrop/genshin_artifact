import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {PatchStore} from '../server/patch-store.mjs'
import {createLocalServer} from '../server/local.mjs'
import {loadPatchOverlay} from '../src/platform/patch-overlay.mjs'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {composeKernelApi} from '../beta-data/compose-kernel-api.mjs'
import {rawOriginal, core, extension, data, api} from '../beta-tools/runtime.mjs'

// 临时目录放在被忽略的 .cache/test 下，每个测试用完删除
const base = fileURLToPath(new URL('../.cache/test/patch-store/', import.meta.url))
await mkdir(base, {recursive: true})
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const WEAPONS = PATCHABLE_DATA.weapons, SIGNATURE = PATCHABLE_DATA.signatureWeapons

// 合成补丁：{path: 内容}，baseVersion 默认只适用于 7.2.05EA
function makePatch(contents = {[WEAPONS]: {weapons: [{name: 'Synthetic'}]}}, {patch = '7.2.05EA.01', min = '7.2.05EA', max = '7.2.05EA.99'} = {}) {
    const files = Object.fromEntries(Object.entries(contents).map(([file, value]) => [file, Buffer.from(JSON.stringify(value))]))
    return {manifest: {patch, createdAt: '2026-11-20T00:00:00Z', baseVersion: {min, max}, files: Object.entries(files).map(([file, bytes]) => ({path: file, sha256: sha(bytes), size: bytes.length}))}, files}
}
async function withStore(run) {
    const directory = await mkdtemp(base)
    try { return await run(new PatchStore({directory}), directory) } finally { await rm(directory, {recursive: true, force: true}) }
}
const activated = async (store, patch) => { await store.install(patch); await store.activatePending() }

test('a freshly installed patch only takes effect after the next activation', () => withStore(async store => {
    assert.deepEqual(await store.load('7.2.05EA'), {status: 'none'})
    await store.install(makePatch())
    assert.deepEqual(await store.load('7.2.05EA'), {status: 'none'}, 'installing must not change what the running app reads')
    await store.activatePending()
    const loaded = await store.load('7.2.05EA')
    assert.equal(loaded.status, 'applied')
    assert.equal(loaded.patch, '7.2.05EA.01')
    assert.deepEqual(loaded.overlay, {weapons: {weapons: [{name: 'Synthetic'}]}})
    assert.deepEqual(loaded.files.map(file => file.path), [WEAPONS])
}))

test('a newer install replaces the pending patch and the next activation replaces the current one', () => withStore(async store => {
    await activated(store, makePatch(undefined, {patch: '7.2.05EA.01'}))
    await store.install(makePatch({[SIGNATURE]: {weapons: []}}, {patch: '7.2.05EA.02'}))
    assert.equal((await store.load('7.2.05EA')).patch, '7.2.05EA.01')
    await store.activatePending()
    const loaded = await store.load('7.2.05EA')
    assert.equal(loaded.patch, '7.2.05EA.02')
    assert.deepEqual(Object.keys(loaded.overlay), ['signatureWeapons'])
}))

test('install refuses files outside the registry, mismatching bytes and a manifest that disagrees with the files', () => withStore(async store => {
    const reject = async (patch, stage) => assert.rejects(store.install(patch), error => error.code === 'PATCH_PACKAGE' && error.stage === stage)
    await reject(makePatch({'beta-data/team-engine/character-packages.mjs': {}}), '路径')
    await reject(makePatch({'../outside.json': {}}), '路径')
    const tampered = makePatch(); tampered.files[WEAPONS] = Buffer.from('{"weapons":[]}')
    await reject(tampered, '哈希')
    const extra = makePatch(); extra.files[SIGNATURE] = Buffer.from('{}')
    await reject(extra, '路径')
    const missing = makePatch(); delete missing.files[WEAPONS]
    await reject(missing, '路径')
    const noRange = makePatch(); noRange.manifest.baseVersion = {min: 'x', max: '7.2.05EA'}
    await reject(noRange, '清单')
    assert.deepEqual(await readdir(store.directory), [], 'a refused install must leave nothing behind')
}))

test('a patch whose file was changed on disk is rejected with the stage and the original data keeps being used', () => withStore(async (store, directory) => {
    await activated(store, makePatch())
    await writeFile(path.join(directory, 'current', 'files', 'weapons.json'), '{"weapons":[]}')
    const loaded = await store.load('7.2.05EA')
    assert.equal(loaded.status, 'rejected')
    assert.equal(loaded.stage, '哈希')
    assert.match(loaded.reason, /weapons-release-71\.json/)
    assert.equal(loaded.overlay, undefined)
}))

test('a damaged manifest and a file that is not JSON are rejected, not thrown', () => withStore(async (store, directory) => {
    const notJson = Buffer.from('not json')
    await activated(store, {manifest: {patch: '7.2.05EA.01', createdAt: '2026-11-20T00:00:00Z', baseVersion: {min: '7.2.05EA', max: '7.2.05EA.99'}, files: [{path: WEAPONS, sha256: sha(notJson), size: notJson.length}]}, files: {[WEAPONS]: notJson}})
    assert.equal((await store.load('7.2.05EA')).stage, '解析')
    await writeFile(path.join(directory, 'current', 'manifest.json'), '{broken')
    assert.equal((await store.load('7.2.05EA')).stage, '清单')
}))

test('a patch only applies inside its base version range and is ignored after the app is upgraded', () => withStore(async store => {
    await activated(store, makePatch(undefined, {min: '7.2.05EA', max: '7.2.05EA.99'}))
    assert.equal((await store.load('7.2.05EA')).status, 'applied')
    assert.equal((await store.load('7.2.05EA.50')).status, 'applied')
    for (const version of ['7.2.04', '7.2.05', '7.2.06EA']) assert.equal((await store.load(version)).stage, '版本', version)
    assert.equal((await store.load('unknown')).stage, '版本')
    assert.equal((await store.load('')).stage, '版本')
    assert.equal((await store.load('7.2.05EA')).status, 'applied', 'ignoring an out-of-range patch must not delete it')
}))

test('an interrupted install or activation is recovered on the next start', () => withStore(async (store, directory) => {
    await activated(store, makePatch(undefined, {patch: '7.2.05EA.01'}))
    // 换到一半断电：current 已改名为 .old-current-x，新的还没就位
    await rename(path.join(directory, 'current'), path.join(directory, '.old-current-aaaa'))
    await mkdir(path.join(directory, '.staging-bbbb', 'files'), {recursive: true})
    await store.activatePending()
    assert.equal((await store.load('7.2.05EA')).patch, '7.2.05EA.01')
    assert.deepEqual((await readdir(directory)).sort(), ['current'])
}))

test('rollback removes the current and the pending patch', () => withStore(async store => {
    await activated(store, makePatch())
    await store.install(makePatch(undefined, {patch: '7.2.05EA.02'}))
    await store.rollback()
    await store.activatePending()
    assert.deepEqual(await store.load('7.2.05EA'), {status: 'none'})
    assert.deepEqual(await readdir(store.directory), [])
}))

const get = async (server, query) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/patch/overlay' + query, {headers: {'x-mona-local': '1'}})
    return {status: response.status, body: await response.json()}
}
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections() })

test('the local server activates the pending patch once, then keeps serving the same one for the whole run', () => withStore(async store => {
    await store.install(makePatch(undefined, {patch: '7.2.05EA.01'}))
    const server = createLocalServer({patchStore: store, credentialStore: {}})
    await listen(server)
    try {
        const first = await get(server, '?version=7.2.05EA')
        assert.equal(first.body.status, 'applied')
        assert.equal(first.body.patch, '7.2.05EA.01')
        await store.install(makePatch(undefined, {patch: '7.2.05EA.02'}))
        assert.equal((await get(server, '?version=7.2.05EA')).body.patch, '7.2.05EA.01', 'a patch installed during the run waits for the next start')
        assert.equal((await get(server, '?version=7.2.06')).body.stage, '版本')
        const refused = await fetch('http://127.0.0.1:' + server.address().port + '/api/patch/overlay?version=7.2.05EA')
        assert.equal(refused.status, 403, 'requests without the local header are refused like every other api')
    } finally { await close(server) }
}))

test('the page loader returns the patch, and reports why it runs on the packaged data otherwise', async () => {
    const reply = (body, ok = true, status = 200) => async () => ({ok, status, json: async () => body})
    const logged = []
    const log = (...args) => logged.push(args.join(' '))
    assert.equal((await loadPatchOverlay({fetchImpl: reply({status: 'applied', patch: 'p', overlay: {weapons: {}}}), version: '7.2.05EA', log})).overlay.weapons !== undefined, true)
    assert.deepEqual(await loadPatchOverlay({fetchImpl: reply({status: 'none'}), version: '7.2.05EA', log}), {status: 'none'})
    assert.equal(logged.length, 0, 'having no patch is normal and must not log')
    const rejected = await loadPatchOverlay({fetchImpl: reply({status: 'rejected', stage: '哈希', reason: '内容补丁哈希：x'}), version: '7.2.05EA', log})
    assert.equal(rejected.status, 'rejected')
    assert.match(logged.join('\n'), /内容补丁哈希：x/)
    const urls = []
    await loadPatchOverlay({fetchImpl: async url => { urls.push(url); return {ok: true, status: 200, json: async () => ({status: 'none'})} }, version: '7.2.05EA', log})
    assert.equal(urls[0], '/api/patch/overlay?version=7.2.05EA')
    const down = await loadPatchOverlay({fetchImpl: async () => { throw new Error('connect refused') }, version: '7.2.05EA', log})
    assert.equal(down.status, 'unavailable'); assert.match(down.reason, /connect refused/)
    const html = await loadPatchOverlay({fetchImpl: async () => ({ok: true, status: 200, json: async () => { throw new SyntaxError('<') }}), version: '7.2.05EA', log})
    assert.equal(html.status, 'unavailable'); assert.match(html.reason, /HTTP 200/)
    const failed = await loadPatchOverlay({fetchImpl: reply({error: '服务出错'}, false, 502), version: '7.2.05EA', log})
    assert.deepEqual(failed, {status: 'unavailable', reason: '服务出错'})
})

test('a patch stored on disk reaches the calculation: install, activate, load and compose', () => withStore(async store => {
    const patched = structuredClone(data.signatureWeapons)
    patched.weapons.find(w => w.name === 'BeyondTheChrysalis').levels.find(r => r.level === 90 && !r.ascend).subStat += 0.1
    await activated(store, makePatch({[SIGNATURE]: patched}))
    const {overlay} = await store.load('7.2.05EA')
    const crit = kernel => Object.values(kernel.CommonInterface.get_attribute({character: {name: 'Kaeya', level: 90, ascend: false, constellation: 0, skill1: 9, skill2: 9, skill3: 9, params: 'NoConfig'},
        weapon: {name: 'BeyondTheChrysalis', level: 90, ascend: false, refine: 1, params: {BeyondTheChrysalis: {loyal_wind: false, rebel_wind: false, on_field: true}}}, artifacts: [], artifact_config: null, buffs: []}).critical_damage).reduce((a, b) => a + b, 0)
    const result = composeKernelApi({rawOriginal, core, extension, data, overlay}).api
    assert.ok(Math.abs(crit(result) - (crit(api) + 0.1)) < 1e-9)
}))
