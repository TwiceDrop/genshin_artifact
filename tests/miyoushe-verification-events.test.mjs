import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const html = fs.readFileSync(new URL('../public/mys-verification.html', import.meta.url), 'utf8')
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1]
function frame() {
    const sent = [], callbacks = {}, status = { textContent: '' }
    let receive
    const parent = { postMessage: (message, target) => sent.push({ message, target }) }
    const proof = { geetest_challenge: 'synthetic-challenge', geetest_validate: 'synthetic-validate', geetest_seccode: 'synthetic-validate|jordan' }
    vm.runInNewContext(code, {
        parent,
        window: { addEventListener: (name, fn) => { receive = fn } },
        document: { getElementById: () => status, createElement: () => ({}), head: { appendChild: node => node.onload() } },
        initGeetest: (options, ready) => ready({ appendTo() {}, onReady: fn => { callbacks.ready = fn }, onError: fn => { callbacks.error = fn }, onClose: fn => { callbacks.close = fn }, onSuccess: fn => { callbacks.success = fn }, getValidate: () => proof }),
    })
    receive({ source: parent, origin: 'http://127.0.0.1:12345', data: { type: 'mona-mys-verification-config', flowId: 'synthetic-flow', gt: 'synthetic-gt', challenge: 'synthetic-challenge' } })
    return { sent, callbacks, status }
}
test('SDK close before success must not cancel the host verification flow', () => {
    const { sent, callbacks } = frame()
    callbacks.close()
    assert.equal(sent.length, 0)
    callbacks.success()
    assert.equal(sent.length, 1)
    assert.equal(sent[0].message.type, 'mona-mys-verification-complete')
    assert.equal(sent[0].message.flowId, 'synthetic-flow')
    assert.equal(sent[0].message.result.geetest_validate, 'synthetic-validate')
    assert.equal(sent[0].target, 'http://127.0.0.1:12345')
})
test('SDK close after success must not revoke a pending submission; SDK errors remain visible', () => {
    const { sent, callbacks } = frame()
    callbacks.success(); callbacks.close()
    assert.deepEqual(sent.map(x => x.message.type), ['mona-mys-verification-complete'])
    const failure = frame()
    failure.callbacks.error()
    assert.equal(failure.sent[0].message.type, 'mona-mys-verification-error')
    assert.equal(failure.status.textContent, '验证码加载失败')
})
