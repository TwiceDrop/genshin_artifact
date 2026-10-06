import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, readFile, rm, access} from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import http from 'node:http'
import {EventEmitter} from 'node:events'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {LocalUpdater} from '../server/updates.mjs'
import {createLocalServer} from '../server/local.mjs'
import {releaseAsset, sourceUrl, fetchReleaseMetadata} from '../server/update-sources.mjs'
import {describeRelease} from '../src/platform/release-update.mjs'
const require = createRequire(import.meta.url)
const repository = 'https://github.com/TwiceDrop/genshin_artifact/releases/'
const metadata = size => ({tag_name: 'v7.1.10', html_url: repository + 'tag/v7.1.10', body: '合成更新',
    assets: ['windows_x64_setup.exe', 'web.zip', 'android.apk'].map(kind => ({
        name: 'genshin_artifact_V7.1.10_' + kind,
        browser_download_url: repository + 'download/v7.1.10/genshin_artifact_V7.1.10_' + kind, size,
    }))})
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const close = server => new Promise(resolve => {server.close(resolve); server.closeAllConnections()})
const psQuote = value => "'" + value.replaceAll("'", "''") + "'"
const powershell = code => execFileSync('powershell.exe',
    ['-NoProfile', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], {encoding: 'utf8', windowsHide: true})

test('1. release metadata uses an available source and selects EXE, ZIP, APK with correct version', async () => {
    const urls = []
    const release = await fetchReleaseMetadata(async url => {
        urls.push(url)
        if (url.startsWith('https://api.github.com')) throw new Error('合成直连失败')
        return new Response(JSON.stringify(metadata(128)), {headers: {'Content-Type': 'application/json'}})
    }, true)
    const described = describeRelease(release, '7.1.09')
    assert.equal(described.newer, true)
    assert.equal(described.version, 'v7.1.10')
    assert.match(releaseAsset(described, 'installer').name, /setup\.exe$/)
    assert.match(releaseAsset(described, 'portable').name, /web\.zip$/)
    assert.match(releaseAsset(described, 'android').name, /android\.apk$/)
    assert.ok(urls.some(url => url.startsWith('https://ghfast.top/https://api.github.com/')))
    assert.equal(sourceUrl('https://github.com/a', 'github'), 'https://github.com/a')
})

test('2. real local API downloads complete bytes; truncation and cancellation do not install; installer starts before tray exit signal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mona-update-api-'))
    let mode = 'short', signals = 0, command, argumentsList
    const payload = Buffer.alloc(65536, 42)
    const fixture = http.createServer((req, res) => {
        if (req.headers.range) {res.writeHead(206); res.end(payload.subarray(0, 16384)); return}
        if (mode === 'short') {res.end(payload.subarray(0, 10)); return}
        if (mode === 'slow') {res.write(payload.subarray(0, 10)); return}
        res.end(payload)
    })
    await listen(fixture)
    const updater = new LocalUpdater({root: path.resolve('.'), directory: root,
        fetchImpl: (url, options) => url.includes('/releases/latest') ?
            Promise.resolve(new Response(JSON.stringify(metadata(payload.length)))) :
            fetch('http://127.0.0.1:' + fixture.address().port + '/', options),
        launch: (exe, args) => {
            command = exe; argumentsList = args
            const child = new EventEmitter(); child.unref = () => {}
            queueMicrotask(() => child.emit('spawn'))
            return child
        }, notify: () => {signals++}})
    const server = createLocalServer({updater, credentialStore: {}})
    await listen(server)
    const api = async (name, body) => {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/update/' + name,
            {method: body === undefined ? 'GET' : 'POST', headers: {'x-mona-local': '1', 'Content-Type': 'application/json'},
                ...(body === undefined ? {} : {body: JSON.stringify(body)})})
        return {status: response.status, data: await response.json()}
    }
    const originalPid = process.env.MONA_LAUNCHER_PID
    try {
        process.env.MONA_LAUNCHER_PID = String(process.pid)
        assert.equal((await api('latest', {accelerated: false})).data.tag_name, 'v7.1.10')
        assert.equal((await api('probe', {version: 'v7.1.10', source: 'github'})).status, 200)
        await api('download', {version: 'v7.1.10', source: 'github'}); await updater.task
        assert.equal((await api('status')).data.phase, 'error')
        assert.match(updater.status().error, /下载不完整/)
        assert.equal((await api('install', {})).status, 502)
        assert.equal(signals, 0)
        await assert.rejects(access(updater.state.file + '.part'))
        mode = 'slow'
        await api('download', {version: 'v7.1.10', source: 'github'})
        assert.equal((await api('cancel', {})).data.phase, 'cancelled')
        assert.equal(signals, 0)
        mode = 'complete'
        await api('download', {version: 'v7.1.10', source: 'github'}); await updater.task
        assert.equal((await api('status')).data.phase, 'ready')
        assert.deepEqual(await readFile(updater.state.file), payload)
        const completedFile = updater.state.file
        assert.equal((await api('cancel', {})).data.phase, 'cancelled')
        assert.equal((await api('install', {})).status, 502)
        assert.equal(signals, 0)
        await assert.rejects(access(completedFile))
        await api('download', {version: 'v7.1.10', source: 'github'}); await updater.task
        assert.equal((await api('install', {})).data.phase, 'installing')
        assert.equal(command, 'powershell.exe')
        assert.ok(argumentsList.includes(String(server.address().port)))
        assert.equal(signals, 1)
        assert.match(await readFile(path.join(updater.state.directory, 'install-update.ps1'), 'utf8'), /Install-PortablePackage/)
    } finally {
        if (originalPid === undefined) delete process.env.MONA_LAUNCHER_PID
        else process.env.MONA_LAUNCHER_PID = originalPid
        await close(server); await close(fixture)
        assert.ok(root.startsWith(path.join(tmpdir(), 'mona-update-api-')))
        await rm(root, {recursive: true, force: true})
    }
})

