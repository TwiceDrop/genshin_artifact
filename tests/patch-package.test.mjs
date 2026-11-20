import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyPatchPackage, checkBaseVersion, sha256Hex, isPatchFailure} from '../server/patch-package.mjs'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'
import {testKeyPair, makeSignedPackage, signBytes} from './helpers/patch-signing.mjs'

const WEAPONS = PATCHABLE_DATA.weapons, SIGNATURE = PATCHABLE_DATA.signatureWeapons
const keys = await testKeyPair()
const other = await testKeyPair()
const verify = (pack, overrides = {}) => verifyPatchPackage({manifest: pack.manifest, signature: pack.signature, files: pack.files, publicKey: keys.publicKey, appVersion: '7.2.05EA', ...overrides})
const rejects = (promise, stage, pattern) => assert.rejects(promise, error => isPatchFailure(error) && error.stage === stage && (!pattern || pattern.test(error.message)), `expected a ${stage} failure`)
const clone = pack => ({...pack, files: {...pack.files}})
// 把清单改成另一份内容并用测试私钥重新签名，用来单独测试签名之后的检查
const resign = async (pack, change) => {
    const manifest = structuredClone(pack.manifestObject); change(manifest)
    const bytes = new TextEncoder().encode(JSON.stringify(manifest))
    return {...pack, manifest: bytes, signature: await signBytes(keys.privateKey, bytes), manifestObject: manifest}
}

test('sha256Hex matches a known digest', async () => {
    assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('a correctly signed package with matching files passes and returns its manifest', async () => {
    const pack = await makeSignedPackage(keys.privateKey, {[WEAPONS]: {weapons: []}, [SIGNATURE]: {weapons: []}})
    const manifest = await verify(pack)
    assert.equal(manifest.patch, '7.2.05EA.01')
    assert.deepEqual(manifest.files.map(file => file.path).sort(), [WEAPONS, SIGNATURE].sort())
    assert.deepEqual(manifest.baseVersion, {min: '7.2.05EA', max: '7.2.05EA.99'})
})

test('changing a single byte of the manifest fails the signature before the content is read', async () => {
    const pack = await makeSignedPackage(keys.privateKey)
    const bytes = new Uint8Array(pack.manifest); bytes[bytes.length - 3] ^= 1
    await rejects(verify({...pack, manifest: bytes}), '签名')
    // 清单被改得不再是 JSON 时仍然先报签名，而不是清单
    await rejects(verify({...pack, manifest: new TextEncoder().encode('not json')}), '签名')
})

test('a signature made with another key, a truncated signature and a bad public key all fail the signature stage', async () => {
    const pack = await makeSignedPackage(other.privateKey)
    await rejects(verify(pack), '签名', /不正确/)
    const good = await makeSignedPackage(keys.privateKey)
    await rejects(verify({...good, signature: good.signature.slice(0, 63)}), '签名')
    await rejects(verify(good, {publicKey: new Uint8Array(65)}), '签名', /无法验证/)
})

test('a file changed after signing fails the hash stage', async () => {
    const pack = await makeSignedPackage(keys.privateKey)
    const tampered = clone(pack); tampered.files[WEAPONS] = new TextEncoder().encode('{"weapons":[1]}')
    await rejects(verify(tampered), '哈希', /大小/)
    const sameSizeDifferent = clone(pack)
    const bytes = new Uint8Array(pack.files[WEAPONS]); bytes[bytes.length - 3] ^= 1; sameSizeDifferent.files[WEAPONS] = bytes
    await rejects(verify(sameSizeDifferent), '哈希', /sha256/)
    const shorter = clone(pack); shorter.files[WEAPONS] = pack.files[WEAPONS].slice(0, -1)
    await rejects(verify(shorter), '哈希', /大小/)
})

test('paths outside the registry, traversal paths and duplicated paths fail the path stage', async () => {
    const pack = await makeSignedPackage(keys.privateKey)
    for (const badPath of ['beta-data/team-engine/character-packages.mjs', '../outside.json', '/etc/passwd', 'beta-data/../beta-data/weapons-release-71.json']) {
        const forged = await resign(pack, manifest => { manifest.files[0].path = badPath })
        await rejects(verify({...forged, files: {[badPath]: pack.files[WEAPONS]}}), '路径')
    }
    const duplicated = await resign(pack, manifest => { manifest.files.push({...manifest.files[0]}) })
    await rejects(verify(duplicated), '路径', /重复/)
})

test('missing and extra files fail the path stage', async () => {
    const pack = await makeSignedPackage(keys.privateKey, {[WEAPONS]: {weapons: []}, [SIGNATURE]: {weapons: []}})
    const missing = clone(pack); delete missing.files[SIGNATURE]
    await rejects(verify(missing), '路径', /不一致/)
    const single = await makeSignedPackage(keys.privateKey)
    const extra = clone(single); extra.files[SIGNATURE] = new TextEncoder().encode('{}')
    await rejects(verify(extra), '路径', /不一致/)
})

test('a signed but malformed manifest fails the manifest stage', async () => {
    const pack = await makeSignedPackage(keys.privateKey)
    for (const change of [m => { m.patch = '' }, m => { delete m.createdAt }, m => { m.createdAt = 'yesterday' }, m => { m.baseVersion = {min: 'x', max: '7.2.05EA'} },
        m => { m.baseVersion = {min: '7.2.05EA'} }, m => { m.files = [] }, m => { m.files[0].sha256 = 'ABC' }, m => { m.files[0].size = -1 }]) {
        await rejects(verify(await resign(pack, change)), '清单')
    }
    const notJson = new TextEncoder().encode('{broken')
    await rejects(verify({...pack, manifest: notJson, signature: await signBytes(keys.privateKey, notJson)}), '清单', /JSON/)
})

test('the base version range is inclusive and an unrecognised app version is refused', async () => {
    const pack = await makeSignedPackage(keys.privateKey, undefined, {min: '7.2.05EA', max: '7.2.05EA.99'})
    for (const version of ['7.2.05EA', '7.2.05EA.01', '7.2.05EA.99']) assert.equal((await verify(pack, {appVersion: version})).patch, '7.2.05EA.01', version)
    for (const version of ['7.2.04', '7.2.05', '7.2.05.01', '7.2.06EA']) await rejects(verify(pack, {appVersion: version}), '版本', /只适用于/)
    await rejects(verify(pack, {appVersion: 'unknown'}), '版本', /无法识别/)
    await rejects(verify(pack, {appVersion: undefined}), '版本', /无法识别/)
    assert.throws(() => checkBaseVersion({patch: 'p', baseVersion: {min: '7.2.05EA', max: '7.2.05EA'}}, '7.2.05EA.01'), {stage: '版本'})
})

test('verification reports the first failing stage in a fixed order: signature, manifest, path, hash, version', async () => {
    const pack = await makeSignedPackage(keys.privateKey)
    const bad = clone(pack); bad.files[WEAPONS] = new TextEncoder().encode('x')
    await rejects(verify(bad, {appVersion: '7.2.04'}), '哈希')
    await rejects(verify(pack, {appVersion: '7.2.04'}), '版本')
    await rejects(verify(bad, {publicKey: other.publicKey, appVersion: '7.2.04'}), '签名')
})
