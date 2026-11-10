import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, syntheticCookie } from './helpers.mjs'
import { createWorker } from '../src/worker.mjs'

// Two targeted purposes only: authentication/tenant isolation; job/credential lifecycle.
test('authentication and tenant isolation with encrypted OTP/session secrets', async t => {
    const f = await fixture(); t.after(() => f.close())
    const post = (path, body, token) => f.request(path, { method: 'POST', body, token })
    assert.equal((await f.request('/healthz')).status, 200)
    assert.equal((await post('/v1/auth/email/request', { email: 'not-an-email' })).status, 400)
    const sent = await post('/v1/auth/email/request', { email: 'Code@Example.test' })
    assert.equal(sent.status, 200)
    assert.equal(sent.body.code, undefined)
    const code = f.emails.at(-1).code
    assert.match(code, /^\d{6}$/)
    const challenge = (await f.pool.query('SELECT * FROM email_challenges WHERE id=$1', [sent.body.challengeId])).rows[0]
    assert.equal(f.vault.open(challenge.code_cipher, `otp:${challenge.id}`), code)
    assert.ok(!challenge.code_cipher.includes(code))
    assert.throws(() => f.vault.open(challenge.code_cipher, 'otp:wrong-context'))
    assert.equal((await post('/v1/auth/email/request', { email: 'code@example.test' })).status, 429)
    const wrong = code === '000000' ? '000001' : '000000'
    for (let i = 0; i < 5; i++) assert.equal((await post('/v1/auth/email/verify', { challengeId: challenge.id, code: wrong })).status, 400)
    assert.equal((await post('/v1/auth/email/verify', { challengeId: challenge.id, code })).status, 400)
    const a = await f.login(), b = await f.login('synthetic-b@example.test')
    const aToken = a.sessionToken, bToken = b.sessionToken
    assert.match(aToken, /^[0-9a-f-]{36}\.[\w-]{43}$/)
    assert.equal((await post('/v1/auth/email/verify', { challengeId: a.challengeId, code: a.code })).status, 400)
    assert.equal((await f.request('/v1/me', { token: `${aToken.split('.')[0]}.${'x'.repeat(43)}` })).status, 401)
    const session = (await f.pool.query('SELECT * FROM sessions WHERE id=$1', [aToken.split('.')[0]])).rows[0]
    assert.ok(!session.secret_cipher.includes(aToken.split('.')[1]))
    const bound = await post('/v1/game-accounts', { platform: 'miyoushe', cookie: syntheticCookie }, aToken)
    assert.equal(bound.status, 200)
    const id = bound.body.account.id
    assert.equal(bound.body.account.cookie, undefined)
    const secret = (await f.pool.query('SELECT credential_cipher FROM game_accounts WHERE id=$1', [id])).rows[0].credential_cipher
    assert.ok(!secret.includes('SYNTHETIC_COOKIE'))
    assert.equal((await f.request('/v1/game-accounts', { token: bToken })).body.accounts.length, 0)
    for (const [method, suffix, body] of [['PATCH', '', { syncEnabled: false }], ['DELETE', '', undefined], ['POST', '/sync', undefined], ['GET', '/snapshots', undefined]]) {
        assert.equal((await f.request(`/v1/game-accounts/${id}${suffix}`, { method, body, token: bToken })).status, 404)
    }
    const job = await post(`/v1/game-accounts/${id}/sync`, {}, aToken)
    assert.equal((await f.request(`/v1/jobs/${job.body.jobId}`, { token: bToken })).status, 404)
    await f.request(`/v1/sessions/${aToken.split('.')[0]}`, { method: 'DELETE', token: bToken })
    assert.equal((await f.request('/v1/me', { token: aToken })).status, 200)
    const sessions = await f.request('/v1/sessions', { token: aToken })
    assert.equal(sessions.body.sessions[0].current, true)
    assert.equal(sessions.body.sessions[0].secret_cipher, undefined)
    assert.equal((await f.request('/v1/me', { token: aToken, headers: { Origin: 'https://untrusted.example' } })).status, 403)
    await post('/v1/auth/logout', {}, aToken)
    assert.equal((await f.request('/v1/me', { token: aToken })).status, 401)
    f.state.mailFailure = true
    assert.equal((await post('/v1/auth/email/request', { email: 'mail-fails@example.test' })).status, 503)
    assert.deepEqual(f.errors.at(-1), { code: 'EAUTH', event: 'mail_send' })
    f.state.mailFailure = false
    const expiring = await post('/v1/auth/email/request', { email: 'expires@example.test' })
    const expiringCode = f.emails.at(-1).code
    f.advance(601000)
    assert.equal((await post('/v1/auth/email/verify', { challengeId: expiring.body.challengeId, code: expiringCode })).status, 400)
    let throttled = false
    for (let i = 0; i < 21; i++) {
        const result = await post('/v1/auth/email/request', { email: `quota-${i}@example.test` })
        if (result.status === 429) { throttled = true; break }
    }
    assert.equal(throttled, true, 'IP rate limit must apply across different email addresses')
    f.advance(31 * 86400000)
    assert.equal((await f.request('/v1/me', { token: bToken })).status, 401)
})

