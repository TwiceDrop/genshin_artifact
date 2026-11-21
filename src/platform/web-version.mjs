// ZIP 和 Tauri 用回环地址打开；域名访问的托管网页版显示迁移通知。
export function shouldShowWebVersionNotice({native, hostname}) {
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(hostname)
    return !native && !loopback
}
