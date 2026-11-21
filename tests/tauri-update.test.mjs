import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createInterface} from 'node:readline'
import {fileURLToPath} from 'node:url'
import {LocalUpdater} from '../server/updates.mjs'
import {installTauriUpdate} from '../server/tauri-update-worker.mjs'

const windows = {skip: process.platform !== 'win32'}
const worker = fileURLToPath(new URL('../server/tauri-update-worker.mjs', import.meta.url))
async function workspace(t) {
    const base = path.resolve('.cache/test/tauri-update')
    await mkdir(base, {recursive: true})
    const root = await mkdtemp(path.join(base, 'case-'))
    t.after(() => rm(root, {recursive: true, force: true, maxRetries: 10, retryDelay: 200}))
    return root
}
const tag = 'v7.2.07', exe = 'genshin_artifact_V7.2.07_tauri_x64.exe'
const github = 'https://github.com/TwiceDrop/genshin_artifact/releases'
const cnb = 'https://cnb.cool/twicedrop/genshin_artifact/-/releases'

test('packaged backend entry reports Tauri and waits for host acknowledgement before requesting exit', {...windows, timeout: 20000}, async t => {
    const root = await workspace(t), project = fileURLToPath(new URL('../', import.meta.url))
    await cp(path.join(project, 'server'), path.join(root, 'server'), {recursive: true,
        filter: file => !file.endsWith('.local.json')})
    await mkdir(path.join(root, 'beta-data'))
    await copyFile(path.join(project, 'beta-data/data-overlay.mjs'), path.join(root, 'beta-data/data-overlay.mjs'))
    await copyFile(path.join(project, 'tauri-exe/start-server.mjs'), path.join(root, 'start-server.mjs'))
    const metadata = {tag_name: tag, assets: [{name: exe, size: 4}]}
    await writeFile(path.join(root, 'source.mjs'), `globalThis.fetch = async url => {
        if (url === ${JSON.stringify(cnb + '/latest')}) return Response.json(${JSON.stringify(metadata)})
        if (url === ${JSON.stringify(cnb + '/download/' + tag + '/' + exe)}) return new Response('test')
        throw new Error('Unexpected URL')
    }`)
    const server = spawn(process.execPath, ['--import', './source.mjs', 'start-server.mjs'], {cwd: root, windowsHide: true,
        env: {...process.env, MONA_PORT: '0', MONA_DATA_DIR: path.join(root, 'data', 'credentials')}})
    t.after(() => server.kill())
    const output = createInterface({input: server.stdout})[Symbol.asyncIterator]()
    const {port} = JSON.parse((await output.next()).value)
    const call = async (action, body) => {
        const result = await fetch('http://127.0.0.1:' + port + '/api/update/' + action, {method: body ? 'POST' : 'GET',
            headers: {'x-mona-local': '1', 'Content-Type': 'application/json'}, body: body && JSON.stringify(body)})
        return result.json()
    }
    assert.deepEqual(await call('info'), {kind:'tauri', canInstall:true})
    await call('latest', {currentVersion:'7.2.06'})
    await call('download', {version:tag, source:'cnb'})
    while ((await call('status')).phase === 'downloading') await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal((await call('status')).phase, 'ready')
    for (const success of [false, true]) {
        const install = call('install', {})
        const line = (await output.next()).value
        assert.ok(line.startsWith('MONA_TAURI_PREPARE '))
        const file = JSON.parse(line.slice('MONA_TAURI_PREPARE '.length))
        assert.equal(path.dirname(path.dirname(file)), path.join(root,'data','updates'))
        assert.equal(await readFile(file, 'utf8'), 'test')
        server.stdin.write(JSON.stringify(success ? {ready:true} : {error:'synthetic preflight error'}) + '\n')
        const result = await install
        if (success) assert.equal(result.phase,'installing')
        else assert.match(result.error,/synthetic preflight error/)
    }
    assert.equal((await output.next()).value,'MONA_TAURI_INSTALL')
    const exit = once(server,'exit'); server.stdin.end(); await exit
})

