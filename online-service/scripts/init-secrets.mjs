import { randomBytes } from 'node:crypto'
import { mkdir, open, chmod } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const destination = resolve(process.argv[2] || fileURLToPath(new URL('../secrets/', import.meta.url)))
await mkdir(destination, { recursive: true, mode: 0o700 })
await chmod(destination, 0o700)

async function create(name, value) {
    let handle
    try { handle = await open(resolve(destination, name), 'wx', 0o644) }
    catch (error) {
        if (error.code === 'EEXIST') return false
        throw error
    }
    try { await handle.writeFile(`${value}\n`, 'utf8') }
    finally { await handle.close() }
    return true
}

// Keep an existing database password and its URL together; never rotate a live vault key here.
const { readFile } = await import('node:fs/promises')
const passwordPath = resolve(destination, 'db_password')
await create('db_password', randomBytes(32).toString('base64url'))
const password = (await readFile(passwordPath, 'utf8')).trim()
await create('database_url', `postgresql://mona:${encodeURIComponent(password)}@db:5432/mona`)
await create('vault_key', randomBytes(32).toString('base64'))
await create('smtp_password', '')
console.log(`Secret files prepared in ${destination}. Existing files were preserved.`)
console.log('Fill secrets/smtp_password with your SMTP password before starting the service.')
