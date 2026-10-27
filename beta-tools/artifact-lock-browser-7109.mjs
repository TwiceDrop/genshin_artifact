import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createLocalServer } from '../server/local.mjs'
import { fixture } from './interface-audit-7108.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const input = fixture('Klee')
const artifacts = ['flower', 'feather', 'sand', 'cup', 'head'].map((position, i) => ({
    id: i + 1, position, setName: 'gladiatorFinale', level: 20, star: 5, omit: false,
    mainTag: i === 0 ? { name: 'lifeStatic', value: 4780 } : i === 1 ? { name: 'attackStatic', value: 311 }
        : i === 2 ? { name: 'elementalMastery', value: 187 } : i === 3 ? { name: 'fireBonus', value: .466 } : { name: 'critical', value: .311 },
    normalTags: [{ name: 'criticalDamage', value: .14 }, { name: 'attackPercentage', value: .058 },
        { name: 'recharge', value: .065 }, { name: 'elementalMastery', value: 23 }]
}))
const uid = '999999999', key = uid + ':synthetic:Fire'
const preset = { character: input.character, weapon: input.weapon, targetFunction: input.target_function,
    artifactIds: [1, 2, 3, 4, 5], buffs: [], algorithm: 'Naive', useDSL: false }
const pack = { format: 'mona-uid', version: 1, uid, characters: [{ entry: { key, uid, label: '可莉',
    artifactIds: [1, 2, 3, 4, 5] }, preset }], artifacts, history: [], snapshot: null }
const directory = '.build-target/artifact-lock-7109'
fs.mkdirSync(directory, { recursive: true })
fs.writeFileSync(directory + '/synthetic-uid.json', JSON.stringify(pack))
const server = createLocalServer({ root: path.resolve('dist'), credentialStore: { all: async () => [] } })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
    await page.goto(`http://127.0.0.1:${server.address().port}/#/calculate`)
    await page.getByRole('button', { name: '米游社导入', exact: true }).click()
    await page.locator('.mys-backup input[type=file]').setInputFiles(directory + '/synthetic-uid.json')
    await page.getByRole('button', { name: '选择可莉，999999999', exact: true }).click()
    const score = page.locator('.artifact-grade-summary')
    await score.getByText('163.8', { exact: true }).waitFor()
    const equipment = page.locator('.middle-container')
    const before = await equipment.innerText()
    await page.getByRole('button', { name: '锁定全部', exact: true }).click()
    await page.getByRole('button', { name: '解锁全部', exact: true }).waitFor()
    assert.equal(await score.locator('strong').innerText(), '163.8')
    assert.equal((await equipment.innerText()).replace('解锁全部', '锁定全部'), before)
    await page.screenshot({ path: directory + '/calculator-locked.png', fullPage: true })
    await page.getByRole('button', { name: '解锁全部', exact: true }).click()
    await page.getByRole('button', { name: '锁定全部', exact: true }).waitFor()
    assert.equal(await equipment.innerText(), before)
    assert.deepEqual(errors, [])
    fs.writeFileSync(directory + '/browser-result.md', '# 计算器实际点击验证\n\n独立空白浏览器，合成 UID 999999999，可莉五件圣遗物。\n\n实际点击锁定全部／解锁全部，评分均为 163.8，逐件得分与伤害区域全文保持一致；没有页面运行错误。\n')
    console.log('实际计算器锁定全部／解锁全部：评分、逐件得分与伤害保持一致；163.8 分。')
} finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
}
