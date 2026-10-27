import {spawn} from 'node:child_process'
import {appendFileSync} from 'node:fs'

const [script, ...args] = process.argv.slice(2)
const log = args[args.indexOf('-Package') + 1] + '.update.log'
// The temporary Node process stays alive until PowerShell finishes the update.
const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
    {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']})
let ready = false, output = '', errors = ''
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', text => {
    appendFileSync(log, text)
    output += text
    if (!ready && /(?:^|\r?\n)MONA_UPDATE_READY\r?\n/.test(output)) {
        ready = true
        process.send({ready: true}, () => process.disconnect())
    }
})
child.stderr.on('data', text => {errors += text; appendFileSync(log, text)})
child.once('error', error => {errors += error.message; appendFileSync(log, error.message + '\n')})
child.once('close', code => {
    appendFileSync(log, 'MONA_UPDATE_EXIT ' + code + '\n')
    if (!ready) {
        const error = '安装脚本未开始执行（代码 ' + code + '）：' + errors.trim() + '；日志：' + log
        process.send({error}, () => process.disconnect())
    }
    process.exitCode = code || (!ready ? 1 : 0)
})
