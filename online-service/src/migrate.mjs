import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createPool, transaction } from './db.mjs'
import { loadConfig } from './config.mjs'

export async function migrate(pool) {
    await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    const directory = new URL('../migrations/', import.meta.url)
    const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()
    await transaction(pool, async db => {
        await db.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE')
        const applied = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map(row => row.name))
        for (const name of files) {
            if (applied.has(name)) continue
            await db.query(await readFile(new URL(name, directory), 'utf8'))
            await db.query('INSERT INTO schema_migrations(name) VALUES($1)', [name])
        }
    })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const pool = createPool(loadConfig(process.env, { mailRequired: false, vaultRequired: false }))
    try { await migrate(pool); console.log('Database migrations applied') }
    finally { await pool.end() }
}
