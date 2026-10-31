// Protocol references and limitations: docs/local-features.md.
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { MihoyoApiClient } from './vendor/twicedrop/mihoyo-api.mjs'
import { deviceFpBody, recordDevice, recordUserAgent } from './device-fp.mjs'
import { normalizeCookie } from './cookie.mjs'
const RECORD = 'https://api-takumi-record.mihoyo.com'
const FP = 'https://public-data-api.mihoyo.com'
const stages = {
    '/game_record/app/card/wapi/createVerification': '验证码创建',
    '/game_record/app/card/wapi/verifyVerification': '验证码提交',
    '/device-fp/api/getFp': '设备初始化',
    '/binding/api/getUserGameRolesByCookie': '绑定账号查询',
    '/game_record/app/genshin/api/character/list': '角色列表读取',
    '/game_record/app/genshin/api/character/detail': '角色详情读取',
}
export function ds(body = '', query = '', platform = 'miyoushe') {
    if (platform === 'hoyolab') {
        const t = Math.floor(Date.now() / 1000), letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const r = Array.from({length: 6}, () => letters[randomInt(0, letters.length)]).join('')
        return `${t},${r},${createHash('md5').update(`salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t=${t}&r=${r}`).digest('hex')}`
    }
    const t = Math.floor(Date.now() / 1000), r = randomInt(100001, 200000)
    const salt = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    return `${t},${r},${createHash('md5').update(`salt=${salt}&t=${t}&r=${r}&b=${body}&q=${query}`).digest('hex')}`
}
export class MysClient {
    constructor(fetcher = fetch) { this.fetcher = fetcher; this.device = randomUUID().toUpperCase(); this.deviceFp = ''; this.deviceSeed = randomBytes(8).toString('hex'); this.cookie = ''; this.ticket = ''; this.roles = []; this.challengeRequest = null; this.verification = null; this.verifiedChallenges = new Map(); this.qr = new MihoyoApiClient({ fetchImpl: fetcher }) }
    async request(base, path, { body, query = '', authenticated = true, challengePath } = {}) {
        const stage = stages[path] || '数据读取'
        const serialized = body === undefined ? '' : JSON.stringify(body)
        // Match the registered iOS profile; FP registration has no record credentials/DS.
        const headers = { 'Content-Type': 'application/json', 'User-Agent': recordUserAgent }
        if (base !== FP) Object.assign(headers, {
            'x-rpc-device_id': this.device, 'x-rpc-app_version': recordDevice.appVersion,
            'x-rpc-client_type': '5', Referer: 'https://webstatic.mihoyo.com/',
            DS: ds(serialized, query),
        })
        if (authenticated) headers.Cookie = this.cookie
        if (base === RECORD) Object.assign(headers, {
            'x-rpc-device_fp': this.deviceFp,
            'x-rpc-device_name': recordDevice.model, 'x-rpc-sys_version': recordDevice.osVersion,
            'x-rpc-tool_verison': 'v6.6.1-gr-cn', 'x-rpc-page': 'v6.6.1-gr-cn_#/ys',
            'X-Requested-With': 'com.mihoyo.hyperion', Origin: 'https://webstatic.mihoyo.com',
            Accept: 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9',
        })
        if (base === RECORD && challengePath) {
            headers['x-rpc-challenge_game'] = '2'
            headers['x-rpc-challenge_path'] = challengePath
        }
        const challengeKey = `${path}:${body?.role_id}`
        if (base === RECORD && this.verifiedChallenges.has(challengeKey)) headers['x-rpc-challenge'] = this.verifiedChallenges.get(challengeKey)
        let res
        try {
            res = await this.fetcher(`${base}${path}${query ? '?' + query : ''}`, {
                method: body === undefined ? 'GET' : 'POST', headers,
                ...(serialized ? { body: serialized } : {}), signal: AbortSignal.timeout(20000), redirect: 'error',
            })
        } catch { throw new Error(`${stage}失败：无法连接米游社，请检查网络后重试`) }
        if (!res.ok) throw new Error(`${stage}失败：米游社 HTTP ${res.status}`)
        let data
        try { data = await res.json() } catch { throw new Error(`${stage}失败：米游社返回了无法解析的数据`) }
        if (data.retcode !== 0) {
            // Never relay arbitrary upstream bodies/URLs: they may contain credentials.
            const code = Number(data.retcode)
            const hint = code === 5003 ? '战绩请求被拒绝，可能涉及设备或账号校验；仅凭此代码无法确定具体原因。请在米游社 App「我的角色」查看原神战绩，如有验证请完成后重试。'
                : code === 1034 ? '米游社要求验证。'
                : [-100, 10001, 10002].includes(code) ? '登录凭证已失效，请重新扫码更新；已保存账号会保留。'
                : '尚未完成同步，请稍后重试。'
            if (base === RECORD && code === 1034 && body?.role_id && ['/game_record/app/genshin/api/character/list', '/game_record/app/genshin/api/character/detail'].includes(path)) {
                this.challengeRequest = { path, uid: String(body.role_id) }
                this.verification = null
                this.verifiedChallenges.delete(challengeKey)
            }
            const error = new Error(`${stage}失败（米游社 ${Number.isFinite(code) ? code : '未知错误'}）：${hint}`)
            error.retcode = code
            throw error
        }
        return data.data
    }
    async prepareRecord() {
        if (this.deviceFp) return
        const seed = this.deviceSeed
        const data = await this.request(FP, '/device-fp/api/getFp', {
            body: deviceFpBody(this.device, seed), authenticated: false,
        })
        // getFp can return retcode=0 with an inner rejection and a fallback FP.
        // Never treat that fallback as successful device initialization.
        if (Number(data?.code) !== 200 || !/^[a-zA-Z0-9]{10,64}$/.test(data?.device_fp || '')) {
            const code = Number(data?.code)
            throw new Error(`设备初始化失败（${Number.isFinite(code) ? code : '返回格式异常'}），尚未读取角色数据。请稍后重试。`)
        }
        if (!this.cookie || seed !== this.deviceSeed) throw new Error('登录会话已结束，请重新扫码')
        this.deviceFp = data.device_fp
    }
    async startVerification() {
        if (!this.cookie || !this.challengeRequest) throw new Error('请先同步角色，出现验证要求后再发起验证')
        const flow = { ...this.challengeRequest, flowId: randomUUID(), submitted: false }
        this.verification = flow
        const data = await this.request(RECORD, '/game_record/app/card/wapi/createVerification', {
            query: 'is_high=true', challengePath: flow.path,
        })
        if (this.verification !== flow || !this.cookie) throw new Error('验证已取消')
        if (typeof data?.gt !== 'string' || !data.gt || typeof data?.challenge !== 'string' || !data.challenge) throw new Error('米游社未返回可用验证码')
        return { flowId: flow.flowId, gt: data.gt, challenge: data.challenge }
    }
    async completeVerification({ flowId, result } = {}) {
        const flow = this.verification
        if (!this.cookie || !flow || flow.flowId !== flowId || flow.submitted) throw new Error('验证已失效，请重新发起验证')
        const body = {}
        for (const key of ['geetest_challenge', 'geetest_validate', 'geetest_seccode']) {
            if (typeof result?.[key] !== 'string' || !result[key] || result[key].length > 4096) throw new Error('验证码结果不完整，请重新完成验证')
            body[key] = result[key]
        }
        flow.submitted = true
        const data = await this.request(RECORD, '/game_record/app/card/wapi/verifyVerification', { body, challengePath: flow.path })
        if (this.verification !== flow || !this.cookie) throw new Error('验证已取消')
        if (typeof data?.challenge !== 'string' || !data.challenge) throw new Error('米游社未确认验证成功')
        this.verifiedChallenges.set(`${flow.path}:${flow.uid}`, data.challenge)
        this.verification = null
        this.challengeRequest = null
        return { ok: true }
    }
    cancelVerification() { this.verification = null }
    async createQR() {
        const data = await this.qr.createQr(this.device)
        const url = new URL(data.url)
        if (url.protocol !== 'https:' || !['user.mihoyo.com', 'user.miyoushe.com'].includes(url.hostname)) throw new Error('二维码地址不受支持')
        this.ticket = data.ticket
        this.qrExpires = Math.min(data.expiresAt || Infinity, Date.now() + 120000)
        return { url: data.url, expiresAt: this.qrExpires }
    }
    async pollQR() {
        if (this.cookie) return { status: 'Confirmed' }
        if (!this.ticket || Date.now() >= this.qrExpires) return { status: 'Expired' }
        const response = await this.qr.queryQr(this.device, this.ticket)
        if (Number(response.retcode) !== 0) {
            if (/expired/i.test(response.message || '')) return { status: 'Expired' }
            throw new Error(`扫码查询失败（${Number(response.retcode)}），请重新扫码`)
        }
        const status = response.data.stat
        if (status !== 'Confirmed') return { status: status === 'Scanned' ? status : 'Waiting' }
        const account = await this.qr.exchangeQrLogin(JSON.parse(response.data.payload.raw))
        // Only retain credentials required for record reads; never send them to the browser.
        this.cookie = normalizeCookie(account.cookie).cookie
        this.ticket = ''
        return { status: 'Confirmed' }
    }
    async getRoles() {
        if (!this.cookie) throw new Error('请先扫码登录')
        const data = await this.request('https://api-takumi.mihoyo.com', '/binding/api/getUserGameRolesByCookie', { query: 'game_biz=hk4e_cn' })
        this.roles = (data.list || []).filter(r => ['cn_gf01', 'cn_qd01'].includes(r.region)).map(r => ({ uid: String(r.game_uid), region: r.region, nickname: r.nickname, level: r.level, regionName: r.region_name }))
        return this.roles
    }
    async snapshot(uid, onProgress = () => {}, isCancelled = () => false) {
        const role = this.roles.find(r => r.uid === uid)
        if (!role || !this.cookie) throw new Error('请先选择当前登录账号绑定的原神 UID')
        if (this.challengeRequest && this.challengeRequest.uid !== uid) { this.challengeRequest = null; this.verification = null; this.verifiedChallenges.clear() }
        await this.prepareRecord()
        if (isCancelled()) throw new Error('同步已取消')
        const body = { role_id: role.uid, server: role.region }
        const list = await this.request(RECORD, '/game_record/app/genshin/api/character/list', { body })
        if (!Array.isArray(list.list)) throw new Error('角色列表格式已变化，尚未写入本地数据')
        const ids = [...new Set(list.list.map(c => c.id ?? c.base?.id))]
        if (ids.some(id => !Number.isInteger(Number(id)) || Number(id) <= 0)) throw new Error('角色 ID 无效')
        const characters = [], failures = []
        for (let i = 0; i < ids.length; i += 5) {
            if (isCancelled()) throw new Error('同步已取消')
            const batch = ids.slice(i, i + 5)
            const detail = await this.request(RECORD, '/game_record/app/genshin/api/character/detail', { body: { ...body, character_ids: batch.map(Number) } })
            if (!Array.isArray(detail.list)) throw new Error('角色详情格式已变化，尚未写入本地数据')
            for (const id of batch) {
                const found = detail.list.find(c => String(c.base?.id) === String(id))
                if (found) characters.push(found)
                else failures.push(`角色 ${id} 未返回详情`)
            }
            onProgress({ completed: Math.min(i + 5, ids.length), total: ids.length })
            if (i + 5 < ids.length) await new Promise(resolve => setTimeout(resolve, 350))
        }
        this.challengeRequest = null; this.verification = null; this.verifiedChallenges.clear()
        return { version: 1, source: this.platform || 'miyoushe', role, importedAt: new Date().toISOString(), total: ids.length, characters, failures, scope: 'owned-characters-equipped-artifacts' }
    }
    clear() { this.challengeRequest = null; this.verification = null; this.verifiedChallenges.clear(); this.cookie = ''; this.ticket = ''; this.roles = []; this.deviceFp = ''; this.deviceSeed = randomBytes(8).toString('hex') }
}
