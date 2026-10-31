import { communityClient } from '../../server/hoyolab.mjs'
import { normalizeCookie, publicAccount, communityAccount } from '../../server/cookie.mjs'
import { MonaLocal, nativeFetch } from './native.mjs'

let active = null, accountId = null, cancelled = false, busy = false, progress = { completed: 0, total: 0 }
let queue = Promise.resolve()
let webLogin = null
async function all() { await queue; return JSON.parse((await MonaLocal.readVault()).text).accounts }
function mutate(operation) {
    const task = queue.then(async () => {
        const data = JSON.parse((await MonaLocal.readVault()).text)
        operation(data.accounts)
        await MonaLocal.writeVault({ text: JSON.stringify(data) })
    })
    queue = task.catch(() => {})
    return task
}
async function persist(client = active) {
    const check = () => { if (cancelled || active !== client || !client?.cookie) throw new Error('登录已取消或账号已切换') }
    check()
    const account = communityAccount(client.cookie, client.platform), { id } = account
    const next = { ...account, device: client.device, deviceSeed: client.deviceSeed, deviceFp: client.deviceFp, roles: client.roles,
        status: 'ready', lastError: '', updatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() }
    await mutate(accounts => {
        check()
        const index = accounts.findIndex(a => a.id === id)
        if (index < 0) accounts.push({ ...next, createdAt: next.updatedAt }); else accounts[index] = { ...accounts[index], ...next }
    })
    check()
    accountId = id
}
function activate(client, id = null) { active?.clear(); active = client; accountId = id; cancelled = false }
export async function mobileMysApi(path, method = 'GET', body = {}) {
    const requestClient = active, requestAccountId = accountId
    try {
        if (path === 'accounts' && method === 'GET') return { accounts: (await all()).map(publicAccount), activeId: accountId }
        if (path === 'progress') return progress
        if (path === 'cancel') { cancelled = true; if (webLogin) { webLogin = null; await MonaLocal.cancelHoyolabLogin() } return { ok: true } }
        if (busy) throw new Error('同步中，请先取消后再操作')
        if (webLogin && ['select','login','logout','accounts'].includes(path)) { webLogin = null; await MonaLocal.cancelHoyolabLogin() }
        if (path.startsWith('accounts/') && method === 'DELETE') {
            const id = decodeURIComponent(path.slice(9))
            await mutate(accounts => { const index = accounts.findIndex(a => a.id === id); if (index >= 0) accounts.splice(index, 1) })
            if (id === accountId) { active?.clear(); active = null; accountId = null }
            return { ok: true }
        }
        if (path === 'select') {
            const saved = (await all()).find(a => a.id === body.id)
            if (!saved) throw new Error('未找到已保存 Cookie')
            const client = communityClient(saved.platform, nativeFetch)
            for (const key of ['cookie','device','deviceSeed','deviceFp','roles']) if (saved[key] !== undefined) client[key] = saved[key]
            activate(client, saved.id)
            return { roles: client.roles, account: publicAccount(saved) }
        }
        if (path === 'login') {
            const client = communityClient(body.platform, nativeFetch)
            if (body.platform === 'hoyolab') {
                activate(client)
                const flow = {}; webLogin = flow
                MonaLocal.loginHoyolab().then(result => {
                    if (!cancelled && webLogin === flow) client.cookie = normalizeCookie(result.cookie).cookie
                }).catch(error => { if (!cancelled && webLogin === flow) flow.error = error })
                return { mode: 'web' }
            }
            const qr = await client.createQR()
            activate(client)
            return qr
        }
        if (path === 'accounts' && method === 'POST') {
            const client = communityClient(body.platform, nativeFetch)
            client.cookie = normalizeCookie(body.cookie).cookie
            await client.getRoles(); activate(client); await persist()
            return { account: publicAccount((await all()).find(a => a.id === accountId)) }
        }
        if (!active) throw new Error('请先选择已保存账号或扫码登录')
        const client = active
        if (path === 'poll') {
            if (cancelled) throw new Error('登录已取消')
            if (webLogin?.error) throw webLogin.error
            const result = webLogin ? { status: client.cookie ? 'Confirmed' : 'Waiting' } : await client.pollQR()
            if (result.status === 'Confirmed') await persist(client)
            return result
        }
        if (path === 'roles') { cancelled = false; const roles = await client.getRoles(); await persist(client); return roles }
        if (path === 'import') {
            busy = true; cancelled = false; progress = { completed: 0, total: 0 }
            try {
                const snapshot = await client.snapshot(String(body.uid), value => { progress = value }, () => cancelled)
                if (cancelled) throw new Error('同步已取消')
                await persist(client); return snapshot
            } finally { busy = false }
        }
        if (path === 'logout') { active.clear(); active = null; accountId = null; return { ok: true } }
        throw new Error('接口不存在')
    } catch (error) {
        if (requestAccountId && active === requestClient && ['poll','roles','import'].includes(path) && Number.isFinite(error.retcode)) await mutate(accounts => {
            const saved = accounts.find(a => a.id === requestAccountId)
            if (saved) { saved.status = [-100,10001,10002].includes(error.retcode) ? 'expired' : 'error'; saved.lastError = error.message }
        }).catch(() => {})
        throw error
    }
}
