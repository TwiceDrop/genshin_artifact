import {existsSync} from 'node:fs'
import {mkdir, mkdtemp, open, copyFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {fetchReleaseMetadata, releaseAsset, sourceUrl, UPDATE_SOURCES} from './update-sources.mjs'

export class LocalUpdater {
    constructor({root = fileURLToPath(new URL('../', import.meta.url)), fetchImpl = globalThis.fetch,
        directory = tmpdir(), launch = spawn, notify = () => console.log('MONA_LAUNCHER_UPDATE')} = {}) {
        this.root = root
        this.fetch = fetchImpl
        this.directory = directory
        this.launch = launch
        this.notify = notify
        this.kind = existsSync(path.join(root, 'unins000.exe')) ? 'installer' : 'portable'
        this.state = {phase: 'idle', downloaded: 0, total: 0, speed: 0}
    }
    info() {
        return {kind: this.kind, canInstall: process.platform === 'win32' && !!process.env.MONA_LAUNCHER_PID}
    }
    async latest(accelerated) {
        const release = await fetchReleaseMetadata(this.fetch, accelerated)
        release.assets = release.assets || []
        this.release = release
        return release
    }
    asset(version) {
        if (!this.release || this.release.tag_name !== version) throw new Error('请重新检查最新版本')
        return releaseAsset(this.release, this.kind)
    }
    async probe(version, source) {
        const asset = this.asset(version), controller = new AbortController()
        const started = Date.now(), timer = setTimeout(() => controller.abort(), 10000)
        let reader
        try {
            const response = await this.fetch(sourceUrl(asset.browser_download_url, source), {
                headers: {Range: 'bytes=0-262143', 'Accept-Encoding': 'identity'}, signal: controller.signal,
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            reader = response.body.getReader()
            let bytes = 0
            while (bytes < 262144) {
                const chunk = await reader.read()
                if (chunk.done) break
                bytes += chunk.value.byteLength
            }
            if (!bytes) throw new Error('未收到文件内容')
            const elapsed = Math.max(1, Date.now() - started)
            return {id: source, name: UPDATE_SOURCES.find(item => item.id === source).name,
                elapsed, speed: bytes * 1000 / elapsed}
        } finally {
            clearTimeout(timer)
            if (reader) await reader.cancel()
        }
    }
    async start(version, source) {
        if (['downloading', 'installing'].includes(this.state.phase)) throw new Error('已有更新正在进行')
        const asset = this.asset(version)
        const url = sourceUrl(asset.browser_download_url, source)
        await mkdir(this.directory, {recursive: true})
        const directory = await mkdtemp(path.join(this.directory, 'mona-update-'))
        const file = path.join(directory, this.kind === 'installer' ? 'package.exe' : 'package.zip')
        const job = this.state = {phase: 'downloading', downloaded: 0, total: asset.size, speed: 0,
            version, source, file, directory, error: ''}
        this.controller = new AbortController()
        this.task = this.download(url, job, this.controller.signal)
        return this.status()
    }
    async download(url, job, signal) {
        let output
        try {
            const response = await this.fetch(url, {signal, headers: {'Accept-Encoding': 'identity'}})
            if (!response.ok) throw new Error('下载失败（HTTP ' + response.status + '）')
            output = await open(job.file + '.part', 'w')
            let tick = Date.now(), previous = 0
            for await (const bytes of response.body) {
                await output.writeFile(bytes)
                job.downloaded += bytes.byteLength
                const now = Date.now()
                if (now - tick >= 500) {
                    job.speed = (job.downloaded - previous) * 1000 / (now - tick)
                    previous = job.downloaded; tick = now
                }
            }
            if (signal.aborted) throw signal.reason
            if (job.downloaded !== job.total) throw new Error('下载不完整：收到 ' + job.downloaded + '／' + job.total + ' 字节')
            await output.close(); output = null
            const {rename} = await import('node:fs/promises')
            await rename(job.file + '.part', job.file)
            job.phase = 'ready'; job.speed = 0
        } catch (error) {
            job.phase = signal.aborted ? 'cancelled' : 'error'
            job.error = signal.aborted ? '' : error.message
            if (output) await output.close()
            await rm(job.file + '.part', {force: true})
        }
    }
    status() {
        const {file, directory, ...status} = this.state
        return status
    }
    async cancel() {
        if (this.state.phase === 'downloading') {
            this.controller.abort()
            await this.task
        }
        if (this.state.phase === 'ready') {
            this.state.phase = 'cancelled'
            await rm(this.state.file)
        }
        return this.status()
    }
    async install(port) {
        if (this.state.phase !== 'ready') throw new Error('更新包尚未下载完成')
        if (!this.info().canInstall) throw new Error('请通过莫娜启动 EXE 运行后再安装更新')
        const job = this.state
        const script = path.join(job.directory, 'install-update.ps1')
        await copyFile(path.join(this.root, 'script', 'install-update.ps1'), script)
        const child = this.launch('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
            '-Package', job.file, '-TargetRoot', this.root, '-Mode', this.kind,
            '-Version', job.version.replace(/^v/i, ''), '-LauncherPid', process.env.MONA_LAUNCHER_PID,
            '-ServerPid', String(process.pid), '-Port', String(port)],
            {detached: true, stdio: 'ignore', windowsHide: true})
        await new Promise((resolve, reject) => {child.once('spawn', resolve); child.once('error', reject)})
        child.unref()
        job.phase = 'installing'
        return this.status()
    }
}
