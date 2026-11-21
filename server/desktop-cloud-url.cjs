const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

// Windows 两种打包方式都会复制 server 目录。配置文件只存服务地址。
const file = path.join(__dirname, 'desktop-cloud-url.local.json')
module.exports = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : ''
