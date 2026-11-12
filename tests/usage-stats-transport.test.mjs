import test from 'node:test'
import assert from 'node:assert/strict'
import { nativeUsageStatsSender } from '../src/platform/usage-stats-transport.mjs'

const body = { installId: '00000000-0000-4000-8000-000000000001', platform: 'android', version: '7.2.04', records: [{ feature: 'page.calculate', day: '2026-11-12' }] }

test('the Android sender posts the batch natively to the upload path', async () => {
    const calls = []
    const send = nativeUsageStatsSender('https://stats.example.test', async options => { calls.push(options); return { status: 200, data: { accepted: 1 } } })
    assert.deepEqual(await send(body, { keepalive: true }), { ok: true, status: 200, message: undefined })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://stats.example.test/v1/usage-stats')
    assert.equal(calls[0].method, 'POST')
    assert.deepEqual(calls[0].data, body)
    assert.equal(calls[0].headers['Content-Type'], 'application/json')
    assert.equal(calls[0].disableRedirects, true)
    assert.equal(calls[0].headers.Authorization, undefined, 'no online account session is sent')
})

test('a rejection returns the server reason, also when the body arrives as text', async () => {
    const send = nativeUsageStatsSender('https://stats.example.test', async () => ({ status: 400, data: JSON.stringify({ error: { code: 'INVALID_INPUT', message: '版本格式不正确' } }) }))
    assert.deepEqual(await send(body), { ok: false, status: 400, message: '版本格式不正确' })
    const plain = nativeUsageStatsSender('https://stats.example.test', async () => ({ status: 502, data: '<html>bad gateway</html>' }))
    assert.deepEqual(await plain(body), { ok: false, status: 502, message: '在线服务返回了非 JSON 内容（HTTP 502）' })
})

test('a network error is thrown to the recorder, which records it as a send failure', async () => {
    const send = nativeUsageStatsSender('https://stats.example.test', async () => { throw new Error('Unable to resolve host') })
    await assert.rejects(send(body), /Unable to resolve host/)
})

test('the Android sender refuses an endpoint that is not https', async () => {
    const send = nativeUsageStatsSender('http://stats.example.test', async () => { throw new Error('must not be called') })
    await assert.rejects(send(body), /使用统计地址必须是 https/)
})
