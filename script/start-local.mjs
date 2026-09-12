import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const port = Number(process.env.MONA_PORT || 4174)
const base = `http://127.0.0.1:${port}`
const url = `${base}/#/calculate`

function openPage() {
    if (process.argv.includes('--no-browser')) return
    const browser = spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' })
    browser.on('error', () => console.log(`无法自动打开浏览器，请手动访问：${url}`))
    browser.unref()
}

async function main() {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MONA_PORT 必须是 1–65535 之间的端口号。')
    const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
        .catch(() => { throw new Error('缺少构建文件，请先在项目目录运行 npm run build:local。') })
    const { createLocalServer } = await import('../server/local.mjs')
    const server = createLocalServer()
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, '127.0.0.1', resolve)
        })
    } catch (error) {
        server.close()
        if (error.code !== 'EADDRINUSE') throw error
        const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(3000), redirect: 'error' }).catch(() => null)
        if (!response?.ok || await response.text() !== index) {
            throw new Error(`端口 ${port} 被其他服务占用，请关闭占用程序后重试。`)
        }
        console.log(`莫娜已在运行，打开现有页面：${url}`)
        openPage()
        return
    }
    console.log(`莫娜已启动：${url}`)
    console.log('使用期间请保留此窗口；关闭窗口或按 Ctrl+C 可停止服务。')
    openPage()
}

main().catch(error => {
    console.error(`启动失败：${error.message}`)
    process.exitCode = 1
})
