import { setTimeout as delay } from 'node:timers/promises'
import { loadConfig } from './config.mjs'
import { createPool } from './db.mjs'
import { createVault } from './crypto.mjs'
import { createWorker } from './worker.mjs'
import { logError } from './http.mjs'

const config = loadConfig(process.env, { mailRequired: false })
const pool = createPool(config)
const worker = createWorker({ pool, config, vault: createVault(config.vaultKey), onError: logError })
let stopped = false
process.on('SIGTERM', () => { stopped = true; worker.stop() })
process.on('SIGINT', () => { stopped = true; worker.stop() })
console.log(JSON.stringify({ event: 'worker_ready' }))
try {
    while (!stopped) {
        try { await worker.tick() }
        catch (error) { logError(error, 'worker_tick') }
        if (!stopped) await delay(config.workerPollMs)
    }
} finally { await pool.end() }
