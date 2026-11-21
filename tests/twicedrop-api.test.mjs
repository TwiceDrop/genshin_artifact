// Upstream test suite, GPL-3.0; source and commit: server/vendor/twicedrop/README.md
import assert from "node:assert/strict"
import test from "node:test"
import { MysClient } from "../server/mys.mjs"
import { communityAccount } from "../server/cookie.mjs"

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
        tokens: [{ token_type: 4, token: "other-secret" }, { token_type: 1, token: "stoken-secret" }],
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

test("确认结果只含其他类型凭据时在发起兑换前停止", async () => {
  const client = new MihoyoApiClient({
    fetchImpl: async () => jsonResponse({ retcode: 0, data: {
      status: "Confirmed", tokens: [{ token_type: 4, token: "not-an-stoken" }],
      user_info: { aid: "123456789", mid: "mid-secret" },
    } }),
  })
  await assert.rejects(client.queryQr("device-1", "ticket-1"), {code: "INVALID_CONFIRM_RESPONSE"})
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
  const cookieRequest = new URL(calls[0].url)
  assert.equal(cookieRequest.origin + cookieRequest.pathname, "https://api-takumi.mihoyo.com/auth/api/getCookieAccountInfoBySToken")
  assert.equal(cookieRequest.searchParams.get("uid"), "123456789")
  assert.equal(cookieRequest.searchParams.get("stoken"), "stoken-secret")
  assert.equal(calls[0].options.headers.Cookie, "stoken=stoken-secret; stuid=123456789;")
  const ltokenRequest = calls[1]
  assert.equal(ltokenRequest.url, "https://passport-api.mihoyo.com/account/auth/api/getLTokenBySToken?stoken=stoken-secret")
  assert.equal(ltokenRequest.options.method, "GET")
  assert.deepEqual(ltokenRequest.options.headers, {
    Accept: "application/json",
    Cookie: "stoken=stoken-secret; mid=mid-secret;",
  })
  assert.equal(ltokenRequest.options.body, undefined)
})

test("V2 SToken 使用同次扫码的 MID 兑换两项凭据", async () => {
  const cookies = []
  const client = new MihoyoApiClient({fetchImpl: async (url, options) => {
    cookies.push(options.headers.Cookie)
    return jsonResponse({retcode: 0, data: String(url) === MIHOYO_API.ltoken + "?stoken=v2_test-stoken"
      ? {ltoken: "test-ltoken"}
      : {uid: "123456789", cookie_token: "test-cookie-token"}})
  }})
  await client.exchangeQrLogin({uid: "123456789", mid: "test-mid", stoken: "v2_test-stoken"})
  assert.deepEqual(cookies, Array(2).fill("stoken=v2_test-stoken; mid=test-mid;"))
})

test("战绩扫码只兑换 LToken，返回的读取凭据不带 SToken 或 CookieToken", async () => {
  const client = new MihoyoApiClient({fetchImpl: async url => {
    assert.equal(new URL(url).pathname, new URL(MIHOYO_API.ltoken).pathname)
    return jsonResponse({retcode: 0, data: {ltoken: "synthetic-read-token"}})
  }})
  const account = await client.exchangeQrLogin(
    {uid: "123", mid: "synthetic-mid", stoken: "v2_synthetic"}, {recordOnly: true},
  )
  assert.deepEqual(account, {accountId: "123", cookie: "ltoken=synthetic-read-token;ltuid=123;"})
})

test("国服扫码经过绑定账号接口验证才接受读取凭据，拒绝时保留服务器错误码", async () => {
  for (const retcode of [0, -100]) {
    const client = new MysClient(async (url, options) => {
      assert.equal(new URL(url).pathname, "/binding/api/getUserGameRolesByCookie")
      assert.equal(options.headers.Cookie, "ltoken=synthetic;ltuid=123;")
      return jsonResponse({retcode, data: {list: [{region: "cn_gf01", game_uid: "456"}]}})
    })
    client.ticket = "test-ticket"
    client.qrExpires = Date.now() + 60_000
    client.qr.queryQr = async () => ({retcode: 0, data: {stat: "Confirmed", payload: {raw: "{}"}}})
    client.qr.exchangeQrLogin = async (_, options) => {
      assert.equal(options.recordOnly, true)
      return {accountId: "123", cookie: "ltoken=synthetic;ltuid=123;"}
    }
    if (retcode === 0) {
      const state = await client.pollQR()
      assert.equal(state.roles[0].uid, "456")
      assert.equal(communityAccount(client.cookie, "miyoushe", {recordOnly: true}).id, "123")
      assert.doesNotMatch(JSON.stringify(state), /synthetic/)
    } else {
      await assert.rejects(client.pollQR(), {retcode})
      assert.equal(client.cookie, "")
    }
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
