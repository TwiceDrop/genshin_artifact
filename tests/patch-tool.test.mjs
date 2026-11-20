import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {generateKeyFiles, buildPatchPackage, nextPatchNumber, parseArguments, main} from '../beta-tools/patch-tool.mjs'
import {verifyPatchPackage} from '../server/patch-package.mjs'
import {PATCHABLE_DATA} from '../beta-data/data-overlay.mjs'

// 临时目录放在被忽略的 .cache/test 下，每个测试用完删除；密钥是现生成的测试密钥
const base = fileURLToPath(new URL('../.cache/test/patch-tool/', import.meta.url))
await mkdir(base, {recursive: true})
const WEAPONS = PATCHABLE_DATA.weapons, SIGNATURE = PATCHABLE_DATA.signatureWeapons, CHARACTERS = PATCHABLE_DATA.characters
async function withWorkspace(run) {
    const directory = await mkdtemp(base)
    try {
        const source = path.join(directory, 'source')
        for (const [file, text] of Object.entries({
            [WEAPONS]: '{\n  "weapons": [{"name": "Synthetic"}]\n}\n',
            [SIGNATURE]: '{"weapons": []}',
            [CHARACTERS]: '// 合成的角色数据\nexport default [{"name": "Synthetic"}]\n',
        })) { await mkdir(path.dirname(path.join(source, file)), {recursive: true}); await writeFile(path.join(source, file), text) }
        const keys = await generateKeyFiles({out: path.join(directory, 'keys', 'test')})
        return await run({directory, source, keys, out: path.join(directory, 'out')})
    } finally { await rm(directory, {recursive: true, force: true}) }
}
const options = ({source, keys, out}, extra = {}) => ({paths: [WEAPONS], baseMin: '7.2.05EA', baseMax: '7.2.05EA.99', patch: '7.2.05EA.01', out, sourceRoot: source, signingKeyFile: keys.privateFile, ...extra})
// 从磁盘把打出来的包读回来，按客户端的方式校验
async function readBack(out, publicKey, appVersion = '7.2.05EA') {
    const manifest = await readFile(path.join(out, 'manifest.json'))
    const parsed = JSON.parse(manifest.toString('utf8')), files = {}
    for (const file of parsed.files) files[file.path] = await readFile(path.join(out, 'files', Object.entries(PATCHABLE_DATA).find(([, p]) => p === file.path)[0] + '.json'))
    return verifyPatchPackage({manifest, signature: await readFile(path.join(out, 'manifest.sig')), files, publicKey: new Uint8Array(Buffer.from(publicKey, 'base64')), appVersion})
}

test('keygen writes a key pair, never overwrites an existing key and prints only the public key', () => withWorkspace(async ({directory, keys}) => {
    const privatePem = await readFile(keys.privateFile, 'utf8')
    assert.match(privatePem, /^-----BEGIN PRIVATE KEY-----/)
    assert.equal(Buffer.from(keys.publicKey, 'base64').length, 65)
    assert.equal((await readFile(keys.publicFile, 'utf8')).trim(), keys.publicKey)
    await assert.rejects(generateKeyFiles({out: path.join(directory, 'keys', 'test')}), {code: 'EEXIST'})
    assert.equal(await readFile(keys.privateFile, 'utf8'), privatePem, 'the existing private key must be untouched')
    const lines = []
    await main(['keygen', '--out', path.join(directory, 'keys', 'second')], {log: text => lines.push(text)})
    assert.ok(!lines.join('\n').includes('PRIVATE KEY') && !lines.join('\n').includes((await readFile(path.join(directory, 'keys', 'second.key'), 'utf8')).split('\n')[1]))
}))

test('a built package passes the client verification when read back from disk', () => withWorkspace(async context => {
    const result = await buildPatchPackage(options(context, {paths: [WEAPONS, SIGNATURE, CHARACTERS], now: () => new Date('2026-11-20T08:00:00Z')}))
    assert.equal(result.manifest.createdAt, '2026-11-20T08:00:00.000Z')
    assert.deepEqual(result.manifest.files.map(file => file.path), [CHARACTERS, WEAPONS, SIGNATURE].sort())
    assert.deepEqual((await readdir(context.out)).sort(), ['files', 'manifest.json', 'manifest.sig'])
    assert.deepEqual((await readdir(path.join(context.out, 'files'))).sort(), ['characters.json', 'signatureWeapons.json', 'weapons.json'])
    const manifest = await readBack(context.out, context.keys.publicKey)
    assert.equal(manifest.patch, '7.2.05EA.01')
    assert.equal((await readFile(path.join(context.out, 'manifest.sig'))).length, 64)
}))

test('data files are converted to compact JSON and the character module loses its export wrapper', () => withWorkspace(async context => {
    await buildPatchPackage(options(context, {paths: [WEAPONS, CHARACTERS]}))
    assert.equal(await readFile(path.join(context.out, 'files', 'weapons.json'), 'utf8'), '{"weapons":[{"name":"Synthetic"}]}')
    assert.equal(await readFile(path.join(context.out, 'files', 'characters.json'), 'utf8'), '[{"name":"Synthetic"}]')
}))

