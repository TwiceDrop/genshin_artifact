import { MysClient, ds } from './mys.mjs'

// Protocol: genshin.py routes.py / utility/ds.py; see docs/hoyolab-login-7202-20261031.md.
export class HoyolabClient extends MysClient {
    constructor(fetcher) { super(fetcher); this.platform = 'hoyolab' }
    async prepareRecord() {} // Overseas record calls do not use the CN device registration.
    async request(base, path, { body, query = '' } = {}) {
        const record = path.startsWith('/game_record/app/genshin/api/')
        const url = record
            ? 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api/' + path.slice('/game_record/app/genshin/api/'.length)
            : 'https://api-os-takumi.mihoyo.com' + path
        const response = await this.fetcher(url + (query ? '?' + query : ''), {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: this.cookie,
                'x-rpc-app_version': '1.5.0', 'x-rpc-client_type': '5', 'x-rpc-language': 'zh-cn', 'x-rpc-lang': 'zh-cn',
                'x-rpc-device_id': this.device, DS: ds('', '', 'hoyolab'),
                Origin: 'https://act.hoyolab.com', Referer: 'https://act.hoyolab.com/',
                'User-Agent': 'Mozilla/5.0 HoYoLAB/1.5.0' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000), redirect: 'error',
        })
        if (!response.ok) throw new Error(`HoYoLAB ${record ? '角色数据' : '绑定账号'}读取失败：HTTP ${response.status}`)
        const result = await response.json()
        if (result.retcode !== 0) {
            const code = Number(result.retcode)
            throw Object.assign(new Error(`HoYoLAB 读取失败（${Number.isFinite(code) ? code : '未知错误'}）${code === 1034 ? '：请在 HoYoLAB 官方页面完成验证后重试' : ''}`), { retcode: code })
        }
        return result.data
    }
    async getRoles() {
        const data = await this.request('', '/binding/api/getUserGameRolesByCookie', { query: 'game_biz=hk4e_global' })
        this.roles = (data.list || []).filter(r => ['os_usa','os_euro','os_asia','os_cht'].includes(r.region))
            .map(r => ({ uid: String(r.game_uid), region: r.region, nickname: r.nickname, level: r.level, regionName: r.region_name }))
        return this.roles
    }
}

export function communityClient(platform = 'miyoushe', fetcher) {
    if (platform === 'hoyolab') return new HoyolabClient(fetcher)
    if (platform === 'miyoushe') return new MysClient(fetcher)
    throw new Error('不支持的登录平台')
}
