import {randomBytes} from 'node:crypto'
import {mkdir, readFile, readdir, rename, rm, stat, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {PATCH_KEY_BY_PATH, checkBaseVersion, checkFiles, checkManifest, isPatchFailure, parseManifest, patchFailure} from './patch-package.mjs'

// 内容补丁的本机存放处。目录里有两份：
//   pending  已下载并校验过、等下次启动才生效的补丁（install 写这里）
//   current  本次运行正在用的补丁（activatePending 在本机服务第一次被问到时把 pending 换成 current）
// 同一次运行里 current 不会变，页面和各个 Worker 读到的是同一份数据。
// 签名校验在安装之前由调用方用 patch-package.mjs 的 verifyPatchPackage 做；这里复用同一套清单和文件检查：路径在登记表内、文件与清单的大小和 sha256 一致，
// 并在每次读取时重新核对一遍文件，被改坏的补丁不会生效。
//
// 清单格式见 patch-package.mjs。

const exists = async target => { try { await stat(target); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error } }

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
        await checkFiles(manifest, files)
        await this.#recover()
        const staging = this.#at(`.staging-${randomBytes(4).toString('hex')}`)
        await mkdir(path.join(staging, 'files'), {recursive: true})
        for (const file of manifest.files) await writeFile(path.join(staging, 'files', PATCH_KEY_BY_PATH.get(file.path) + '.json'), files[file.path])
        await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest))
        await this.#replace('pending', staging)
    }

    // 已安装的最新补丁号（待生效的优先，其次是当前的），没有或读不出来时返回 null；检查更新时用来判断要不要下载
    async latestPatch() {
        for (const slot of ['pending', 'current']) {
            let bytes
            try { bytes = await readFile(this.#at(slot, 'manifest.json')) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
            try { return parseManifest(bytes).patch } catch (error) { if (!isPatchFailure(error)) throw error }
        }
        return null
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
            let manifestBytes
            try { manifestBytes = await readFile(path.join(current, 'manifest.json')) } catch (error) { throw patchFailure('清单', '读取失败：' + error.message) }
            const manifest = parseManifest(manifestBytes)
            checkBaseVersion(manifest, appVersion)
            const files = {}
            for (const file of manifest.files) {
                try { files[file.path] = await readFile(path.join(current, 'files', PATCH_KEY_BY_PATH.get(file.path) + '.json')) } catch (error) { throw patchFailure('哈希', `${file.path} 读取失败：${error.message}`) }
            }
            await checkFiles(manifest, files)
            const overlay = {}
            for (const file of manifest.files) {
                try { overlay[PATCH_KEY_BY_PATH.get(file.path)] = JSON.parse(files[file.path].toString('utf8')) } catch (error) { throw patchFailure('解析', `${file.path} 不是有效的 JSON：${error.message}`) }
            }
            return {status: 'applied', patch: manifest.patch, baseVersion: manifest.baseVersion,
                files: manifest.files.map(({path: file, sha256: hash}) => ({path: file, sha256: hash})), overlay}
        } catch (error) {
            if (!isPatchFailure(error)) throw error
            return {status: 'rejected', stage: error.stage, reason: error.message}
        }
    }

    // 回滚：删掉所有补丁，下次读取时回到安装包原数据。只供本机服务内部调用。
    async rollback() {
        await mkdir(this.directory, {recursive: true})
        for (const name of await readdir(this.directory)) await rm(this.#at(name), {recursive: true, force: true})
    }
}
