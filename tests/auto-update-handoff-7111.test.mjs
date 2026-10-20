import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, copyFile, writeFile, readFile, rm, access} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const project = fileURLToPath(new URL('../', import.meta.url))
const inno = 'D:/Documents/ChatGPT/release-tools/inno/ISCC.exe'
const compiler = path.join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe')
const psQuote = value => "'" + value.replaceAll("'", "''") + "'"
const run = (file, args, timeout = 20000) => execFileSync(file, args, {encoding: 'utf8', windowsHide: true, timeout})
const ps = code => run('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from("$ProgressPreference='SilentlyContinue'\n" + code, 'utf16le').toString('base64')])
const waitFor = async check => {
    const end = Date.now() + 20000
    while (Date.now() < end) {
        if (await check()) return
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error('Synthetic update did not finish within 20 seconds')
}
const stopped = pid => {try {process.kill(pid, 0); return false} catch (error) {if (error.code === 'ESRCH') return true; throw error}}
async function fixture(mode) {
    const root = await mkdtemp(path.join(tmpdir(), 'mona-update-7111-'))
    const target = path.join(root, 'existing app'), stage = path.join(root, 'stage'), job = path.join(root, 'download')
    await mkdir(job)
    for (const name of ['dist', 'server', 'script', 'runtime']) {
        await mkdir(path.join(target, name), {recursive: true})
        await mkdir(path.join(stage, name), {recursive: true})
        await writeFile(path.join(target, name, name === 'dist' ? 'index.html' : 'program.txt'), 'old-' + name)
        await writeFile(path.join(stage, name, name === 'dist' ? 'index.html' : 'program.txt'), 'new-' + name)
    }
    await copyFile(process.execPath, path.join(target, 'runtime/node.exe'))
    await writeFile(path.join(stage, 'runtime/node.exe'), 'replacement-runtime')
    await copyFile(path.join(project, 'script/install-update.ps1'), path.join(target, 'script/install-update.ps1'))
    await copyFile(path.join(project, 'server/install-update.mjs'), path.join(target, 'server/install-update.mjs'))
    await mkdir(path.join(target, '.local-data'))
    await writeFile(path.join(target, '.local-data/synthetic.json'), 'synthetic-saved-data')
    await writeFile(path.join(target, 'user-file.txt'), 'keep')
    await writeFile(path.join(target, '启动7.1.10.exe'), 'old-launcher')
    if (mode === 'installer') await writeFile(path.join(target, 'unins000.exe'), 'synthetic-install-marker')
    const source = path.join(root, 'FixtureLauncher.cs')
    await writeFile(source, 'using System; using System.IO; class FixtureLauncher { static void Main() { File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"relaunched.txt"),Environment.GetEnvironmentVariable("MONA_PORT") ?? "missing"); } }')
    run(compiler, ['/nologo', '/target:winexe', '/out:' + path.join(stage, '启动7.1.11.exe'), source])
    for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'LICENSE.miao']) await writeFile(path.join(stage, name), 'synthetic-license')
    const parent = path.join(root, 'parent.mjs')
    await writeFile(parent, `import {LocalUpdater} from ${JSON.stringify(pathToFileURL(path.join(project, 'server/updates.mjs')).href)}
import {writeFileSync} from 'node:fs'
import {spawn} from 'node:child_process'
import path from 'node:path'
const [target, directory, file, report] = process.argv.slice(2)
let workerPid, workerRuntime
process.env.MONA_LAUNCHER_PID = String(process.pid)
const updater = new LocalUpdater({root: target + path.sep, directory, launch: (exe, args, options) => {
    workerRuntime = exe
    const child = spawn(exe, args, options); workerPid = child.pid; return child
}})
updater.state = {phase: 'ready', directory, file, version: 'v7.1.11'}
try {
    const result = await updater.install(49117)
    writeFileSync(report, JSON.stringify({phase: result.phase, workerPid, workerRuntime}))
} catch (error) {
    writeFileSync(report, JSON.stringify({phase: updater.state.phase, error: error.message, workerPid}))
}
`)
    return {root, target, stage, job, parent}
}
async function execute(f, file, reportName) {
    const report = path.join(f.root, reportName)
    // The real parent must exit naturally after the script acknowledges takeover.
    run(path.join(f.target, 'runtime/node.exe'), [f.parent, f.target, f.job, file, report])
    return JSON.parse(await readFile(report, 'utf8'))
}
async function checkResult(f, file, report) {
    assert.equal(report.phase, 'installing')
    assert.equal(report.workerRuntime, path.join(f.job, 'node.exe'))
    await waitFor(async () => {
        try {return (await readFile(path.join(f.target, 'relaunched.txt'), 'utf8')) === '49117'} catch (error) {if (error.code === 'ENOENT') return false; throw error}
    })
    await waitFor(() => stopped(report.workerPid))
    const log = await readFile(file + '.update.log', 'utf8')
    assert.match(log, /MONA_UPDATE_READY/)
    assert.match(log, /MONA_UPDATE_EXIT 0/)
    for (const name of ['dist', 'server', 'script', 'runtime']) assert.equal(await readFile(path.join(f.target, name, name === 'dist' ? 'index.html' : 'program.txt'), 'utf8'), 'new-' + name)
    assert.equal(await readFile(path.join(f.target, 'runtime/node.exe'), 'utf8'), 'replacement-runtime')
    assert.equal(await readFile(path.join(f.target, '.local-data/synthetic.json'), 'utf8'), 'synthetic-saved-data')
    assert.equal(await readFile(path.join(f.target, 'user-file.txt'), 'utf8'), 'keep')
    assert.equal(await readFile(path.join(f.target, '启动7.1.10.exe'), 'utf8'), 'old-launcher')
}
async function cleanup(f) {
    assert.ok(path.resolve(f.root).startsWith(path.join(path.resolve(tmpdir()), 'mona-update-7111-')))
    await rm(f.root, {recursive: true, force: true})
}

