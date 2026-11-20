import {createHash, randomBytes} from 'node:crypto'
import {mkdir, readFile, readdir, rename, rm, stat, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {compareVersions} from './update-sources.mjs'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'

// 内容补丁的本机存放处。目录里有两份：
//   pending  已下载并校验过、等下次启动才生效的补丁（install 写这里）
//   current  本次运行正在用的补丁（activatePending 在本机服务第一次被问到时把 pending 换成 current）
// 同一次运行里 current 不会变，页面和各个 Worker 读到的是同一份数据。
// 签名校验在安装之前由调用方做（任务 01）；这里只保证：路径在登记表内、文件与清单的大小和 sha256 一致，
// 并在每次读取时重新核对一遍文件，被改坏的补丁不会生效。
//
// 清单：{patch, baseVersion: {min, max}, files: [{path, sha256, size}]}，baseVersion 两端都包含。

const KEY_BY_PATH = new Map(Object.entries(PATCHABLE_DATA).map(([key, file]) => [file, key]))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const failure = (stage, reason) => Object.assign(new Error(`内容补丁${stage}：${reason}`), {code: 'PATCH_STORE', stage})
const exists = async target => { try { await stat(target); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error } }

function checkManifest(manifest) {
    if (!manifest || typeof manifest !== 'object' || typeof manifest.patch !== 'string' || !manifest.patch) throw failure('清单', '缺少补丁号')
    const range = manifest.baseVersion
    if (!range || typeof range.min !== 'string' || typeof range.max !== 'string' || compareVersions(range.min, '0') === null || compareVersions(range.max, '0') === null)
        throw failure('清单', '适用基础版本无效')
    if (!Array.isArray(manifest.files) || !manifest.files.length) throw failure('清单', '文件列表为空')
    const seen = new Set()
    for (const file of manifest.files) {
        if (!KEY_BY_PATH.has(file?.path)) throw failure('清单', '不可替换的文件 ' + file?.path)
        if (seen.has(file.path)) throw failure('清单', '文件重复 ' + file.path)
        seen.add(file.path)
        if (!/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) throw failure('清单', '文件记录无效 ' + file.path)
    }
}

function checkFile(file, bytes) {
    if (bytes.length !== file.size) throw failure('哈希', `${file.path} 大小与清单不符`)
    if (sha256(bytes) !== file.sha256) throw failure('哈希', `${file.path} 的 sha256 与清单不符`)
}

export class PatchStore {
    constructor({directory}) { this.directory = directory }
    #at(...names) { return path.join(this.directory, ...names) }

    // 上次写到一半被中断时留下的临时目录：没写完的丢掉，换到一半的恢复旧的。
    async #recover() {
        await mkdir(this.directory, {recursive: true})
        const names = await readdir(this.directory)
        for (const name of names.filter(name => name.startsWith('.staging-'))) await rm(this.#at(name), {recursive: true, force: true})
        for (const slot of ['pending', 'current']) {
            const olds = names.filter(name => name.startsWith(`.old-${slot}-`))
            if (!olds.length) continue
            if (!await exists(this.#at(slot))) await rename(this.#at(olds[0]), this.#at(slot)), olds.shift()
            for (const old of olds) await rm(this.#at(old), {recursive: true, force: true})
        }
    }

    // 用 source 目录整体换掉 slot：先把旧的改名，再把新的改名过去，最后删旧的。
    async #replace(slot, source) {
        const old = this.#at(`.old-${slot}-${randomBytes(4).toString('hex')}`), had = await exists(this.#at(slot))
        if (had) await rename(this.#at(slot), old)
        await rename(source, this.#at(slot))
        if (had) await rm(old, {recursive: true, force: true})
    }

    // files: {登记表路径: Buffer}。写进 pending，下次启动生效。
    async install({manifest, files}) {
        checkManifest(manifest)
        const given = Object.keys(files).sort(), expected = manifest.files.map(file => file.path).sort()
        if (given.join('\n') !== expected.join('\n')) throw failure('清单', '文件与清单不一致')
        for (const file of manifest.files) checkFile(file, files[file.path])
        await this.#recover()
        const staging = this.#at(`.staging-${randomBytes(4).toString('hex')}`)
        await mkdir(path.join(staging, 'files'), {recursive: true})
        for (const file of manifest.files) await writeFile(path.join(staging, 'files', KEY_BY_PATH.get(file.path) + '.json'), files[file.path])
        await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest))
        await this.#replace('pending', staging)
    }

    // 本机服务启动后第一次被问到时调用：有 pending 就换成 current。
    async activatePending() {
        await this.#recover()
        if (await exists(this.#at('pending'))) await this.#replace('current', this.#at('pending'))
    }

    // 返回 {status: 'none'} | {status: 'rejected', stage, reason} | {status: 'applied', ...}。
    // 不抛错：补丁有问题时页面照常用安装包里的原数据，原因由返回值带出去。
    // 基础版本不适用的补丁只是不生效，文件保留，由下一次 install 换掉。
    async load(appVersion) {
        const current = this.#at('current')
        if (!await exists(current)) return {status: 'none'}
        try {
            let manifest
            try { manifest = JSON.parse(await readFile(path.join(current, 'manifest.json'), 'utf8')) } catch (error) { throw failure('清单', '读取失败：' + error.message) }
            checkManifest(manifest)
            const low = compareVersions(appVersion, manifest.baseVersion.min), high = compareVersions(appVersion, manifest.baseVersion.max)
            if (low === null || high === null) throw failure('版本', '当前版本无法识别：' + appVersion)
            if (low < 0 || high > 0) throw failure('版本', `补丁 ${manifest.patch} 只适用于 ${manifest.baseVersion.min} 到 ${manifest.baseVersion.max}，当前是 ${appVersion}`)
            const overlay = {}
            for (const file of manifest.files) {
                const key = KEY_BY_PATH.get(file.path)
                let bytes
                try { bytes = await readFile(path.join(current, 'files', key + '.json')) } catch (error) { throw failure('哈希', `${file.path} 读取失败：${error.message}`) }
                checkFile(file, bytes)
                try { overlay[key] = JSON.parse(bytes.toString('utf8')) } catch (error) { throw failure('解析', `${file.path} 不是有效的 JSON：${error.message}`) }
            }
            return {status: 'applied', patch: manifest.patch, baseVersion: manifest.baseVersion,
                files: manifest.files.map(({path: file, sha256: hash}) => ({path: file, sha256: hash})), overlay}
        } catch (error) {
            if (error.code !== 'PATCH_STORE') throw error
            return {status: 'rejected', stage: error.stage, reason: error.message}
        }
    }

    // 回滚：删掉所有补丁，下次读取时回到安装包原数据。只供本机服务内部调用。
    async rollback() {
        await mkdir(this.directory, {recursive: true})
        for (const name of await readdir(this.directory)) await rm(this.#at(name), {recursive: true, force: true})
    }
}
