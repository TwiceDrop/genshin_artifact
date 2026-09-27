import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

// Pass secrets only through stdin. DPAPI binds the encrypted file to this Windows user.
export function dpapi(value, decrypt = false) {
    if (process.platform !== 'win32') throw new Error('Cookie 加密存储目前支持 Windows 本地版')
    return new Promise((resolve, reject) => {
        const script = `Add-Type -AssemblyName System.Security; $inputBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd()); $outputBytes = [Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($inputBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($outputBytes))`
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
        let output = ''
        const timer = setTimeout(() => child.kill(), 15000)
        const fail = () => reject(new Error('本机 Cookie 加密存储失败；请检查当前 Windows 用户权限'))
        child.stdout.on('data', data => { output += data })
        child.stderr.resume()
        child.stdin.on('error', () => {})
        child.on('error', () => { clearTimeout(timer); fail() })
        child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(Buffer.from(output.trim(), 'base64')) : fail() })
        child.stdin.end(Buffer.from(value).toString('base64'))
    })
}

export class CredentialStore {
    constructor(file, codec = dpapi) { this.file = file; this.codec = codec; this.queue = Promise.resolve(); this.loaded = null }
    async load() {
        if (!this.loaded) this.loaded = (async () => {
            let encrypted
            try { encrypted = await readFile(this.file) } catch (e) { if (e.code === 'ENOENT') return { version: 1, accounts: [] }; throw new Error('无法读取本机 Cookie 库') }
            try {
                const data = JSON.parse((await this.codec(encrypted, true)).toString('utf8'))
                if (data.version !== 1 || !Array.isArray(data.accounts)) throw new Error()
                return data
            } catch { throw new Error('无法解密本机 Cookie 库，请使用保存它的 Windows 用户；原文件未改动') }
        })()
        return this.loaded
    }
    async all() { await this.queue; return structuredClone((await this.load()).accounts) }
    async get(id) { return (await this.all()).find(a => a.id === id) }
    mutate(fn) {
        const operation = this.queue.then(async () => {
            const data = structuredClone(await this.load()), result = fn(data.accounts)
            const encrypted = await this.codec(Buffer.from(JSON.stringify(data)))
            const temp = this.file + '.' + randomUUID() + '.tmp'
            try {
                await mkdir(path.dirname(this.file), { recursive: true })
                await writeFile(temp, encrypted, { mode: 0o600, flag: 'wx' })
                await rename(temp, this.file)
            } catch { await unlink(temp).catch(() => {}); throw new Error('Cookie 保存失败，请检查本机存储空间和权限') }
            this.loaded = Promise.resolve(data)
            return result
        })
        this.queue = operation.catch(() => {})
        return operation
    }
    upsert(account) {
        return this.mutate(accounts => {
            const index = accounts.findIndex(a => a.id === account.id), previous = accounts[index]
            const value = { ...previous, ...account, createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
            if (index < 0) accounts.push(value); else accounts[index] = value
        })
    }
    update(id, patch) { return this.mutate(accounts => { const account = accounts.find(a => a.id === id); if (account) Object.assign(account, patch) }) }
    remove(id) { return this.mutate(accounts => { const index = accounts.findIndex(a => a.id === id); if (index >= 0) accounts.splice(index, 1) }) }
}

export { normalizeCookie, publicAccount } from './cookie.mjs'
