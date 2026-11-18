import { setTimeout as delay } from 'node:timers/promises'
import { loadConfig } from './config.mjs'
import { createPool } from './db.mjs'
import { createMaintenance } from './maintenance.mjs'
import { logError } from './http.mjs'

const config = loadConfig(process.env, { mailRequired: false, vaultRequired: false })
const pool = createPool(config)
const maintenance = createMaintenance({ pool })
const stop = new AbortController()
process.on('SIGTERM', () => stop.abort())
process.on('SIGINT', () => stop.abort())
console.log(JSON.stringify({ event: 'maintenance_ready' }))
try {
    while (!stop.signal.aborted) {
        try { await maintenance.run() }
        catch (error) { logError(error, 'maintenance_run') }
        await delay(config.maintenancePollMs, undefined, { signal: stop.signal }).catch(error => { if (error.name !== 'AbortError') throw error })
    }
} finally { await pool.end() }
