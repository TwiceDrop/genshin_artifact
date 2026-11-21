// 在线托管的网页版：不是安卓原生，也不是桌面版（本机服务，地址是 127.0.0.1 或 localhost）。
export function isHostedWebVersion({native, hostname}) {
    return !native && !['127.0.0.1', 'localhost'].includes(hostname)
}
