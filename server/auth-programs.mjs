import {patchFailure} from './patch-package.mjs'

export const AUTH_PROGRAMS = new Map([
    ['server/auth-rules/qr-exchange.json', 'qrExchange'],
    ['server/auth-rules/cloud-import.json', 'cloudImport'],
])
export const PROGRAM_LIMIT = 16384

// A loop-free expression language. Each input read yields one scalar, never a host object.
export function compileProjection(program) {
    const fail = () => { throw patchFailure('程序', '登录补丁表达式无效或超出限制') }
    const key = value => typeof value === 'string' && /^[A-Za-z_]\w{0,63}$/.test(value)
        && !['constructor', 'prototype', '__proto__'].includes(value)
    let count = 0
    function compile(node, depth) {
        if (++count > 256 || depth > 16) fail()
        if (node === null || ['boolean', 'number'].includes(typeof node)) return () => node
        if (typeof node === 'string' && node.length <= 128) return () => node
        if (!node || typeof node !== 'object' || Array.isArray(node)) fail()
        const entries = Object.entries(node)
        const sub = child => compile(child, depth + 1)
        if (entries.length === 1) {
            const [[op, arg]] = entries
            if (op === '$read') {
                const parts = typeof arg === 'string' && arg.split('.')
                if (!parts || parts.length > 8 || !parts.every(key)) fail()
                return input => {
                    let value = input
                    for (const part of parts) {
                        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return null
                        value = value[part]
                    }
                    return ['boolean', 'number', 'string'].includes(typeof value) ? value : null
                }
            }
            if (op === '$if' || op === '$eq') {
                if (!Array.isArray(arg) || arg.length !== (op === '$if' ? 3 : 2)) fail()
                const [a, b, c] = arg.map(sub)
                return op === '$if' ? input => a(input) ? b(input) : c(input) : input => a(input) === b(input)
            }
        }
        const fields = entries.map(([name, child]) => {
            if (!key(name)) fail()
            return [name, sub(child)]
        })
        return input => Object.fromEntries(fields.map(([name, fn]) => [name, fn(input)]))
    }
    return compile(program, 0)
}

// A signed null hook restores the built-in behavior. Each manifest is a complete snapshot.
export function decodeAuthPrograms(files) {
    const programs = {}
    for (const [file, bytes] of Object.entries(files)) {
        if (bytes.length > PROGRAM_LIMIT) throw patchFailure('程序', '登录补丁文件过大')
        let source
        try { source = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) }
        catch { throw patchFailure('程序', '登录补丁 JSON 无效') }
        if (source === null) continue
        const qr = AUTH_PROGRAMS.get(file) === 'qrExchange'
        const hooks = qr ? ['request', 'response'] : ['fields']
        if (!source || typeof source !== 'object' || Object.keys(source).length !== hooks.length || !hooks.every(k => Object.hasOwn(source, k)))
            throw patchFailure('程序', '登录补丁入口无效')
        programs[AUTH_PROGRAMS.get(file)] = Object.fromEntries(hooks.map(k => [k, compileProjection(source[k])]))
    }
    return programs
}