test('3. portable update accepts the default trailing-separator root and applies a real synthetic ZIP while preserving data', async () => {
    assert.ok(new LocalUpdater().root.endsWith(path.sep))
    const root = await mkdtemp(path.join(tmpdir(), 'mona-update-zip-'))
    const stage = path.join(root, 'stage'), target = path.join(root, 'existing app'), zip = path.join(root, 'fixture.zip')
    try {
        for (const name of ['dist', 'server', 'script', 'runtime']) {
            await mkdir(path.join(stage, name), {recursive: true})
            await mkdir(path.join(target, name), {recursive: true})
            await writeFile(path.join(stage, name, name === 'dist' ? 'index.html' : 'program.txt'), 'new-' + name)
            await writeFile(path.join(target, name, name === 'dist' ? 'index.html' : 'program.txt'), 'old-' + name)
        }
        for (const name of ['启动7.1.10.exe', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'LICENSE.miao'])
            await writeFile(path.join(stage, name), 'fixture')
        await mkdir(path.join(target, '.local-data'))
        await writeFile(path.join(target, '.local-data', 'synthetic.json'), 'synthetic-saved-data')
        await writeFile(path.join(target, 'user-file.txt'), 'keep')
        await writeFile(path.join(target, '启动7.1.09.exe'), 'old')
        const helper = path.resolve('script/install-update.ps1')
        powershell("$ErrorActionPreference='Stop'\n$tokens=$null;$errors=$null\n" +
            '$ast=[Management.Automation.Language.Parser]::ParseFile(' + psQuote(helper) + ',[ref]$tokens,[ref]$errors)\n' +
            "if($errors.Count){throw $errors[0]}\n" +
            "$function=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq 'Install-PortablePackage'},$true)\n" +
            'Invoke-Expression $function.Extent.Text\n' +
            '$destinationPath=[IO.Path]::GetFullPath(' + psQuote(new LocalUpdater().root) + ')\n' +
            "$prefix=$function.Find({param($item) $item -is [Management.Automation.Language.AssignmentStatementAst] -and $item.Left.VariablePath.UserPath -eq 'destinationPrefix'},$true)\n" +
            'Invoke-Expression $prefix.Extent.Text\n' +
            "foreach($name in @('dist','server','script','runtime')){\n" +
            "if(-not ([IO.Path]::GetFullPath((Join-Path $destinationPath $name))).StartsWith($destinationPrefix,[StringComparison]::OrdinalIgnoreCase)){throw '默认更新根目录未接受程序子目录'}\n}\n" +
            "$sibling=$destinationPath.TrimEnd([IO.Path]::DirectorySeparatorChar)+'-outside'+[IO.Path]::DirectorySeparatorChar+'dist'\n" +
            "if($sibling.StartsWith($destinationPrefix,[StringComparison]::OrdinalIgnoreCase)){throw '相似名称的兄弟目录未被排除'}\n" +
            'Compress-Archive -Path ' + psQuote(path.join(stage, '*')) + ' -DestinationPath ' + psQuote(zip) + '\n' +
            'Install-PortablePackage ' + psQuote(zip) + ' ' + psQuote(target + path.sep) + " '7.1.10'")
        for (const name of ['dist', 'server', 'script', 'runtime'])
            assert.equal(await readFile(path.join(target, name, name === 'dist' ? 'index.html' : 'program.txt'), 'utf8'), 'new-' + name)
        assert.equal(await readFile(path.join(target, '.local-data', 'synthetic.json'), 'utf8'), 'synthetic-saved-data')
        assert.equal(await readFile(path.join(target, 'user-file.txt'), 'utf8'), 'keep')
        assert.equal(await readFile(path.join(target, '启动7.1.09.exe'), 'utf8'), 'old')
        await access(path.join(target, '启动7.1.10.exe'))
    } finally {
        assert.ok(root.startsWith(path.join(tmpdir(), 'mona-update-zip-')))
        await rm(root, {recursive: true, force: true})
    }
})

