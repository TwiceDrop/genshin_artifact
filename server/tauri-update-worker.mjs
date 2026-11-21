// The Tauri host starts this process outside the backend's kill-on-close Job Object.
import {spawn} from 'node:child_process'
import {constants} from 'node:fs'
import {appendFile, copyFile, mkdtemp, open, readFile, rename, rm, rmdir} from 'node:fs/promises'
import path from 'node:path'
import {createInterface} from 'node:readline'
import {setTimeout as delay} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'

async function checkExecutable(file) {
    const fd = await open(file, 'r')
    try {
        const header = Buffer.alloc(64), pe = Buffer.alloc(26)
        if ((await fd.read(header)).bytesRead === header.length && header.readUInt16LE() === 0x5a4d &&
            (await fd.read(pe, 0, pe.length, header.readUInt32LE(60))).bytesRead === pe.length &&
            pe.readUInt32LE() === 0x4550 && pe.readUInt16LE(4) === 0x8664 && pe.readUInt16LE(24) === 0x20b &&
            (pe.readUInt16LE(22) & 0x2002) === 2) return
        throw new Error('下载文件不是 x64 Windows 可执行程序')
    } finally { await fd.close() }
}

async function waitForExit(pid) {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        try { process.kill(pid, 0) } catch (error) { if (error.code === 'ESRCH') return; throw error }
        await delay(150)
    }
    throw new Error('旧进程尚未退出：' + pid)
}

function launch(exe) {
    return new Promise((resolve, reject) => {
        const child = spawn(exe, [], {cwd: path.dirname(exe), detached: true, stdio: 'ignore'})
        child.once('error', reject)
        child.once('spawn', () => { child.unref(); resolve(child) })
    })
}

async function waitUntilReady(child, stateFile) {
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode) throw new Error('新版在本机服务就绪前退出，退出码：' + child.exitCode)
        try {
            const state = JSON.parse(await readFile(stateFile, 'utf8'))
            if (state.applicationPid === child.pid && state.port === 47504) return
        } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error }
        await delay(200)
    }
    throw new Error('等待新版就绪超时')
}

export async function installTauriUpdate({file, target, appPid, serverPid, stateFile, confirm, start = launch, ready = waitUntilReady}) {
    const staging = await mkdtemp(path.join(path.dirname(target), '.mona-update-'))
    const incoming = path.join(staging, 'new.exe'), previous = path.join(staging, 'previous.exe')
    let keepBackup = false
    try {
        await copyFile(file, incoming, constants.COPYFILE_EXCL)
        await checkExecutable(incoming)
        await copyFile(target, previous, constants.COPYFILE_EXCL)
        await confirm()
        await Promise.all([waitForExit(appPid), waitForExit(serverPid)])
        let replaced = false, child
        try {
            await rename(incoming, target)
            replaced = true
            child = await start(target)
            await ready(child, stateFile)
        } catch (error) {
            keepBackup = true
            // A slow but live new process still owns the EXE. Preserve both files.
            if (child && child.exitCode === null && !child.signalCode)
                throw new Error(error.message + '；旧版保存在 ' + previous)
            if (replaced) await rename(previous, target)
            await start(target)
            keepBackup = false
            throw error
        }
    } finally {
        if (!keepBackup) await rm(staging, {recursive: true, force: true})
    }
}

async function main() {
    const [file, target, appPid, serverPid, stateFile] = process.argv.slice(2)
    const input = createInterface({input: process.stdin})[Symbol.asyncIterator]()
    let prepared = false, committed = false
    try {
        await installTauriUpdate({file, target, appPid: Number(appPid), serverPid: Number(serverPid), stateFile,
            confirm: async () => {
                process.stdout.write('READY\n')
                prepared = true
                if ((await input.next()).value !== 'INSTALL') throw new Error('更新交接已取消')
                committed = true
            }})

    } catch (error) {
        if (!prepared) process.stdout.write(JSON.stringify({error: error.message}) + '\n')
        const log = path.join(path.dirname(file), 'update.log')
        await appendFile(log, String(error.stack || error) + '\n')
        if (committed) {
            const notice = spawn('powershell.exe', ['-NoProfile', '-Command',
                'Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($env:MONA_UPDATE_ERROR,"Mona Update") | Out-Null'],
                {windowsHide: true, stdio: 'ignore', env: {...process.env, MONA_UPDATE_ERROR: error.message + '\n' + log}})
            notice.once('error', e => console.error(e.message))
        }
        process.exitCode = 1
        return
    } finally { process.stdin.destroy() }
    try {
        await rm(file, {force: true})
        await rmdir(path.dirname(file))
    } catch (error) { console.error('更新完成，下载目录清理失败：' + error.message) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
