// 当前登录的在线账号（邮箱、用户名、头像），侧栏和设置页共用一份；登录状态变化（mona-cloud-context-change）时重新读取。
import { reactive } from 'vue'
import { cloudApi } from '@/platform/cloud.mjs'
import { characterData } from '@character'

export const onlineUser = reactive({ user: null, error: '' })

// 头像存的是角色英文键名，图片沿用角色数据里的头像地址；角色不存在（如旧版本没有的新角色）时返回空。
export const avatarUrl = key => (key && characterData[key]?.avatar) || ''
export const avatarChoices = () => Object.entries(characterData).map(([key, data]) => ({ key, url: data.avatar, nameLocale: data.nameLocale }))

export function setOnlineUser(user) { onlineUser.user = user || null }

// 读本机服务缓存的登录状态；已登录时再取一次最新的个人信息。失败原因记在 onlineUser.error，由调用方决定是否显示。
export async function loadOnlineUser() {
    try {
        const config = await cloudApi('config')
        setOnlineUser(config.user ? (await cloudApi('v1/me')).user : null)
        onlineUser.error = ''
    } catch (error) {
        if (error.status === 401) setOnlineUser(null)
        onlineUser.error = error.message
        throw error
    }
    return onlineUser.user
}

if (typeof window !== 'undefined') window.addEventListener('mona-cloud-context-change', () => { loadOnlineUser().catch(() => {}) })
