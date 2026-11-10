import pg from 'pg'

export function createPool(config) {
    const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 10000 })
    pool.on('error', error => console.error(JSON.stringify({ event: 'database_pool_error', code: error.code || 'DATABASE_ERROR' })))
    return pool
}
export async function transaction(pool, action) {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const result = await action(client)
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally { client.release() }
}