test('4. real update component compiles and runs source selection, download progress and install actions', async () => {
    const compiler = require('@vue/compiler-sfc'), parser = require('@babel/parser')
    const {descriptor} = compiler.parse(await readFile('src/App.vue', 'utf8'))
    compiler.compileScript(descriptor, {id: 'update-regression'})
    const template = compiler.compileTemplate({source: descriptor.template.content, filename: 'src/App.vue', id: 'update-regression'})
    assert.deepEqual(template.errors, [])
    const code = descriptor.scriptSetup.content, ast = parser.parse(code, {sourceType: 'module'})
    let body = code
    for (const node of ast.program.body.filter(node => node.type === 'ImportDeclaration').reverse())
        body = body.slice(0, node.start) + body.slice(node.end)
    const calls = []
    const bindings = {
        ref: value => ({value}), computed: get => ({get value() {return get()}}), onMounted() {}, onBeforeUnmount() {},
        ElMessage: {error: message => {throw Error(message)}, success() {}}, process: {env: {MONA_VERSION: '7.1.09'}},
        createReleaseCheckCoordinator: () => async () => ({...describeRelease(metadata(128), '7.1.09')}),
        isAutomaticUpdateEnabled: () => true, setAutomaticUpdateEnabled: () => true, MANUAL_UPDATE_EVENT: 'test',
        openReleaseDownload: () => calls.push('external'), UPDATE_SOURCES: [{id: 'github', name: 'GitHub'}, {id: 'mirror', name: 'Mirror'}],
        isAcceleratedUpdateEnabled: () => true, setAcceleratedUpdateEnabled() {}, releaseAsset,
        getUpdatePlatform: async () => ({kind: 'portable', canInstall: true}),
        probeUpdateSource: async (release, kind, source) => ({speed: source === 'mirror' ? 2000 : 1000, elapsed: 10}),
        getUpdateStatus: async () => ({phase: calls.includes('download') ? 'ready' : 'idle', downloaded: 128, total: 128}),
        startUpdateDownload: async (release, kind, source) => {assert.equal(source, 'mirror'); calls.push('download'); return {phase: 'downloading', downloaded: 0, total: 128}},
        cancelUpdateDownload: async () => ({phase: 'cancelled'}), installDownloadedUpdate: async () => {calls.push('install')},
        setTimeout: callback => {callback()},
    }
    const setup = new Function(...Object.keys(bindings), body + '\nreturn {checkForUpdates, acceptUpdate, cancelDownload, progress, selectedSource};')(...Object.values(bindings))
    await setup.checkForUpdates(true)
    assert.equal(setup.selectedSource.value, 'mirror')
    await setup.acceptUpdate()
    assert.deepEqual(calls, ['download', 'install'])
    assert.equal(setup.progress.value.phase, 'installing')
    calls.length = 0
    let completeStatus
    bindings.getUpdateStatus = async () => calls.includes('download') ?
        new Promise(resolve => {completeStatus = resolve}) : {phase: 'idle'}
    const cancelled = new Function(...Object.keys(bindings), body + '\nreturn {checkForUpdates, acceptUpdate, cancelDownload, progress};')(...Object.values(bindings))
    await cancelled.checkForUpdates(true)
    const pending = cancelled.acceptUpdate()
    while (!completeStatus) await new Promise(resolve => setImmediate(resolve))
    await cancelled.cancelDownload()
    completeStatus({phase: 'ready', downloaded: 128, total: 128})
    await pending
    assert.deepEqual(calls, ['download'])
})