test('persistent jobs, finite retry, credential revision, pause and last successful snapshots', async t => {
    const f = await fixture(); t.after(() => f.close())
    const { sessionToken: token } = await f.login()
    const post = (path, body = {}) => f.request(path, { method: 'POST', body, token })
    const read = path => f.request(path, { token })
    const bind = (platform = 'miyoushe') => post('/v1/game-accounts', { platform, cookie: syntheticCookie })
    const account = (await bind()).body.account, id = account.id
    const base = `/v1/game-accounts/${id}`
    const first = await post(base + '/sync'), duplicate = await post(base + '/sync')
    assert.equal(first.body.jobId, duplicate.body.jobId)
    assert.equal((await read('/v1/game-accounts')).body.accounts[0].activeJobId, first.body.jobId)
    assert.equal(await f.worker.runOne(), true)
    assert.equal((await read(`/v1/jobs/${first.body.jobId}`)).body.job.status, 'succeeded')
    const original = (await read(base + '/snapshots')).body.snapshots
    assert.equal(original.length, 1)
    assert.equal(original[0].snapshot.characters[0].synthetic, 'first')
    f.state.failure = Object.assign(new Error('Synthetic captcha'), { retcode: 1034 })
    const captcha = await post(base + '/sync')
    await f.worker.runOne()
    assert.equal((await read(`/v1/jobs/${captcha.body.jobId}`)).body.job.status, 'failed')
    assert.equal((await read('/v1/game-accounts')).body.accounts[0].status, 'verification_required')
    assert.deepEqual((await read(base + '/snapshots')).body.snapshots, original)
    f.advance(7 * 3600000)
    assert.equal(await f.worker.schedule(), 0, 'captcha must pause automatic fetching')
    f.state.failure = Object.assign(new Error('Synthetic expired'), { retcode: -100 })
    await post(base + '/sync'); await f.worker.runOne()
    assert.equal((await read('/v1/game-accounts')).body.accounts[0].status, 'expired')
    f.state.failure = null
    await bind()
    f.state.failure = new Error('Synthetic network failure')
    const network = await post(base + '/sync')
    for (let attempt = 0; attempt < 3; attempt++) { await f.worker.runOne(); f.advance(61000) }
    const exhausted = (await read(`/v1/jobs/${network.body.jobId}`)).body.job
    assert.equal(exhausted.status, 'failed'); assert.equal(exhausted.attempts, 3)
    assert.deepEqual((await read(base + '/snapshots')).body.snapshots, original)
    f.state.failure = null
    await bind()
    let release
    f.state.gate = new Promise(resolve => { release = resolve })
    f.state.value = 'obsolete-result'
    const updating = await post(base + '/sync')
    const running = f.worker.runOne()
    for (let i = 0; i < 100; i++) {
        if ((await read(`/v1/jobs/${updating.body.jobId}`)).body.job.status === 'running') break
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    const beforeSameValue = (await f.pool.query('SELECT revision FROM game_accounts WHERE id=$1', [id])).rows[0].revision
    await f.request(base, { method: 'PATCH', body: { syncEnabled: true }, token })
    assert.equal((await f.pool.query('SELECT revision FROM game_accounts WHERE id=$1', [id])).rows[0].revision, beforeSameValue)
    const beforeUpdate = (await f.pool.query('SELECT revision FROM game_accounts WHERE id=$1', [id])).rows[0].revision
    await bind()
    assert.equal((await f.pool.query('SELECT revision FROM game_accounts WHERE id=$1', [id])).rows[0].revision, beforeUpdate + 1)
    release(); await running; f.state.gate = null
    assert.equal((await read(`/v1/jobs/${updating.body.jobId}`)).body.job.status, 'cancelled')
    assert.deepEqual((await read(base + '/snapshots')).body.snapshots, original, 'old revision cannot write a late result')
    f.state.gate = new Promise(resolve => { release = resolve })
    const paused = await post(base + '/sync')
    const pausing = f.worker.runOne()
    for (let i = 0; i < 100; i++) {
        if ((await read(`/v1/jobs/${paused.body.jobId}`)).body.job.status === 'running') break
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    await f.request(base, { method: 'PATCH', body: { syncEnabled: false }, token })
    release(); await pausing; f.state.gate = null
    assert.equal((await read(`/v1/jobs/${paused.body.jobId}`)).body.job.status, 'cancelled')
    assert.deepEqual((await read(base + '/snapshots')).body.snapshots, original, 'pausing rejects in-flight late writes')
    assert.equal(await f.worker.schedule(), 0)
    f.state.value = 'manual-while-paused'
    await post(base + '/sync'); await f.worker.runOne()
    assert.equal((await read(base + '/snapshots')).body.snapshots[0].snapshot.characters[0].synthetic, 'manual-while-paused')
    await f.request(base, { method: 'PATCH', body: { syncEnabled: true }, token })
    const lease = await post(base + '/sync')
    await f.pool.query("UPDATE sync_jobs SET status='running',attempts=1,lease_token=$2,lease_until=$3 WHERE id=$1", [lease.body.jobId, id, new Date(f.clock().getTime() - 1000)])
    await f.worker.recover()
    assert.equal((await read(`/v1/jobs/${lease.body.jobId}`)).body.job.status, 'queued')
    await f.worker.runOne()
    assert.equal((await read(`/v1/jobs/${lease.body.jobId}`)).body.job.status, 'succeeded')
    const fencing = await post(base + '/sync')
    let releaseOldClaim, notifyClaimPaused
    const oldClaimGate = new Promise(resolve => { releaseOldClaim = resolve })
    const claimPaused = new Promise(resolve => { notifyClaimPaused = resolve })
    let delayOldClaim = true
    const delayedPool = {
        connect: () => f.pool.connect(),
        query: async (sql, values) => {
            if (delayOldClaim && sql === 'SELECT * FROM game_accounts WHERE id=$1 AND revision=$2') {
                delayOldClaim = false
                notifyClaimPaused()
                await oldClaimGate
            }
            return f.pool.query(sql, values)
        },
    }
    const oldWorker = createWorker({ ...f, pool: delayedPool })
    const oldRun = oldWorker.runOne()
    await claimPaused
    f.advance(121000)
    await f.worker.recover()
    await f.worker.runOne()
    assert.equal((await read(`/v1/jobs/${fencing.body.jobId}`)).body.job.status, 'succeeded')
    const afterReclaim = (await read(base + '/snapshots')).body.snapshots
    const callsAfterReclaim = f.state.calls
    releaseOldClaim()
    await oldRun
    assert.equal((await read('/v1/game-accounts')).body.accounts.find(account => account.id === id).status, 'ready', 'a stale claim cannot restore syncing after its replacement completes')
    assert.equal(f.state.calls, callsAfterReclaim, 'a stale claim exits before issuing any game request')
    assert.deepEqual((await read(base + '/snapshots')).body.snapshots, afterReclaim)
    assert.equal((await read(`/v1/jobs/${fencing.body.jobId}`)).body.job.status, 'succeeded')
    const overseas = (await bind('hoyolab')).body.account
    await post(`/v1/game-accounts/${overseas.id}/sync`); await f.worker.runOne()
    assert.equal((await read(`/v1/game-accounts/${overseas.id}/snapshots`)).body.snapshots[0].region, 'os_asia')
    f.state.gate = new Promise(resolve => { release = resolve })
    const deleting = await post(base + '/sync')
    const inFlight = f.worker.runOne()
    for (let i = 0; i < 100; i++) {
        if ((await read(`/v1/jobs/${deleting.body.jobId}`)).body.job.status === 'running') break
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    await f.request(base, { method: 'DELETE', token })
    release(); await inFlight
    assert.equal((await read(base + '/snapshots')).status, 404)
    assert.equal((await f.pool.query('SELECT * FROM game_accounts WHERE id=$1', [id])).rows.length, 0)
    assert.equal((await f.pool.query('SELECT * FROM game_snapshots WHERE account_id=$1', [id])).rows.length, 0)
    assert.equal((await f.pool.query('SELECT * FROM sync_jobs WHERE account_id=$1', [id])).rows.length, 0)
    assert.ok(f.errors.every(error => error.event === 'game_sync'), 'only synthetic upstream failures are expected')
})