test('Windows: script startup failure keeps ready; real detached handoff updates a ZIP after parent exit and relaunches', {timeout: 60000}, async t => {
    const f = await fixture('portable')
    t.diagnostic('Synthetic fixture: ' + f.root)
    const zip = path.join(f.job, 'fixture.zip')
    ps('$ErrorActionPreference="Stop"\nCompress-Archive -Path ' + psQuote(path.join(f.stage, '*')) + ' -DestinationPath ' + psQuote(zip))
    await writeFile(path.join(f.target, 'script/install-update.ps1'), 'param(\n')
    const failed = await execute(f, zip, 'failure.json')
    assert.equal(failed.phase, 'ready')
    assert.match(failed.error, /安装脚本未开始执行/)
    await waitFor(() => stopped(failed.workerPid))
    await assert.rejects(access(path.join(f.target, 'relaunched.txt')))
    await copyFile(path.join(project, 'script/install-update.ps1'), path.join(f.target, 'script/install-update.ps1'))
    const accepted = await execute(f, zip, 'accepted.json')
    await checkResult(f, zip, accepted)
    await cleanup(f)
})

test('Windows: real synthetic Inno installer updates the original directory and relaunches after parent exit', {timeout: 60000}, async t => {
    const f = await fixture('installer')
    t.diagnostic('Synthetic fixture: ' + f.root)
    const setupScript = path.join(f.root, 'fixture.iss')
    await writeFile(setupScript, '\ufeff[Setup]\nAppName=Mona Synthetic Update\nAppVersion=7.1.11\nDefaultDirName=' + f.target + '\nOutputDir=' + f.job + '\nOutputBaseFilename=fixture\nPrivilegesRequired=lowest\nUninstallable=no\nCreateUninstallRegKey=no\nUsePreviousAppDir=no\nDisableProgramGroupPage=yes\nDisableReadyPage=yes\n[Files]\nSource: "' + f.stage + '\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs\n', 'utf8')
    run(inno, ['/Q', setupScript])
    const exe = path.join(f.job, 'fixture.exe')
    const accepted = await execute(f, exe, 'accepted.json')
    await checkResult(f, exe, accepted)
    await cleanup(f)
})
