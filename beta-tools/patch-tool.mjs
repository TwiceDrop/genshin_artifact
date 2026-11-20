// 内容补丁的打包与签名工具，只在开发者本机生成补丁包，不上传、不推送、不创建 Release。
//
//   生成密钥对（私钥只写到指定位置，已存在则拒绝覆盖）：
//     node beta-tools/patch-tool.mjs keygen --out <路径前缀>        得到 <前缀>.key（PKCS8 PEM 私钥）和 <前缀>.pub（Base64 的公钥，写进构建配置）
//   打补丁包（私钥从环境变量 MONA_PATCH_SIGNING_KEY 指向的文件读取）：
//     node beta-tools/patch-tool.mjs build --base-min 7.2.05EA --base-max 7.2.05EA.99 (--patch 7.2.05EA.01 | --previous <上一个补丁的目录或 manifest.json>)
//         --out <输出目录> [--source-root <数据所在的根目录，默认仓库根>] <登记表里的数据路径>...
//   输出目录里有 manifest.json、manifest.sig、files/<键>.json，格式见 server/patch-package.mjs。
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {PATCH_KEY_BY_PATH, sha256Hex, verifyPatchPackage} from '../server/patch-package.mjs'
import {compareVersions} from '../server/update-sources.mjs'

const subtle = globalThis.crypto.subtle
const ALGORITHM = {name: 'ECDSA', namedCurve: 'P-256'}
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const toBase64 = bytes => Buffer.from(bytes).toString('base64')

const toPem = der => `-----BEGIN PRIVATE KEY-----\n${toBase64(der).match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`
const fromPem = text => {
    const body = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/.exec(text)?.[1]
    if (!body) throw new Error('私钥文件不是 PKCS8 PEM 格式')
    return new Uint8Array(Buffer.from(body.replace(/\s+/g, ''), 'base64'))
}

// 生成测试用或发布用的密钥对。私钥文件用 wx 打开：已存在就失败，不会覆盖旧密钥。
export async function generateKeyFiles({out}) {
    if (!out) throw new Error('keygen 需要 --out')
    const pair = await subtle.generateKey(ALGORITHM, true, ['sign', 'verify'])
    const publicKey = toBase64(await subtle.exportKey('raw', pair.publicKey))
    const privateFile = out + '.key', publicFile = out + '.pub'
    await mkdir(path.dirname(path.resolve(privateFile)), {recursive: true})
    await writeFile(privateFile, toPem(await subtle.exportKey('pkcs8', pair.privateKey)), {flag: 'wx', mode: 0o600})
    await writeFile(publicFile, publicKey + '\n', {flag: 'wx'})
    return {privateFile, publicFile, publicKey}
}

// 读私钥并推出公钥（未压缩的 P-256 点），用于生成后立即自检
export async function loadSigningKey(file) {
    if (!file) throw new Error('没有指定私钥：请把环境变量 MONA_PATCH_SIGNING_KEY 设为私钥文件的路径')
    const privateKey = await subtle.importKey('pkcs8', fromPem(await readFile(file, 'utf8')), ALGORITHM, true, ['sign'])
    const jwk = await subtle.exportKey('jwk', privateKey)
    const publicKey = new Uint8Array(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]))
    return {privateKey, publicKey}
}

// 上一个补丁的清单（目录或 manifest.json）里的补丁号加一，保持补丁段的位数。上一个必须是清单，
// 不能是随手写的版本号：只有清单里的 patch 字段一定是补丁号，不会把基础版本 7.2.05 误当成补丁号。
export async function nextPatchNumber(previous) {
    const file = (await stat(previous)).isDirectory() ? path.join(previous, 'manifest.json') : previous
    const patch = JSON.parse(await readFile(file, 'utf8')).patch
    const match = /^(\d+(?:\.\d+)*(?:EA)?\.)(\d+)$/i.exec(patch)
    if (!match) throw new Error(`上一个补丁号 ${patch} 没有补丁段，无法自动加一，请用 --patch 指定`)
    const next = match[1] + String(Number(match[2]) + 1).padStart(match[2].length, '0')
    if (compareVersions(next, patch) !== 1) throw new Error(`补丁号 ${next} 不大于上一个 ${patch}`)
    return next
}

// 读一个数据文件并转成补丁里的 JSON 字节。角色数据 _gen_character.js 是 `export default {...}`，
// 去掉前面的注释和 export default 后就是 JSON（与 beta-tools/runtime.mjs 读它的方式一致）。
async function readData(root, file) {
    let text
    try { text = await readFile(path.join(root, file), 'utf8') } catch (error) { throw new Error(`读不到 ${file}：${error.message}`) }
    if (file.endsWith('.js')) text = text.replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/, '').replace(/;\s*$/, '')
    try { return new TextEncoder().encode(JSON.stringify(JSON.parse(text))) } catch (error) { throw new Error(`${file} 不是有效的 JSON：${error.message}`) }
}

