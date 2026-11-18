export class ApiError extends Error {
    constructor(status, code, message, details = {}) {
        super(message); Object.assign(this, { status, code, details })
    }
}
export const invalid = message => new ApiError(400, 'INVALID_INPUT', message)
export const missing = () => new ApiError(404, 'NOT_FOUND', '记录不存在')
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', '登录已过期，请重新登录')
