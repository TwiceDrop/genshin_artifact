import test from 'node:test'
import assert from 'node:assert/strict'
import { MysClient } from '../server/mys.mjs'
const prefix = '/game_record/app/genshin/api/character/'
const proof = { geetest_challenge: 'synthetic-challenge', geetest_validate: 'synthetic-validate', geetest_seccode: 'synthetic-validate|jordan' }
function setup(endpoint = 'list') {
    const calls = []
    let rejectVerify = false, holdVerify = null
    const client = new MysClient(async (url, options) => {
        const path = new URL(url).pathname
        calls.push({ url, path, ...options })
        let data, retcode = 0
        if (path.endsWith('/createVerification')) data = { gt: 'synthetic-gt', challenge: 'synthetic-challenge' }
        else if (path.endsWith('/verifyVerification')) {
            if (holdVerify) await holdVerify
            retcode = rejectVerify ? 1034 : 0
            data = { challenge: 'verified-token' }
        } else if (path.startsWith(prefix)) {
            if (path === prefix + endpoint && options.headers['x-rpc-challenge'] !== 'verified-token') retcode = 1034
            data = path.endsWith('/list') ? { list: [{ id: 10000021 }] } : { list: [{ base: { id: 10000021 }, relics: [] }] }
        } else throw new Error('Unexpected request')
        return { ok: true, json: async () => ({ retcode, data }) }
    })
    client.cookie = 'synthetic-cookie'
    client.deviceFp = '0123456789'
    client.roles = [{ uid: '123456789', region: 'cn_gf01' }, { uid: '987654321', region: 'cn_qd01' }]
    return { client, calls, reject: () => { rejectVerify = true }, hold: p => { holdVerify = p } }
}
for (const endpoint of ['list', 'detail']) test(`human verification targets ${endpoint}, keeps identity, and retries only after official acceptance`, async () => {
    const { client, calls } = setup(endpoint)
    await assert.rejects(client.startVerification(), /先同步/)
    await assert.rejects(client.snapshot('123456789'), e => e.retcode === 1034)
    const params = await client.startVerification()
    assert.deepEqual(Object.keys(params).sort(), ['challenge', 'flowId', 'gt'])
    const create = calls.at(-1)
    assert.equal(new URL(create.url).search, '?is_high=true')
    assert.equal(create.headers['x-rpc-challenge_path'], prefix + endpoint)
    assert.equal(create.headers['x-rpc-challenge_game'], '2')
    assert.equal(create.headers['x-rpc-device_id'], client.device)
    assert.equal(create.headers['x-rpc-device_fp'], client.deviceFp)
    assert.equal(create.headers.Cookie, client.cookie)
    await assert.rejects(client.completeVerification({ flowId: 'wrong', result: proof }), /失效/)
    await assert.rejects(client.completeVerification({ flowId: params.flowId, result: {} }), /不完整/)
    await client.completeVerification({ flowId: params.flowId, result: { ...proof, cookie: 'never-forward-this' } })
    assert.deepEqual(JSON.parse(calls.at(-1).body), proof)
    assert.equal(calls.at(-1).headers['x-rpc-challenge_path'], prefix + endpoint)
    const result = await client.snapshot('123456789')
    assert.equal(result.characters.length, 1)
    const retry = calls.filter(c => c.path === prefix + endpoint).at(-1)
    assert.equal(retry.headers['x-rpc-challenge'], 'verified-token')
    assert.ok(calls.filter(c => c.path === prefix + (endpoint === 'list' ? 'detail' : 'list')).every(c => !c.headers['x-rpc-challenge']))
    assert.equal(client.verifiedChallenges.size, 0)
    assert.equal(client.cookie, 'synthetic-cookie')
})
test('cancel, replaced flows, failed verification and cleared accounts cannot authorize a retry', async () => {
    const { client, calls, reject } = setup()
    await assert.rejects(client.snapshot('123456789'))
    const first = await client.startVerification()
    client.cancelVerification()
    await assert.rejects(client.completeVerification({ flowId: first.flowId, result: proof }), /失效/)
    const second = await client.startVerification(), third = await client.startVerification()
    await assert.rejects(client.completeVerification({ flowId: second.flowId, result: proof }), /失效/)
    reject()
    await assert.rejects(client.completeVerification({ flowId: third.flowId, result: proof }), e => e.retcode === 1034)
    assert.equal(client.verifiedChallenges.size, 0)
    assert.equal(calls.filter(c => c.path.endsWith('/verifyVerification')).length, 1)
    const fourth = await client.startVerification()
    client.clear()
    await assert.rejects(client.completeVerification({ flowId: fourth.flowId, result: proof }), /失效/)
})
test('late verification response after cancel or logout is discarded; token is UID scoped', async () => {
    for (const action of ['cancelVerification', 'clear']) {
        const { client, hold } = setup()
        await assert.rejects(client.snapshot('123456789'))
        const params = await client.startVerification()
        let release
        hold(new Promise(resolve => { release = resolve }))
        const pending = client.completeVerification({ flowId: params.flowId, result: proof })
        client[action](); release()
        await assert.rejects(pending, /取消/)
        assert.equal(client.verifiedChallenges.size, 0)
    }
    const { client, calls } = setup()
    await assert.rejects(client.snapshot('123456789'))
    const params = await client.startVerification()
    await client.completeVerification({ flowId: params.flowId, result: proof })
    await assert.rejects(client.snapshot('987654321'), e => e.retcode === 1034)
    assert.equal(calls.at(-1).headers['x-rpc-challenge'], undefined)
})