export async function buildPatchPackage({paths, baseMin, baseMax, patch, previous, out, sourceRoot = repositoryRoot, signingKeyFile, now = () => new Date()}) {
    if (!paths?.length) throw new Error('没有指定要打进补丁的数据文件')
    for (const file of paths) if (!PATCH_KEY_BY_PATH.has(file)) throw new Error(`不在登记表内：${file}（可替换的有：${Object.values(PATCHABLE_DATA).join('、')}）`)
    if (new Set(paths).size !== paths.length) throw new Error('数据文件重复')
    if (!baseMin || !baseMax) throw new Error('需要 --base-min 和 --base-max')
    if (compareVersions(baseMin, '0') === null || compareVersions(baseMax, '0') === null) throw new Error('适用基础版本无法识别')
    if (compareVersions(baseMin, baseMax) > 0) throw new Error('--base-min 不能大于 --base-max')
    if (!patch === !previous) throw new Error('补丁号二选一：--patch 手动指定，或 --previous 在上一个补丁上加一')
    patch ||= await nextPatchNumber(previous)
    if (compareVersions(patch, '0') === null) throw new Error(`补丁号无法识别：${patch}`)
    if (!out) throw new Error('需要 --out')
    if (await stat(out).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error }) && (await readdir(out)).length)
        throw new Error(`输出目录 ${out} 不为空，不会覆盖`)

    const files = {}
    for (const file of [...paths].sort()) files[file] = await readData(sourceRoot, file)
    const manifest = {patch, createdAt: now().toISOString(), baseVersion: {min: baseMin, max: baseMax},
        files: await Promise.all(Object.entries(files).map(async ([file, bytes]) => ({path: file, sha256: await sha256Hex(bytes), size: bytes.length})))}
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest))
    const {privateKey, publicKey} = await loadSigningKey(signingKeyFile)
    const signature = new Uint8Array(await subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, privateKey, manifestBytes))
    // 自检：用客户端同一个校验函数验一遍，不通过就不输出任何文件
    await verifyPatchPackage({manifest: manifestBytes, signature, files, publicKey, appVersion: baseMin})

    await mkdir(path.join(out, 'files'), {recursive: true})
    for (const file of manifest.files) await writeFile(path.join(out, 'files', PATCH_KEY_BY_PATH.get(file.path) + '.json'), files[file.path])
    await writeFile(path.join(out, 'manifest.json'), manifestBytes)
    await writeFile(path.join(out, 'manifest.sig'), signature)
    return {patch, out, manifest, publicKey: toBase64(publicKey)}
}

const VALUE_FLAGS = new Set(['out', 'base-min', 'base-max', 'patch', 'previous', 'source-root'])
export function parseArguments(argv) {
    const [command, ...rest] = argv, options = {}, positional = []
    for (let i = 0; i < rest.length; i++) {
        if (!rest[i].startsWith('--')) { positional.push(rest[i]); continue }
        const name = rest[i].slice(2)
        if (!VALUE_FLAGS.has(name)) throw new Error(`不认识的参数 ${rest[i]}`)
        if (rest[i + 1] === undefined || rest[i + 1].startsWith('--')) throw new Error(`${rest[i]} 需要一个值`)
        options[name] = rest[++i]
    }
    return {command, options, positional}
}

export async function main(argv, {env = process.env, log = console.log} = {}) {
    const {command, options, positional} = parseArguments(argv)
    if (command === 'keygen') {
        const result = await generateKeyFiles({out: options.out})
        log(`私钥：${result.privateFile}（只留在本机，不要提交进仓库）\n公钥：${result.publicFile}\n公钥 Base64：${result.publicKey}`)
        return result
    }
    if (command === 'build') {
        const result = await buildPatchPackage({paths: positional, baseMin: options['base-min'], baseMax: options['base-max'], patch: options.patch,
            previous: options.previous, out: options.out, sourceRoot: options['source-root'], signingKeyFile: env.MONA_PATCH_SIGNING_KEY})
        log(`补丁 ${result.patch} 已生成到 ${result.out}，适用 ${result.manifest.baseVersion.min} 到 ${result.manifest.baseVersion.max}\n` +
            result.manifest.files.map(file => `  ${file.path}  ${file.size} 字节  ${file.sha256}`).join('\n') + '\n已用客户端的校验函数自检通过。这个工具不会上传，发布由你手动完成。')
        return result
    }
    throw new Error('用法：patch-tool.mjs keygen --out <前缀> | build --base-min <版本> --base-max <版本> (--patch <补丁号> | --previous <上一个补丁>) --out <目录> <数据路径>...')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
}
