import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Credentials travel only over the helper's private stdout pipe, never a URL or log.
export function startHoyolabWebLogin(profileDirectory) {
    const exe = fileURLToPath(new URL('../runtime/hoyolab-login/HoyolabLogin.exe', import.meta.url))
    // This is the interactive login window explicitly opened by the user.
    const child = spawn(exe, [path.resolve(profileDirectory)], { windowsHide: false, stdio: ['ignore','pipe','pipe'] })
    let output = '', failed = false
    const promise = new Promise((resolve, reject) => {
        child.stdout.on('data', chunk => { output += chunk })
        child.stderr.resume()
        child.on('error', () => { failed = true; reject(new Error('HoYoLAB 登录窗口无法启动，请先运行 script/build-hoyolab-login.ps1')) })
        child.on('close', code => {
            if (failed) return
            if (code !== 0) return reject(new Error('HoYoLAB 登录已取消或窗口启动失败'))
            try {
                const result = JSON.parse(output)
                if (!result.cookie) throw new Error()
                resolve(result.cookie)
            } catch { reject(new Error('HoYoLAB 登录窗口未返回有效登录结果')) }
        })
    })
    return { promise, cancel: () => child.kill() }
}
