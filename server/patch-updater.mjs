import {PATCH_KEY_BY_PATH, checkBaseVersion, isPatchFailure, parseManifest, patchFailure, verifyPatchPackage, verifySignature} from './patch-package.mjs'
import {compareVersions} from './update-sources.mjs'

// 内容补丁的检查与下载，运行在本机服务里（页面通过 /api/patch/check 触发）。
// 补丁放在一个静态目录里，目录结构就是 beta-tools/patch-tool.mjs 的输出：
//   <baseUrl>/manifest.json、<baseUrl>/manifest.sig、<baseUrl>/files/<键>.json
// 这条通道刻意不放在 GitHub 或 CNB 的 Release 上，所以没有复用 update-sources.mjs 里那几条下载线路：
// 它们只会转发本项目的 Release 附件。补丁地址由构建配置 MONA_PATCH_BASE_URL 给出，页面带过来。
// 流程：取清单（带 ETag）→ 取签名并先验签 → 版本范围 → 与已安装的补丁号比较 → 下载文件 → 整包再验一遍 → 交给 PatchStore 装进待生效。
// 当前这次运行用的数据不会变，装好的补丁下次启动才生效。
// 所有失败都不抛错，原因和阶段留在返回值和 status() 里，下次检查再试；不弹窗。

const MANIFEST_TIMEOUT = 15000, FILE_TIMEOUT = 60000

// 补丁地址：https，或本机回环地址的 http（开发测试）；不带账号密码、查询和锚点
export function patchBaseUrl(value) {
    let url
    try { url = new URL(String(value).trim()) } catch { throw patchFailure('配置', '补丁地址不是有效的网址') }
    const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !loopback) || url.username || url.password || url.search || url.hash) throw patchFailure('配置', '补丁地址必须是 https 网址，且不带账号、查询和锚点')
    return url.href.replace(/\/+$/, '')
}

// 公钥：未压缩的 P-256 点（65 字节）的 Base64，由 patch-tool.mjs keygen 打印
export function patchPublicKey(value) {
    const bytes = Uint8Array.from(Buffer.from(String(value).trim(), 'base64'))
    if (bytes.length !== 65 || bytes[0] !== 4) throw patchFailure('配置', '补丁公钥格式不对')
    return bytes
}

export class PatchUpdater {
    constructor({store, fetchImpl = globalThis.fetch, now = () => new Date(), timeouts = {manifest: MANIFEST_TIMEOUT, file: FILE_TIMEOUT}}) {
        Object.assign(this, {store, fetch: fetchImpl, now, timeouts})
        this.etags = new Map()
        this.running = null
        this.state = {status: 'idle'}
    }
    // 最近一次检查的结果，供 Debug 导出使用
    status() { return this.state }

    // 同一时刻只做一次检查，重复触发的拿到同一个结果
    check(input) {
        return this.running ||= this.#run(input).finally(() => { this.running = null })
    }

    async #run({version, baseUrl, publicKey}) {
        let result
        try { result = await this.#check({version, baseUrl, publicKey}) } catch (error) {
            const failure = isPatchFailure(error) ? error : patchFailure('下载', error.message)
            result = {status: 'failed', stage: failure.stage, reason: failure.message}
        }
        return this.state = {...result, checkedAt: this.now().toISOString()}
    }

    async #get(url, timeout, headers = {}) {
        try { return await this.fetch(url, {headers, signal: AbortSignal.timeout(timeout), cache: 'no-store'}) } catch (error) { throw patchFailure('下载', `${url} 无法访问：${error.message}`) }
    }
    async #bytes(response, url, limit) {
        try {
            const reader = response.body.getReader(), chunks = []
            let total = 0
            for (;;) {
                const {done, value} = await reader.read()
                if (done) break
                total += value.length
                if (total > limit) { await reader.cancel(); throw patchFailure('哈希', `${url} 超过清单声明的大小`) }
                chunks.push(value)
            }
            return new Uint8Array(Buffer.concat(chunks))
        } catch (error) {
            if (isPatchFailure(error)) throw error
            throw patchFailure('下载', `${url} 下载中断：${error.message}`)
        }
    }

    async #check({version, baseUrl, publicKey}) {
        if (!baseUrl || !publicKey) return {status: 'disabled', reason: '没有配置补丁地址或公钥'}
        const base = patchBaseUrl(baseUrl), key = patchPublicKey(publicKey)
        // 只有本机上记下的那个补丁还完好时才带 ETag：装好的补丁被改坏后，同一个清单也要重新下载
        const remembered = this.etags.get(base)
        const known = remembered && (remembered.patch === null || await this.store.latestPatch() === remembered.patch) ? remembered.etag : null

        const manifestUrl = base + '/manifest.json'
        const manifestResponse = await this.#get(manifestUrl, this.timeouts.manifest, known ? {'If-None-Match': known} : {})
        if (manifestResponse.status === 304) return {status: 'unchanged'}
        if (manifestResponse.status === 404) return {status: 'none', reason: '服务器上还没有发布补丁'}
        if (!manifestResponse.ok) throw patchFailure('下载', `${manifestUrl} 返回 HTTP ${manifestResponse.status}`)
        const manifestBytes = await this.#bytes(manifestResponse, manifestUrl, 1 << 20)
        const etag = manifestResponse.headers.get('etag')

        const signatureUrl = base + '/manifest.sig'
        const signatureResponse = await this.#get(signatureUrl, this.timeouts.manifest)
        if (!signatureResponse.ok) throw patchFailure('签名', `${signatureUrl} 返回 HTTP ${signatureResponse.status}，缺少签名`)
        const signature = await this.#bytes(signatureResponse, signatureUrl, 1024)
        await verifySignature(key, manifestBytes, signature)
        const manifest = parseManifest(manifestBytes)
        const decided = result => { if (etag) this.etags.set(base, {etag, patch: result.status === 'not-applicable' ? null : result.patch}); return result }

        try { checkBaseVersion(manifest, version) } catch (error) {
            if (isPatchFailure(error) && error.stage === '版本') return decided({status: 'not-applicable', patch: manifest.patch, reason: error.message})
            throw error
        }
        const installed = await this.store.latestPatch()
        if (installed && compareVersions(manifest.patch, installed) <= 0) return decided({status: 'up-to-date', patch: installed})

        const files = {}
        for (const file of manifest.files) {
            const url = `${base}/files/${PATCH_KEY_BY_PATH.get(file.path)}.json`
            const response = await this.#get(url, this.timeouts.file)
            if (!response.ok) throw patchFailure('下载', `${url} 返回 HTTP ${response.status}`)
            files[file.path] = await this.#bytes(response, url, file.size)
        }
        await verifyPatchPackage({manifest: manifestBytes, signature, files, publicKey: key, appVersion: version})
        await this.store.install({manifest, files})
        return decided({status: 'installed', patch: manifest.patch})
    }
}
