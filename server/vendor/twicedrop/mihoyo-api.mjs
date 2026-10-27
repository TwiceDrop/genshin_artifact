import crypto from "node:crypto"

export const MIHOYO_API = Object.freeze({
  qrAppId: "ddxf5dufpuyo",
  qrClientType: "3",
  qrUserAgent: "HYPContainer/1.3.3.182",
  createQr:
    "https://passport-api.mihoyo.com/account/ma-cn-passport/app/createQRLogin",
  queryQr:
    "https://passport-api.mihoyo.com/account/ma-cn-passport/app/queryQRLoginStatus",
  cookieToken:
    "https://passport-api.mihoyo.com/account/auth/api/getCookieAccountInfoBySToken",
  ltoken:
    "https://passport-api.mihoyo.com/account/auth/api/getLTokenBySToken",
})

export class MihoyoApiError extends Error {
  constructor(code, message) {
    super(message)
    this.name = "MihoyoApiError"
    this.code = code
  }
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

function normalizeQrStatus(data) {
  const statusMap = {
    Created: "Init",
    Scanned: "Scanned",
    Confirmed: "Confirmed",
  }
  const status = statusMap[data?.status]
  if (!status) return null

  let raw = ""
  if (status === "Confirmed") {
    const stoken = data?.tokens?.find(item => item?.token)?.token
    const uid = String(data?.user_info?.aid || "")
    const mid = data?.user_info?.mid
    if (!/^\d+$/.test(uid) || !stoken || !mid) {
      throw new MihoyoApiError("INVALID_CONFIRM_RESPONSE", "扫码确认结果缺少账号凭据")
    }
    raw = JSON.stringify({ uid, mid, stoken })
  }

  return { stat: status, payload: { raw } }
}

function safeCookieValue(value) {
  const text = String(value || "")
  if (!text || /[;\r\n]/.test(text)) {
    throw new MihoyoApiError("INVALID_TOKEN_VALUE", "扫码登录凭据格式无效")
  }
  return text
}

export class MihoyoApiClient {
  constructor({
    fetchImpl = globalThis.fetch,
    randomUuid = crypto.randomUUID,
    requestTimeoutMs = 10_000,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("当前 Node.js 环境不支持 fetch")
    }
    this.fetch = fetchImpl
    this.randomUuid = randomUuid
    this.requestTimeoutMs = requestTimeoutMs
  }

  createDeviceId() {
    return this.randomUuid()
  }

  buildQrHeaders(device) {
    return {
      Accept: "application/json, text/plain, */*",
      "User-Agent": MIHOYO_API.qrUserAgent,
      "Content-Type": "application/json",
      "x-rpc-app_id": MIHOYO_API.qrAppId,
      "x-rpc-client_type": MIHOYO_API.qrClientType,
      "x-rpc-device_id": device,
    }
  }

  async requestJson(url, options = {}) {
    const timeout = createTimeoutSignal(this.requestTimeoutMs)
    try {
      const response = await this.fetch(url, { ...options, signal: timeout.signal })
      if (!response?.ok) {
        throw new MihoyoApiError("HTTP_ERROR", "米游社接口请求失败")
      }
      try {
        return await response.json()
      } catch {
        throw new MihoyoApiError("INVALID_RESPONSE", "米游社接口返回了无效数据")
      }
    } catch (error) {
      if (error instanceof MihoyoApiError) throw error
      const code = error?.name === "AbortError" ? "REQUEST_TIMEOUT" : "NETWORK_ERROR"
      throw new MihoyoApiError(code, "米游社接口暂时不可用")
    } finally {
      timeout.clear()
    }
  }

  async createQr(device) {
    const data = await this.requestJson(MIHOYO_API.createQr, {
      method: "POST",
      headers: this.buildQrHeaders(device),
      body: "{}",
    })

    if (Number(data?.retcode) !== 0 || !data?.data?.url || !data?.data?.ticket) {
      throw new MihoyoApiError("CREATE_QR_FAILED", "获取登录二维码失败")
    }

    let qrUrl
    try {
      qrUrl = new URL(data.data.url)
    } catch {
      throw new MihoyoApiError("INVALID_QR_URL", "登录二维码地址无效")
    }

    const expireSeconds = Number(qrUrl.searchParams.get("expire"))
    const expiresAt = Number.isFinite(expireSeconds) && expireSeconds > 0
      ? expireSeconds * 1000
      : null

    return {
      url: data.data.url,
      ticket: String(data.data.ticket),
      expiresAt,
    }
  }

  async queryQr(device, ticket) {
    const response = await this.requestJson(MIHOYO_API.queryQr, {
      method: "POST",
      headers: this.buildQrHeaders(device),
      body: JSON.stringify({ ticket }),
    })

    if (Number(response?.retcode) !== 0) return response

    const normalized = normalizeQrStatus(response?.data)
    if (!normalized) {
      throw new MihoyoApiError("UNKNOWN_QR_STATUS", "米游社返回了未知扫码状态")
    }
    return { retcode: 0, message: response?.message, data: normalized }
  }

  async exchangeQrLogin({ uid, mid, stoken }) {
    const accountId = String(uid || "")
    if (!/^\d+$/.test(accountId) || !mid || !stoken) {
      throw new MihoyoApiError("INVALID_QR_CREDENTIAL", "扫码登录凭据无效")
    }

    const safeStoken = safeCookieValue(stoken)
    const safeMid = safeCookieValue(mid)
    const authCookie = `stoken=${safeStoken}; mid=${safeMid};`
    const headers = { Accept: "application/json", Cookie: authCookie }

    const cookieUrl = new URL(MIHOYO_API.cookieToken)
    cookieUrl.searchParams.set("stoken", safeStoken)
    const ltokenUrl = new URL(MIHOYO_API.ltoken)
    ltokenUrl.searchParams.set("stoken", safeStoken)

    const [cookieData, ltokenData] = await Promise.all([
      this.requestJson(cookieUrl, { method: "GET", headers }),
      this.requestJson(ltokenUrl, { method: "GET", headers }),
    ])

    const cookieToken = cookieData?.data?.cookie_token
    const ltoken = ltokenData?.data?.ltoken
    const returnedAccountId = String(cookieData?.data?.uid || accountId)
    if (
      Number(cookieData?.retcode) !== 0 ||
      Number(ltokenData?.retcode) !== 0 ||
      !cookieToken ||
      !ltoken ||
      !/^\d+$/.test(returnedAccountId) ||
      returnedAccountId !== accountId
    ) {
      throw new MihoyoApiError("COOKIE_EXCHANGE_FAILED", "获取米游社 Cookie 失败")
    }

    const safeCookieToken = safeCookieValue(cookieToken)
    const safeLtoken = safeCookieValue(ltoken)
    return {
      accountId,
      cookie:
        `ltoken=${safeLtoken};ltuid=${accountId};` +
        `cookie_token=${safeCookieToken};account_id=${accountId};` +
        `stoken=${safeStoken};stuid=${accountId};mid=${safeMid};`,
    }
  }
}
