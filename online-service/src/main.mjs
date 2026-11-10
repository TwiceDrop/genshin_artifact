import nodemailer from 'nodemailer'
import { loadConfig } from './config.mjs'
import { createPool } from './db.mjs'
import { createVault } from './crypto.mjs'
import { createApi } from './http.mjs'

const config = loadConfig()
const pool = createPool(config)
const mail = nodemailer.createTransport(config.smtp)
const server = createApi({ pool, config, vault: createVault(config.vaultKey),
    sendCode: async ({ email, code }) => {
        await mail.sendMail({ from: config.mailFrom, to: email, subject: '莫娜占卜铺登录验证码',
            text: `你的登录验证码是：${code}\n有效期 ${Math.ceil(config.otpTtlSeconds / 60)} 分钟。请勿将验证码提供给他人。\n如果不是你本人操作，请忽略此邮件。`,
            disableFileAccess: true, disableUrlAccess: true })
    },
})
server.requestTimeout = 45000
server.headersTimeout = 10000
server.listen(config.port, config.host, () => console.log(JSON.stringify({ event: 'api_ready', port: config.port })))
let closing = false
async function shutdown() {
    if (closing) return
    closing = true
    server.close(async () => { mail.close(); await pool.end() })
    setTimeout(() => process.exit(1), 15000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
