import test from 'node:test'
import assert from 'node:assert/strict'
import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import vueConfig from '../vue.config.js'
import { CredentialStore } from '../server/credentials.mjs'

async function startDevServer(t) {
    const compiler = webpack({ mode: 'development', entry: {}, infrastructureLogging: { level: 'none' } })
    const dev = new WebpackDevServer({
        host: '127.0.0.1', port: 0, hot: false, liveReload: false, client: false, webSocketServer: false,
        static: false, devMiddleware: { stats: 'none' }, setupMiddlewares: vueConfig.devServer.setupMiddlewares,
    }, compiler)
    await dev.start()
    t.after(() => dev.stop())
    return `http://127.0.0.1:${dev.server.address().port}`
}

test('UID account requests use the local handler at the Vue page origin', async t => {
    t.mock.method(CredentialStore.prototype, 'all', async () => [])
    const origin = await startDevServer(t)
    const headers = { Origin: origin, 'X-Mona-Local': '1', 'Content-Type': 'application/json' }
    const accounts = await fetch(origin + '/api/mys/accounts', { headers })
    assert.equal(accounts.status, 200)
    assert.deepEqual(await accounts.json(), { accounts: [], activeId: null })
    const selection = await fetch(origin + '/api/mys/select', {
        method: 'POST', headers, body: JSON.stringify({ id: 'synthetic-account' }),
    })
    assert.equal(selection.status, 404)
    assert.deepEqual(await selection.json(), { error: '已保存账号不存在，请添加账号' })
    for (const invalid of [{ Origin: origin }, { ...headers, Origin: 'https://unrelated.invalid' }]) {
        assert.equal((await fetch(origin + '/api/mys/accounts', { headers: invalid })).status, 403)
    }
})

test('development serves calculation sessions, updates and usage stats at the page origin', async t => {
    const browserFetch = globalThis.fetch
    const origin = await startDevServer(t)
    const headers = { Origin: origin, 'X-Mona-Local': '1' }
    const session = await browserFetch(origin + '/api/calculation/session', { headers })
    assert.equal(session.status, 200)
    assert.equal(typeof (await session.json()).id, 'string')
    const info = await browserFetch(origin + '/api/update/info', { headers })
    assert.equal(info.status, 200)
    assert.equal(typeof (await info.json()).canInstall, 'boolean')
    const upstream = t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(String(url), 'https://synthetic.invalid/v1/usage-stats')
        assert.equal(options.method, 'POST')
        return Response.json({ accepted: true })
    })
    const stats = await browserFetch(origin + '/api/usage-stats', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Mona-Usage-Stats-Url': 'https://synthetic.invalid' },
        body: '{}',
    })
    assert.equal(stats.status, 200)
    assert.deepEqual(await stats.json(), { accepted: true })
    assert.equal(upstream.mock.callCount(), 1)
})

process.env.VUE_APP_MONA_CLOUD_URL = 'https://cloud.example.test'

test('the Vue development page requests a code through its own origin and the desktop gateway', async t => {
    const browserFetch = globalThis.fetch
    t.mock.method(CredentialStore.prototype, 'get', async () => undefined)
    const upstream = t.mock.method(globalThis, 'fetch', async (url, init) => {
        assert.equal(url, 'https://cloud.example.test/v1/auth/email/request')
        assert.deepEqual(JSON.parse(init.body), { email: 'synthetic@example.test' })
        return Response.json({ challengeId: 'synthetic' })
    })
    const origin = await startDevServer(t)
    const response = await browserFetch(origin + '/api/cloud/v1/auth/email/request', {
        method: 'POST', headers: { Origin: origin, 'X-Mona-Local': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'synthetic@example.test' }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { challengeId: 'synthetic' })
    const missingLocalHeader = await browserFetch(origin + '/api/cloud/config')
    assert.equal(missingLocalHeader.status, 403)
    assert.equal(upstream.mock.callCount(), 1)
})
