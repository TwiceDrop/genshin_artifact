// 把云档案同步内核（profile-sync-core.mjs）接到本机存储、账号仓库、计算历史和在线服务网关上。
// 档案字段与本机存储键一一对应；写回本机统一走 applyCloudAccount，保证整份档案在一次批量写入里落盘。
import { reactive } from 'vue'
import backend from '@/store/backend'
import { useAccountStore, accountReady, applyCloudAccount } from '@/store/pinia/account'
import { calculationHistory, calculationState } from '@/store/calculation-history'
import { cloudApi } from '@/platform/cloud.mjs'
import { syncHistory } from './history-sync.mjs'
import { createProfileSync } from './profile-sync-core.mjs'

// [档案字段, 本机存储键里的类型名]，与 online-service/src/profiles.mjs 的 DATA_KEYS 对应（name 另行处理）
import { profileDomains as DOMAINS } from '@/store/profile-domains.mjs'
const storageEntries = (accountId: number, data: any): [string, any][] =>
    DOMAINS.map(([field, type]) => [`mona_account_${type}_${accountId}`, data[field] ?? null])

const accountNames = () => Object.fromEntries(useAccountStore().allAccounts.map((account: any) => [account.id, account.name]))

async function capture(accountId: number) {
    await accountReady
    await backend.allReady()
    const name = accountNames()[accountId]
    if (name === undefined) throw new Error('本地账号不存在')
    const data: any = { name }
    for (const [field, type] of DOMAINS) data[field] = (await backend.getItem(`mona_account_${type}_${accountId}`)) ?? null
    return data
}

const core = createProfileSync({
    api: cloudApi,
    storage: backend,
    capture,
    restore: (accountId: number, data: any, extra: [string, any][], guard: () => void) =>
        applyCloudAccount(accountId, data.name, [...storageEntries(accountId, data), ...extra], false, guard),
    createLocal: async (data: any, entriesFor: (accountId: number) => [string, any][], guard: () => void) => {
        await accountReady
        const accountId = useAccountStore().reserveAccountId()
        await applyCloudAccount(accountId, data.name, [...storageEntries(accountId, data), ...entriesFor(accountId)], true, guard)
    },
    currentAccountId: () => useAccountStore().currentAccountId.value,
    accountNames,
    // 该账号正在计算时不写回，避免计算结果和云端数据互相覆盖。
    canRestore: (accountId: number) => calculationState.active?.accountId !== accountId,
    historySync: (options: any) => syncHistory({ ...options, history: calculationHistory }),
    makeReactive: reactive,
    state: reactive({ bindings: [], profiles: [], busy: false, error: '' }),
})

// 同步在打开软件时就会启动（登录门），内核初始化会读账号名，所以先等本地账号仓库加载完。
export const profileSync = { ...core, start: async () => { await accountReady; return core.start() } }
