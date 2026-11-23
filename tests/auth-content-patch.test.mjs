import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises'
import {createLocalServer} from '../server/local.mjs'
import {PatchStore} from '../server/patch-store.mjs'
import {communityClient} from '../server/hoyolab.mjs'
import {MIHOYO_API} from '../server/vendor/twicedrop/mihoyo-api.mjs'
import {AUTH_PROGRAMS, compileProjection} from '../server/auth-programs.mjs'
import {buildPatchPackage, generateKeyFiles} from '../beta-tools/patch-tool.mjs'
import {communityAccount} from '../server/cookie.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const qrPath = 'server/auth-rules/qr-exchange.json', cookiePath = 'server/auth-rules/cloud-import.json'
const version = '7.3.0'
const listen = async server => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return 'http://127.0.0.1:' + server.address().port
}
const close = server => new Promise(resolve => server.close(resolve))
const sample = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'))

test('signed auth rules hot-swap through the local HTTP API, survive restart and roll back', async t => {
    const cache = path.join(root, '.cache/test/auth-patch')
    await mkdir(cache, {recursive: true})
    const dir = await mkdtemp(path.join(cache, 'run-'))
    t.after(() => rm(dir, {recursive: true, force: true}))
    const keys = await generateKeyFiles({out: path.join(dir, 'test')})
    const sourceRoot = path.join(dir, 'source')
    await mkdir(path.join(sourceRoot, 'server/auth-rules'), {recursive: true})
    let published = new Map()
    async function build(patch, qr, cookie, signingKeyFile = keys.privateFile) {
        await writeFile(path.join(sourceRoot, qrPath), JSON.stringify(qr))
        await writeFile(path.join(sourceRoot, cookiePath), JSON.stringify(cookie))
        const out = await mkdtemp(path.join(dir, 'pack-'))
        await buildPatchPackage({paths: [qrPath, cookiePath], baseMin: version, baseMax: version, patch, out, sourceRoot, signingKeyFile})
        const entries = ['manifest.json', 'manifest.sig', ...[...AUTH_PROGRAMS.values()].map(name => 'files/' + name + '.json')]
        published = new Map(await Promise.all(entries.map(async name => ['/auth/' + name, await readFile(path.join(out, name))])))
    }
    const upstream = http.createServer((req, res) => {
        const data = published.get(req.url)
        res.writeHead(data ? 200 : 404)
        res.end(data)
    })
    const baseUrl = await listen(upstream)
    t.after(() => close(upstream))
    const saved = new Map()
    const credentialStore = {get: id => saved.get(id), upsert: row => saved.set(row.id, row)}
    const calls = []
    async function passport(url, options) {
        let data
        if (url === MIHOYO_API.createQr) data = {url: 'https://user.mihoyo.com/qr', ticket: 'fixture-ticket'}
        else if (url === MIHOYO_API.queryQr) data = {status: 'Confirmed', user_info: {aid: '123', mid: 'fixture-mid'}, tokens: [{token_type: 1, token: 'fixture-s'}]}
        else if (url === MIHOYO_API.exchangeV2) {
            assert.equal(options.redirect, 'error')
            calls.push(JSON.parse(options.body))
            data = {result: {value: 'fixture-l', kind: 2}, user_info: {aid: '123', mid: 'fixture-mid'}}
        } else if (String(url).includes('/binding/api/getUserGameRolesByCookie?')) data = {list: [{region: 'cn_gf01', game_uid: '123456789'}]}
        else throw new Error('unexpected fixture request')
        return Response.json({retcode: 0, data})
    }
    const options = {allowMiyousheQr: true, clientFactory: platform => communityClient(platform, passport), credentialStore,
        devAuthPatch: {version, publicKey: keys.publicKey, baseUrl}, patchStore: new PatchStore({directory: path.join(dir, 'patches')})}
    let server = createLocalServer(options), app = await listen(server)
    t.after(() => close(server))
    async function request(route, body, cookie) {
        const response = await fetch(app + '/api/' + route, {method: body ? 'POST' : 'GET', headers: {'x-mona-local': '1', ...(cookie && {cookie})},
            body: body && JSON.stringify(body)})
        return {status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0]}
    }
    const login = () => request('mys/login', {platform: 'miyoushe'})
    const poll = started => request('mys/poll', {}, started.cookie)
    const check = async (params = options.devAuthPatch) => (await request('patch/check', params)).data.auth
    const cloud = {source: 'cloud-vault', platform: 'miyoushe', cookie: 'ltuid_v2=123;ltoken_v2=fixture-l;cookie_token_v2=obsolete;'}
    const inFlight = await login()
    assert.equal((await request('mys/accounts', cloud)).status, 502)
    const qr = await sample(qrPath)
    qr.request.format = {$if: [{$read: 'mid'}, 2, 1]}
    qr.response.token = {token: {$read: 'result.value'}, token_type: {$read: 'result.kind'}}
    const cookie = await sample(cookiePath)
    cookie.fields.cookie_token_v2 = {$if: [{$read: 'ltmid_v2'}, {$read: 'cookie_token_v2'}, null]}
    await build('1', qr, cookie)
    assert.equal((await check()).status, 'installed')
    assert.equal((await poll(inFlight)).status, 502)
    assert.equal(calls.at(-1).format, undefined)
    const synced = await poll(await login())
    assert.equal(synced.data.status, 'Confirmed')
    assert.equal(synced.data.roles[0].uid, '123456789')
    assert.equal(calls.at(-1).format, 2)
    assert.equal((await request('mys/accounts', cloud)).status, 200)
    assert.equal(saved.get('123').cookie, 'ltuid_v2=123;ltoken_v2=fixture-l;')
    assert.equal((await request('mys/accounts', {...cloud, source: 'manual'})).status, 502)
    assert.equal((await request('patch/info?version=' + version)).data.current.status, 'none')
    await close(server)
    server = createLocalServer(options)
    app = await listen(server)
    assert.equal((await request('mys/accounts', cloud)).status, 200)
    const other = await generateKeyFiles({out: path.join(dir, 'other')})
    await build('2', null, null, other.privateFile)
    assert.equal((await check({...options.devAuthPatch, publicKey: other.publicKey})).stage, '签名')
    assert.equal((await request('patch/info?version=' + version)).data.auth.patch, '1')
    await build('2', null, null)
    published.get('/auth/files/qrExchange.json')[0] ^= 1
    assert.equal((await check()).stage, '哈希')
    assert.equal((await request('mys/accounts', cloud)).status, 200)
    await build('2', null, null)
    assert.equal((await check()).status, 'installed')
    assert.equal((await poll(await login())).status, 502)
    assert.equal((await request('mys/accounts', cloud)).status, 502)
    await close(server)
    const archive = path.join(dir, 'auth-patches/auth-programs.signed.json')
    const broken = JSON.parse(await readFile(archive, 'utf8'))
    broken.signature = Buffer.alloc(64).toString('base64')
    await writeFile(archive, JSON.stringify(broken))
    server = createLocalServer(options)
    app = await listen(server)
    const restored = (await request('patch/info?version=' + version)).data.auth
    assert.equal(restored.status, 'rejected')
    assert.equal(restored.stage, '签名')
    assert.equal((await check()).status, 'installed')
})

test('rules only read scalar own fields and cannot substitute a different credential family', () => {
    for (const expr of [{$read: 'constructor.name'}, {$read: '__proto__'}, {$eval: 'x'}, {$if: []}])
        assert.throws(() => compileProjection(expr), {stage: '程序'})
    assert.equal(compileProjection({$read: 'outer'})({outer: {secret: true}}), null)
    const fields = compileProjection({ltuid: {$read: 'ltuid'}, ltoken: {$read: 'cookie_token'}})
    assert.throws(() => communityAccount('ltuid=123;ltoken=test;cookie_token=other', 'miyoushe', {fields}), /字段映射无效/)
})
