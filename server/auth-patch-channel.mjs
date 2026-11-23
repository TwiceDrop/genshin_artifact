import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import path from 'node:path'
import {AUTH_PROGRAMS, decodeAuthPrograms, PROGRAM_LIMIT} from './auth-programs.mjs'
import {isPatchFailure, verifyPatchPackage} from './patch-package.mjs'
import {PatchUpdater, patchPublicKey} from './patch-updater.mjs'

const encode = bytes => Buffer.from(bytes).toString('base64')
const decode = text => Buffer.from(text, 'base64')

// The dev server supplies the trust anchor and version once, independently of HTTP input.
export function createAuthPatchChannel({directory, version, publicKey, baseUrl, fetchImpl}) {
    const file = path.join(directory, 'auth-programs.signed.json')
    const config = {version, publicKey, baseUrl: baseUrl.replace(/\/+$/, '') + '/auth'}
    async function verify({manifestBytes, signature, files}) {
        const manifest = await verifyPatchPackage({manifest: manifestBytes, signature, files, publicKey: patchPublicKey(publicKey), appVersion: version, registry: AUTH_PROGRAMS})
        return {info: {status: 'applied', patch: manifest.patch, baseVersion: manifest.baseVersion, files: manifest.files}, programs: decodeAuthPrograms(files)}
    }
    async function restore() {
        try {
            const raw = await readFile(file, 'utf8')
            const pack = JSON.parse(raw)
            return await verify({manifestBytes: decode(pack.manifest), signature: decode(pack.signature),
                files: Object.fromEntries(Object.entries(pack.files).map(([name, bytes]) => [name, decode(bytes)]))})
        } catch (error) {
            if (error.code === 'ENOENT') return {info: {status: 'none'}, programs: {}}
            return {info: {status: 'rejected', stage: error.stage || '读取', reason: isPatchFailure(error) ? error.message : '登录补丁存档无法读取'}, programs: {}}
        }
    }
    let active = restore()
    const updater = new PatchUpdater({registry: AUTH_PROGRAMS, fileLimit: PROGRAM_LIMIT, fetchImpl, store: {
        latestPatch: async () => (await active).info.patch,
        async install({manifestBytes, signature, files}) {
            const candidate = await verify({manifestBytes, signature, files})
            const envelope = {manifest: encode(manifestBytes), signature: encode(signature),
                files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, encode(bytes)]))}
            await mkdir(directory, {recursive: true})
            const temporary = file + '.' + randomUUID() + '.tmp'
            try {
                await writeFile(temporary, JSON.stringify(envelope), {flag: 'wx'})
                await rename(temporary, file)
                active = Promise.resolve(candidate)
            } finally { await rm(temporary, {force: true}) }
        },
    }})
    return {
        check: () => updater.check(config),
        info: async () => ({...(await active).info, lastCheck: updater.status()}),
        programs: async () => (await active).programs,
    }
}