for (const channel of ['cnb', 'github']) test(`Tauri selects only its EXE via ${channel}, verifies it and hands it to the host`, windows, async t => {
    const directory = await workspace(t), bytes = Buffer.from('synthetic release'), requests = []
    const asset = name => ({name, size: bytes.length, digest: 'sha256:' + createHash('sha256').update(bytes).digest('hex'),
        browser_download_url: github + '/download/' + tag + '/' + name})
    const assets = ['client_web.zip', 'client_windows_x64_setup.exe', 'client_android.apk'].map(asset)
    const release = {tag_name: tag, html_url: github + '/tag/' + tag, assets}
    let fail = true
    const updater = new LocalUpdater({directory, prepareTauriInstall: async file => {
        assert.equal(path.basename(file), 'package.exe')
        assert.deepEqual(await readFile(file), bytes)
        if (fail) throw new Error('synthetic handoff failure')
    }, fetchImpl: async (url, options) => {
        if (url.endsWith('/latest')) {
            if (channel === 'github' && url.startsWith(cnb)) return new Response(null, {status: 503})
            return Response.json(release)
        }
        requests.push(url)
        assert.equal(url, (channel === 'github' ? github : cnb) + '/download/' + tag + '/' + exe)
        return new Response(bytes, {status: options.headers.Range ? 206 : 200})
    }})
    assert.deepEqual(updater.info(), {kind: 'tauri', canInstall: true})
    await updater.latest(false, '7.2.06')
    await assert.rejects(updater.start(tag, channel), /缺少对应的更新包/)
    assets.push(asset(exe))
    assets.at(-1).digest = 'sha256:' + '0'.repeat(64)
    await updater.latest(false, '7.2.06')
    await updater.start(tag, channel); await updater.task
    assert.equal(updater.status().phase, 'error')
    await assert.rejects(updater.install(47504), /尚未下载完成/)
    assets[assets.length - 1] = asset(exe)
    await updater.latest(false, '7.2.06')
    await updater.probe(tag, channel)
    await updater.start(tag, channel); await updater.task
    await assert.rejects(updater.install(47504), /synthetic handoff failure/)
    assert.equal(updater.status().phase, 'ready')
    fail = false
    assert.equal((await updater.install(47504)).phase, 'installing')
    await assert.rejects(updater.install(47504), /尚未下载完成/)
    assert.equal(requests.length, 3)
})

test('Windows worker waits for handoff and both old processes, replaces and relaunches a renamed EXE', windows, async t => {
    const root = await workspace(t), download = path.join(root, 'download')
    await mkdir(download)
    const target = path.join(root, '玩家 自定义.exe'), file = path.join(download, 'package.exe'), state = path.join(root, 'running.json')
    await writeFile(target, 'old running version')
    // Use the installed Node executable as a synthetic Windows application, without building one.
    await copyFile(process.execPath, file)
    const preload = path.join(root, 'signal-ready.cjs')
    await writeFile(preload, `if (process.execPath === ${JSON.stringify(target)}) {
        require('node:fs').writeFileSync(${JSON.stringify(state)}, JSON.stringify({applicationPid:process.pid,port:47504}));
        setTimeout(()=>process.exit(), 1250);
    }`)
    const old = () => spawn(process.execPath, ['-e', 'process.stdin.resume()'], {stdio: ['pipe','ignore','ignore'], windowsHide: true})
    const app = old(), backend = old()
    t.after(() => { app.stdin.end(); backend.stdin.end() })
    const child = spawn(process.execPath, [worker, file, target, String(app.pid), String(backend.pid), state],
        {windowsHide: true, env: {...process.env, NODE_OPTIONS: '--require=' + JSON.stringify(preload.replaceAll('\\','/'))}})
    const done = once(child, 'exit')
    t.after(() => child.kill())
    const lines = createInterface({input: child.stdout})[Symbol.asyncIterator]()
    assert.equal((await lines.next()).value, 'READY')
    assert.equal(await readFile(target, 'utf8'), 'old running version')
    child.stdin.end('INSTALL\n')
    const appExit = once(app, 'exit'); app.stdin.end(); await appExit
    assert.equal(await readFile(target, 'utf8'), 'old running version')
    backend.stdin.end()
    assert.deepEqual(await done, [0, null])
    const {applicationPid} = JSON.parse(await readFile(state))
    assert.ok(applicationPid > 0)
    assert.deepEqual(await readFile(target), await readFile(process.execPath))
})

test('invalid package keeps old app open; failed replacement launch restores and restarts original', windows, async t => {
    const root = await workspace(t), file = path.join(root,'package.exe'), target = path.join(root,'current.exe')
    const original = 'original fixture'
    await writeFile(target, original); await writeFile(file, 'not an executable')
    const old = spawn(process.execPath, ['-e',''], {windowsHide:true})
    await once(old,'exit')
    let confirmed = false, launches = 0
    const options = {file, target, appPid: old.pid, serverPid: old.pid, confirm: async () => { confirmed = true },
        start: async actual => {
            launches++
            if (launches === 1) throw new Error('synthetic launch error')
            assert.equal(actual, target)
            assert.equal(await readFile(actual,'utf8'), original)
        }}
    await assert.rejects(installTauriUpdate(options), /x64 Windows/)
    assert.equal(confirmed, false)
    await copyFile(process.execPath,file)
    await assert.rejects(installTauriUpdate(options), /synthetic launch error/)
    assert.equal(launches, 2)
    assert.equal(await readFile(target,'utf8'), original)
})
