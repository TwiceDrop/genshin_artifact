// 测试用的补丁签名夹具：每次现生成一对测试密钥，私钥只存在于内存里，不是任何真实发布用的密钥。
// 真实的打包和签名在任务 07 的工具里做，这里只给测试造合成补丁包用。
import {PATCHABLE_DATA} from '../../beta-data/data-overlay.mjs'
import {sha256Hex} from '../../server/patch-package.mjs'

const subtle = globalThis.crypto.subtle
const encoder = new TextEncoder()

export async function testKeyPair() {
    const pair = await subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify'])
    return {privateKey: pair.privateKey, publicKey: new Uint8Array(await subtle.exportKey('raw', pair.publicKey))}
}

export async function signBytes(privateKey, bytes) {
    return new Uint8Array(await subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, privateKey, bytes))
}

// contents: {登记表路径: 任意可序列化的值}；返回 verifyPatchPackage 需要的 {manifest, signature, files}
export async function makeSignedPackage(privateKey, contents = {[PATCHABLE_DATA.weapons]: {weapons: [{name: 'Synthetic'}]}},
    {patch = '7.2.05EA.01', min = '7.2.05EA', max = '7.2.05EA.99', createdAt = '2026-11-20T00:00:00Z'} = {}) {
    const files = Object.fromEntries(Object.entries(contents).map(([file, value]) => [file, encoder.encode(JSON.stringify(value))]))
    const manifest = {patch, createdAt, baseVersion: {min, max},
        files: await Promise.all(Object.entries(files).map(async ([file, bytes]) => ({path: file, sha256: await sha256Hex(bytes), size: bytes.length})))}
    const manifestBytes = encoder.encode(JSON.stringify(manifest))
    return {manifest: manifestBytes, signature: await signBytes(privateKey, manifestBytes), files, manifestObject: manifest}
}
