export class ApiError extends Error {
    constructor(status, code, message, details = {}) {
        super(message); Object.assign(this, { status, code, details })
    }
}
export const invalid = message => new ApiError(400, 'INVALID_INPUT', message)
export const missing = () => new ApiError(404, 'NOT_FOUND', '记录不存在')
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', '登录已过期，请重新登录')
export function gameFailure(error) {
    const retcode = Number(error.retcode)
    if ([-100, 10001, 10002].includes(retcode)) return { status: 'expired', code: 'COOKIE_EXPIRED', message: '游戏登录凭据已失效，请更新托管 Cookie', retry: false }
    if ([1034, 5003].includes(retcode)) return { status: 'verification_required', code: 'GAME_VERIFICATION_REQUIRED', message: `游戏服务要求账号或设备验证（${retcode}），请在官方应用处理后重试`, retry: false }
    if (error.code === 'INCOMPLETE_SNAPSHOT') return { status: 'error', code: error.code, message: '游戏返回的角色详情不完整，已保留上次成功快照', retry: true }
    if (Number.isFinite(retcode)) return { status: 'error', code: 'GAME_REQUEST_FAILED', message: `游戏数据读取失败（${retcode}）`, retry: false }
    // Do not expose raw network, database, SMTP or upstream error bodies.
    return { status: 'error', code: 'GAME_NETWORK_ERROR', message: '游戏数据读取未完成，请稍后重试', retry: true }
}
