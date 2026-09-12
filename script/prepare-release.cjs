/* Restore the published runtime and generated metadata, NOT original Rust source.
 * Pinned to the user's chosen Mona fork, v5.33.58. Does not launch the installer.
 */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const parser = require('@babel/parser')
const root = path.resolve(__dirname, '..')
const cache = path.join(root, '.cache', 'mona-release')
const hash = 'dc56d714ec0413ce4afff7e09dca3b2b6edcad237753e4dca9fb8b7bdf264034'
const url = 'https://github.com/1803233552/genshin_artifact/releases/download/v5.33.58/genshin_artifact_5.33.58_x64-setup.exe'
function write(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content) }
function generated(file, value) { write(path.join(root, 'src/assets', file), `// Generated from Mona v5.33.58; see script/prepare-release.cjs.\nexport default ${JSON.stringify(value, null, 2)}\n`) }

async function main() {
    fs.mkdirSync(cache, { recursive: true })
    const installer = process.argv[2] || path.join(cache, 'setup.exe')
    if (!fs.existsSync(installer)) {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Download failed: ${response.status}`)
        write(installer, Buffer.from(await response.arrayBuffer()))
    }
    const digest = crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex')
    if (digest !== hash) throw new Error('Installer SHA-256 mismatch; refusing unverified release')
    const sevenZip = process.env.SEVEN_ZIP || (fs.existsSync('C:/Program Files/7-Zip/7z.exe') ? 'C:/Program Files/7-Zip/7z.exe' : '7z')
    execFileSync(sevenZip, ['x', installer, 'genshin_artifact.exe', `-o${cache}`, '-y'], { stdio: 'pipe', windowsHide: true })
    const data = fs.readFileSync(path.join(cache, 'genshin_artifact.exe'))
    const pe = data.readUInt32LE(0x3c), sectionCount = data.readUInt16LE(pe + 6), optional = pe + 24
    const base = Number(data.readBigUInt64LE(optional + 24)), sectionStart = optional + data.readUInt16LE(pe + 20)
    const sections = Array.from({ length: sectionCount }, (_, i) => {
        const p = sectionStart + i * 40
        return { rva: data.readUInt32LE(p + 12), size: data.readUInt32LE(p + 16), offset: data.readUInt32LE(p + 20) }
    })
    function offset(va) {
        const rva = va - base, s = sections.find(s => rva >= s.rva && rva < s.rva + s.size)
        if (!s) throw new Error('Invalid PE address')
        return s.offset + rva - s.rva
    }
    const key = '/05b1442888f6e9a6.module.wasm', keyOffset = data.indexOf(key)
    const section = sections.find(s => keyOffset >= s.offset && keyOffset < s.offset + s.size)
    if (!section) throw new Error('WASM asset table not found')
    const address = Buffer.alloc(8); address.writeBigUInt64LE(BigInt(base + section.rva + keyOffset - section.offset))
    const pivot = data.indexOf(address)
    function entry(p) {
        try {
            const values = Array.from({ length: 4 }, (_, i) => Number(data.readBigUInt64LE(p + i * 8)))
            const [kp, kl, vp, vl] = values
            if (kl < 2 || kl > 512 || vl < 1 || vl > data.length) return null
            const k = data.subarray(offset(kp), offset(kp) + kl).toString('utf8')
            if (!k.startsWith('/') || /[\x00-\x1f]/.test(k)) return null
            return { key: k, bytes: data.subarray(offset(vp), offset(vp) + vl) }
        } catch { return null }
    }
    let start = pivot, end = pivot
    while (entry(start - 32)) start -= 32
    while (entry(end + 32)) end += 32
    const assets = {}
    for (let p = start; p <= end; p += 32) {
        const e = entry(p)
        if (!e) throw new Error('Invalid asset table')
        assets[e.key] = zlib.brotliDecompressSync(e.bytes)
    }
    const context = vm.createContext({ self: { webpackChunkgenshin_artifacts: [] }, TextEncoder, TextDecoder, console })
    const code = assets['/js/app.8978cf71.js'].toString()
    const object = parser.parse(code).program.body[0].expression.callee.body.body[0].declarations[0].init
    const modules = vm.runInContext(`(${code.slice(object.start, object.end)})`, context, { timeout: 5000 })
    for (const [key, bytes] of Object.entries(assets)) {
        if (!key.endsWith('.js') || key.includes('legacy')) continue
        const source = bytes.toString()
        if (source.slice(0, 100).includes('webpackChunkgenshin_artifacts')) vm.runInContext(source, context, { timeout: 5000 })
    }
    for (const chunk of context.self.webpackChunkgenshin_artifacts) Object.assign(modules, chunk[1])
    const moduleCache = {}, polyfills = new Set([14602, 35231, 87136, 40173, 30959])
    function req(id) {
        if (polyfills.has(id)) return {}
        if (moduleCache[id]) return moduleCache[id].exports
        const m = { exports: {} }; moduleCache[id] = m
        if (!modules[id]) throw new Error(`Missing metadata module ${id}`)
        modules[id](m, m.exports, req)
        return m.exports
    }
    req.d = (o, defs) => { for (const [key, get] of Object.entries(defs)) Object.defineProperty(o, key, { get, enumerable: true }) }
    req.r = () => {}; req.p = '/release-assets/'
    generated('_gen_character.js', req(91825).default)
    generated('_gen_weapon.js', req(76755).z)
    generated('_gen_artifact.js', req(91420).Yj)
    generated('_gen_tf.js', req(32358).o)
    generated('_gen_buff.js', req(75892).c$)
    const pfSource = modules[93917].toString()
    const pfTree = parser.parse(`(${pfSource})`)
    let pfObject
    for (const statement of pfTree.program.body[0].expression.body.body) {
        if (statement.type !== 'VariableDeclaration') continue
        for (const d of statement.declarations) if (d.init?.type === 'ObjectExpression' && d.init.properties.some(p => p.key?.name === 'ArtifactEff')) pfObject = d.init
    }
    if (!pfObject) throw new Error('Potential metadata not found')
    generated('_gen_pf.js', vm.runInNewContext(`(${`(${pfSource})`.slice(pfObject.start, pfObject.end)})`, { p: req(96337) }))
    const zh = req(57924).default
    write(path.join(root, 'src/i18n/generated/zh-cn.json'), JSON.stringify(zh.a))
    // Locate the English locale through its data, without executing the application.
    const englishId = Object.keys(modules).find(id => modules[id].toString().includes('webName:"Mona'))
    const en = englishId ? req(Number(englishId)).default : null
    write(path.join(root, 'src/i18n/generated/en.json'), JSON.stringify(en?.a || zh.a))
    for (const [key, bytes] of Object.entries(assets)) if (key.startsWith('/img/')) {
        const target = path.resolve(root, 'public/release-assets', `.${key}`)
        if (!target.startsWith(path.join(root, 'public/release-assets') + path.sep)) throw new Error('Unsafe asset path')
        write(target, bytes)
    }
    const pkg = path.join(root, 'mona_wasm/pkg')
    const glueSource = modules[859].toString()
    write(path.join(pkg, 'bindings.js'), `// Original generated JS bindings, Mona v5.33.58.\nconst bindings = {};\nconst req = () => ({});\nreq.d = (o, defs) => { for (const [key, get] of Object.entries(defs)) Object.defineProperty(o, key, { get }); };\n(${glueSource})({exports:bindings}, bindings, req);\nexport { bindings };\n`)
    const bridge = {}, glueStub = new Proxy({}, { get: (_, key) => key })
    const importReq = () => glueStub
    importReq.v = (_, id, key, imports) => Object.assign(bridge, imports['./mona_wasm_bg.js'])
    modules[93339]({ id: 93339 }, {}, importReq)
    write(path.join(pkg, 'mona_wasm_bg.js'), `import { bindings } from './bindings.js';\n${Object.entries(bridge).map(([name, prop]) => `export const ${name} = bindings.${prop};`).join('\n')}\n`)
    write(path.join(pkg, 'mona_wasm_bg.wasm'), assets[key])
    const classes = { BonusPerStat: 'bd', CalcArtifactBestSet: 'uC', CalculatorInterface: 'K2', CommonInterface: 'Ps', DSLInterface: 'ZB', OptimizeSingleWasm: 'E2', PotentialInterface: 'gF', TeamOptimizationWasm: 'B8', TransformativeDamage: 'PX' }
    write(path.join(pkg, 'index.js'), `import * as bridge from './mona_wasm_bg.js';\nimport { bindings } from './bindings.js';\nconst response = await fetch(new URL('./mona_wasm_bg.wasm?raw-wasm', import.meta.url));\nif (!response.ok) throw new Error('Mona calculation core could not be loaded');\nconst { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), { './mona_wasm_bg.js': bridge });\nbindings.lI(instance.exports);\n${Object.entries(classes).map(([name, prop]) => `export const ${name} = bindings.${prop};`).join('\n')}\n`)
    write(path.join(pkg, 'package.json'), JSON.stringify({ name: 'mona', version: '5.33.58', module: 'index.js', type: 'module', sideEffects: true }))
    write(path.join(pkg, 'release.json'), JSON.stringify({ version: '5.33.58', url, sha256: hash, assets: Object.keys(assets).length }, null, 2))
    console.log(`Prepared Mona v5.33.58 runtime and metadata (${Object.keys(assets).length} assets).`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
