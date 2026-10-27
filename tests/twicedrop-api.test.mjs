// Upstream test suite, GPL-3.0; source and commit: server/vendor/twicedrop/README.md
import assert from "node:assert/strict"
import test from "node:test"

import {
  MIHOYO_API,
  MihoyoApiClient,
  MihoyoApiError,
} from "../server/vendor/twicedrop/mihoyo-api.mjs"

function jsonResponse(data, ok = true) {
  return { ok, json: async () => data }
}

test("createQr 与 queryQr 使用同一个 Passport 设备会话", async () => {
  const calls = []
  const responses = [
    jsonResponse({
      retcode: 0,
      data: {
        url: "https://user.mihoyo.com/qr?expire=2000000000",
        ticket: "ticket-1",
      },
    }),
    jsonResponse({ retcode: 0, message: "OK", data: { status: "Created" } }),
  ]
  const client = new MihoyoApiClient({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      return responses.shift()
    },
  })

  const result = await client.createQr("device-1")
  const status = await client.queryQr("device-1", result.ticket)

  assert.equal(result.ticket, "ticket-1")
  assert.equal(result.expiresAt, 2_000_000_000_000)
  assert.deepEqual(status, {
    retcode: 0,
    message: "OK",
    data: { stat: "Init", payload: { raw: "" } },
  })
  assert.equal(calls[0].url, MIHOYO_API.createQr)
  assert.equal(calls[0].options.body, "{}")
  assert.equal(calls[1].url, MIHOYO_API.queryQr)
  assert.deepEqual(JSON.parse(calls[1].options.body), { ticket: "ticket-1" })
  for (const call of calls) {
    assert.equal(call.options.headers["x-rpc-app_id"], MIHOYO_API.qrAppId)
    assert.equal(call.options.headers["x-rpc-client_type"], "3")
    assert.equal(call.options.headers["x-rpc-device_id"], "device-1")
    assert.equal(call.options.headers["User-Agent"], MIHOYO_API.qrUserAgent)
  }
})

test("Confirmed 状态只向会话层传递 SToken、MID 与账号 ID", async () => {
  const client = new MihoyoApiClient({
    fetchImpl: async () => jsonResponse({
      retcode: 0,
      data: {
        status: "Confirmed",
        tokens: [{ token: "stoken-secret" }],
        user_info: { aid: "123456789", mid: "mid-secret" },
      },
    }),
  })

  const result = await client.queryQr("device-1", "ticket-1")
  assert.equal(result.data.stat, "Confirmed")
  assert.deepEqual(JSON.parse(result.data.payload.raw), {
    uid: "123456789",
    mid: "mid-secret",
    stoken: "stoken-secret",
  })
})

test("exchangeQrLogin 生成 Yunzai-genshin 可接受的完整 Cookie", async () => {
  const calls = []
  const responses = [
    jsonResponse({
      retcode: 0,
      data: { uid: "123456789", cookie_token: "cookie-secret" },
    }),
    jsonResponse({ retcode: 0, data: { ltoken: "ltoken-secret" } }),
  ]
  const client = new MihoyoApiClient({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      return responses.shift()
    },
  })

  const result = await client.exchangeQrLogin({
    uid: "123456789",
    mid: "mid-secret",
    stoken: "stoken-secret",
  })

  assert.equal(result.accountId, "123456789")
  assert.equal(
    result.cookie,
    "ltoken=ltoken-secret;ltuid=123456789;cookie_token=cookie-secret;account_id=123456789;stoken=stoken-secret;stuid=123456789;mid=mid-secret;",
  )
  assert.match(calls[0].url, /getCookieAccountInfoBySToken\?stoken=stoken-secret/)
  assert.match(calls[1].url, /getLTokenBySToken\?stoken=stoken-secret/)
  for (const call of calls) {
    assert.equal(call.options.headers.Cookie, "stoken=stoken-secret; mid=mid-secret;")
  }
})

test("创建结果缺少 Passport ticket 时安全失败", async () => {
  const client = new MihoyoApiClient({
    fetchImpl: async () => jsonResponse({
      retcode: 0,
      data: { url: "https://user.mihoyo.com/qr" },
    }),
  })

  await assert.rejects(
    () => client.createQr("device-1"),
    error => error instanceof MihoyoApiError && error.code === "CREATE_QR_FAILED",
  )
})

test("账号不一致时拒绝生成 Cookie", async () => {
  const responses = [
    jsonResponse({ retcode: 0, data: { uid: "987654321", cookie_token: "cookie-secret" } }),
    jsonResponse({ retcode: 0, data: { ltoken: "ltoken-secret" } }),
  ]
  const client = new MihoyoApiClient({
    fetchImpl: async () => responses.shift(),
  })

  await assert.rejects(
    () => client.exchangeQrLogin({
      uid: "123456789",
      mid: "mid-secret",
      stoken: "stoken-secret",
    }),
    error => error instanceof MihoyoApiError && error.code === "COOKIE_EXCHANGE_FAILED",
  )
})

test("网络异常不会在错误信息中泄露 Token", async () => {
  const client = new MihoyoApiClient({
    fetchImpl: async () => {
      throw new Error("request contained stoken-secret")
    },
  })

  await assert.rejects(
    () => client.exchangeQrLogin({
      uid: "123456789",
      mid: "mid-secret",
      stoken: "stoken-secret",
    }),
    error => {
      assert.ok(error instanceof MihoyoApiError)
      assert.equal(error.code, "NETWORK_ERROR")
      assert.doesNotMatch(error.message, /stoken-secret|mid-secret/)
      return true
    },
  )
})
