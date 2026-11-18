import { transaction } from './db.mjs'
import { createUsageStatsPruner } from './usage-stats.mjs'

// 定期清理：过期的验证码、会话、限流计数，以及超过保留期的使用统计明细。
export function createMaintenance({ pool, clock = () => new Date() }) {
    const pruneUsageStats = createUsageStatsPruner()
    async function run() {
        const now = clock()
        await transaction(pool, async db => {
            await db.query('DELETE FROM email_challenges WHERE expires_at<$1', [now])
            await db.query('DELETE FROM sessions WHERE expires_at<$1', [now])
            await db.query('DELETE FROM rate_limits WHERE window_start<$1', [new Date(now.getTime() - 86400000)])
            await pruneUsageStats(db, now)
        })
    }
    return { run }
}
