import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {compareVersions} from './update-sources.mjs'

// 内容补丁包的格式和校验。不依赖 Vue、浏览器专有 API 或 Node 专有 API，只用 WebCrypto 和标准类型，
// 桌面页面、Worker、Node 本机服务、Android 页面和打包工具都能导入。
//
// 补丁包由三部分组成：
//   manifest   清单文件的原始字节（JSON）：
//              {patch, createdAt, baseVersion: {min, max}, files: [{path, sha256, size}]}
//              baseVersion 两端都包含；path 必须在当前通道的登记表中；sha256 是小写十六进制
//   signature  对清单原始字节的 ECDSA P-256 + SHA-256 签名，WebCrypto 的 r‖s 格式（64 字节）
//   files      {登记表路径: 文件字节}
// 签名覆盖的是清单的原始字节，不需要规范化；清单里的 sha256 再把每个文件钉住。
// 公钥是未压缩的 P-256 点（65 字节），由调用方从构建配置传入。私钥不进仓库，签名在打包工具里做。
// 选 ECDSA P-256 而不是 Ed25519：这条签名要在 Android 的 WebView 里也能验，P-256 在 WebCrypto 里
// 是各平台都有的基础算法；Ed25519 在旧版 WebView 里是否可用我没有核实。

export const PATCH_KEY_BY_PATH = new Map(Object.entries(PATCHABLE_DATA).map(([key, file]) => [file, key]))
const SIGNATURE_ALGORITHM = {name: 'ECDSA', hash: 'SHA-256'}

export const patchFailure = (stage, reason) => Object.assign(new Error(`内容补丁${stage}：${reason}`), {code: 'PATCH_PACKAGE', stage})
export const isPatchFailure = error => error?.code === 'PATCH_PACKAGE'

export async function sha256Hex(bytes) {
    return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifySignature(publicKey, manifestBytes, signature) {
    let valid
    try {
        const key = await globalThis.crypto.subtle.importKey('raw', publicKey, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify'])
        valid = await globalThis.crypto.subtle.verify(SIGNATURE_ALGORITHM, key, signature, manifestBytes)
    } catch (error) { throw patchFailure('签名', '无法验证：' + error.message) }
    if (!valid) throw patchFailure('签名', '清单签名不正确')
}

// 检查清单本身的格式和其中的路径；清单已经是对象
export function checkManifest(manifest, registry = PATCH_KEY_BY_PATH) {
    if (!manifest || typeof manifest !== 'object' || typeof manifest.patch !== 'string' || !manifest.patch) throw patchFailure('清单', '缺少补丁号')
    if (compareVersions(manifest.patch, '0') === null) throw patchFailure('清单', '补丁号无法识别：' + manifest.patch)
    if (typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) throw patchFailure('清单', '创建时间无效')
    const range = manifest.baseVersion
    if (!range || typeof range.min !== 'string' || typeof range.max !== 'string' || compareVersions(range.min, '0') === null || compareVersions(range.max, '0') === null)
        throw patchFailure('清单', '适用基础版本无效')
    if (!Array.isArray(manifest.files) || !manifest.files.length) throw patchFailure('清单', '文件列表为空')
    const seen = new Set()
    for (const file of manifest.files) {
        if (!registry.has(file?.path)) throw patchFailure('路径', '不可替换的文件 ' + file?.path)
        if (seen.has(file.path)) throw patchFailure('路径', '文件重复 ' + file.path)
        seen.add(file.path)
        if (!/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) throw patchFailure('清单', '文件记录无效 ' + file.path)
    }
}

export function parseManifest(manifestBytes, registry) {
    let manifest
    try { manifest = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(manifestBytes)) } catch (error) { throw patchFailure('清单', '不是有效的 JSON：' + error.message) }
    checkManifest(manifest, registry)
    return manifest
}

// files 与清单一一对应（不多不少），每个文件的大小和 sha256 与清单一致
export async function checkFiles(manifest, files) {
    const given = Object.keys(files).sort(), expected = manifest.files.map(file => file.path).sort()
    if (given.join('\n') !== expected.join('\n')) throw patchFailure('路径', `文件与清单不一致（清单 ${expected.length} 个，实际 ${given.length} 个）`)
    for (const file of manifest.files) {
        const bytes = files[file.path]
        if (bytes.length !== file.size) throw patchFailure('哈希', `${file.path} 大小与清单不符`)
        if (await sha256Hex(bytes) !== file.sha256) throw patchFailure('哈希', `${file.path} 的 sha256 与清单不符`)
    }
}

// 当前软件版本在清单的适用范围内
export function checkBaseVersion(manifest, appVersion) {
    const low = compareVersions(appVersion, manifest.baseVersion.min), high = compareVersions(appVersion, manifest.baseVersion.max)
    if (low === null || high === null) throw patchFailure('版本', '当前版本无法识别：' + appVersion)
    if (low < 0 || high > 0) throw patchFailure('版本', `补丁 ${manifest.patch} 只适用于 ${manifest.baseVersion.min} 到 ${manifest.baseVersion.max}，当前是 ${appVersion}`)
}

// 校验整个补丁包，通过时返回清单对象；任何一步不通过都抛错，错误带 stage（签名、清单、路径、哈希、版本）。
// 顺序：先验签名，签名不对的清单内容不去解析；再查清单、文件，最后查版本。
export async function verifyPatchPackage({manifest: manifestBytes, signature, files, publicKey, appVersion, registry}) {
    await verifySignature(publicKey, manifestBytes, signature)
    const manifest = parseManifest(manifestBytes, registry)
    await checkFiles(manifest, files)
    checkBaseVersion(manifest, appVersion)
    return manifest
}