test('the real data files of the repository can be packed and verified', () => withWorkspace(async context => {
    await buildPatchPackage(options(context, {paths: Object.values(PATCHABLE_DATA), sourceRoot: undefined}))
    assert.equal((await readBack(context.out, context.keys.publicKey)).files.length, Object.keys(PATCHABLE_DATA).length)
}))

test('the next patch number follows the previous manifest and keeps the width', () => withWorkspace(async context => {
    await buildPatchPackage(options(context, {patch: '7.2.05EA.01'}))
    assert.equal(await nextPatchNumber(context.out), '7.2.05EA.02', 'a package directory works')
    assert.equal(await nextPatchNumber(path.join(context.out, 'manifest.json')), '7.2.05EA.02', 'and so does manifest.json')
    const second = path.join(context.directory, 'second')
    const built = await buildPatchPackage(options(context, {patch: undefined, previous: context.out, out: second}))
    assert.equal(built.patch, '7.2.05EA.02')
    for (const [previous, next] of [['7.2.05EA.09', '7.2.05EA.10'], ['7.2.05EA.99', '7.2.05EA.100'], ['7.2.05.01', '7.2.05.02']]) {
        const file = path.join(context.directory, 'previous.json')
        await writeFile(file, JSON.stringify({patch: previous}))
        assert.equal(await nextPatchNumber(file), next)
    }
    const bare = path.join(context.directory, 'bare.json')
    await writeFile(bare, JSON.stringify({patch: '7.2.05EA'}))
    await assert.rejects(nextPatchNumber(bare), /没有补丁段/)
}))

test('the patch number is given by exactly one of --patch and --previous', () => withWorkspace(async context => {
    await assert.rejects(buildPatchPackage(options(context, {patch: undefined})), /二选一/)
    await assert.rejects(buildPatchPackage(options(context, {previous: context.out})), /二选一/)
    await assert.rejects(buildPatchPackage(options(context, {patch: 'unknown'})), /无法识别/)
    assert.deepEqual(await readdir(context.directory).then(names => names.filter(name => name === 'out')), [])
}))

test('bad input is refused and leaves no output behind', () => withWorkspace(async context => {
    const refused = async (change, pattern) => {
        await assert.rejects(buildPatchPackage(options(context, change)), pattern)
        assert.deepEqual((await readdir(context.directory)).filter(name => name === 'out'), [], 'nothing may be written for ' + pattern)
    }
    await refused({paths: ['beta-data/team-engine/character-packages.mjs']}, /不在登记表内/)
    await refused({paths: ['../outside.json']}, /不在登记表内/)
    await refused({paths: [WEAPONS, WEAPONS]}, /重复/)
    await refused({paths: []}, /没有指定/)
    await refused({baseMin: '7.2.06', baseMax: '7.2.05'}, /不能大于/)
    await refused({baseMin: 'x'}, /无法识别/)
    await refused({sourceRoot: path.join(context.directory, 'missing')}, /读不到/)
    await writeFile(path.join(context.source, WEAPONS), '{not json')
    await refused({}, /不是有效的 JSON/)
    await writeFile(path.join(context.source, WEAPONS), '{}')
    await refused({signingKeyFile: undefined}, /MONA_PATCH_SIGNING_KEY/)
    await writeFile(path.join(context.directory, 'bad.key'), 'nope')
    await refused({signingKeyFile: path.join(context.directory, 'bad.key')}, /PKCS8/)
}))

test('a non-empty output directory is never overwritten', () => withWorkspace(async context => {
    await mkdir(context.out, {recursive: true})
    await writeFile(path.join(context.out, 'keep.txt'), 'x')
    await assert.rejects(buildPatchPackage(options(context)), /不为空/)
    assert.deepEqual(await readdir(context.out), ['keep.txt'])
    await rm(path.join(context.out, 'keep.txt'))
    await buildPatchPackage(options(context))
    assert.ok((await readdir(context.out)).includes('manifest.json'), 'an empty directory is fine')
}))

test('the command line reads the key from the environment and rejects unknown arguments', () => withWorkspace(async context => {
    const lines = []
    const result = await main(['build', '--base-min', '7.2.05EA', '--base-max', '7.2.05EA.99', '--patch', '7.2.05EA.01', '--out', context.out, '--source-root', context.source, WEAPONS],
        {env: {MONA_PATCH_SIGNING_KEY: context.keys.privateFile}, log: text => lines.push(text)})
    assert.equal(result.patch, '7.2.05EA.01')
    assert.match(lines.join('\n'), /不会上传/)
    await assert.rejects(main(['build', '--base-min', '7.2.05EA', '--out', context.out], {env: {}}), /没有指定/)
    assert.throws(() => parseArguments(['build', '--publish', 'yes']), /不认识的参数/)
    assert.throws(() => parseArguments(['build', '--out']), /需要一个值/)
    await assert.rejects(main(['deploy'], {env: {}}), /用法/)
}))
