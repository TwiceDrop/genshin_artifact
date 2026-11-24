import { matchOcrName, normalizeName } from './ocr-name-match.mjs'
import { weaponBaseStats } from '@/algorithms/roster-attributes.mjs'
import rosterCatalog from '../../beta-data/roster-attributes.mjs'

// readArtifactScreenshot normalizes the full battle-record card to 1080 pixels wide.
export async function readRoleHeader(canvas, reader, signal, catalog) {
    const ctx = canvas.getContext('2d')
    const transcript = []
    async function read(label, x, y, width, height, darkText = false) {
        signal.throwIfAborted()
        const crop = document.createElement('canvas')
        crop.width = width * 2 + 20
        crop.height = height * 2 + 20
        const c = crop.getContext('2d')
        c.fillStyle = 'white'
        c.fillRect(0, 0, crop.width, crop.height)
        c.drawImage(canvas, x, y, width, height, 10, 10, width * 2, height * 2)
        const pixels = c.getImageData(10, 10, width * 2, height * 2)
        for (let i = 0; i < pixels.data.length; i += 4) {
            const v = pixels.data[i] * .30 + pixels.data[i+1] * .59 + pixels.data[i+2] * .11
            pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = darkText ? (v < 100 ? 0 : 255) : (v > 128 ? 0 : 255)
        }
        c.putImageData(pixels, 10, 10)
        const text = (await reader.readLine(crop)).normalize('NFKC').replace(/\s/g, '')
        transcript.push([label, text])
        return text
    }
    // The character level has a gold rectangular badge following the variable-width name.
    const stripe = ctx.getImageData(150, 988, 700, 36).data
    const columns = []
    for (let x = 0; x < 700; x++) {
        let gold = 0
        for (let y = 0; y < 36; y++) {
            const i = 4 * (y*700 + x)
            if (stripe[i] > 175 && stripe[i+1] > 135 && stripe[i] - stripe[i+2] > 45) gold++
        }
        if (gold > 16) columns.push(x + 150)
    }
    const left = columns[0], right = columns.at(-1)
    const alphabet = entries=>[...new Set(entries.map(e=>catalog.locale[e.nameLocale]).join(''))].join('')
    await reader.configure('chi_sim', alphabet(Object.values(catalog.characters)))
    const title = await read('角色', 150, 977, left > 155 ? left - 151 : 310, 57)
    const choices = catalog.rosterChoices.map(key => ({key, label:catalog.locale[catalog.characters[key].nameLocale]}))
    let matches = matchOcrName(title, choices)
    if (matches.length > 1) {
        await reader.configure('chi_sim', alphabet(matches.map(choice => catalog.characters[choice.key])))
        const reread = await read('角色名复核',150,977,left>155?left-151:310,57)
        matches = matchOcrName(reread, matches)
    }
    const character = matches.length === 1 ? matches[0].key : ''
    if (character && title !== matches[0].label) transcript.push(['角色名匹配', matches[0].label])
    const weaponType = character && catalog.characters[character].weapon
    const candidates = Object.values(catalog.weapons).filter(w => w.type === weaponType)
    await reader.configure('chi_sim', alphabet(candidates)+'Lv.0123456789')
    const weaponLine = await read('武器', 251, 1951, 560, 51)
    const weaponChoices = candidates.map(w => ({key:w.name, label:catalog.locale[w.nameLocale]}))
    const visibleName = normalizeName(weaponLine)
    let weaponMatches = matchOcrName(weaponLine, weaponChoices)
    if (weaponMatches.length > 1) {
        await reader.configure('chi_sim', alphabet(weaponMatches.map(w => catalog.weapons[w.key]))+'Lv.0123456789')
        const reread = await read('武器名复核',251,1951,560,51)
        const narrowed = matchOcrName(reread, weaponMatches)
        if (narrowed.length) weaponMatches = narrowed
    }
    const form = {character, weapon: weaponMatches.length === 1 ? weaponMatches[0].key : '',
        talents: ['', '', ''], ascend:'', weaponAscend:'', transcript, stats:{}}
    await reader.configure('eng', '0123456789')
    const digits = async (...args) => (await read(...args)).match(/^\d+$/)?.[0] || ''
    form.uid = await digits('UID', 244, 126, 210, 40)
    if (!/^\d{8,10}$/.test(form.uid)) form.uid = ''
    form.level = right > left + 40 ? await digits('角色等级', right - 46, 989, 44, 35, true) : ''
    // Level follows the weapon name inside a dark badge, including a Latin Lv prefix.
    await reader.configure('eng', 'Lv.0123456789')
    form.weaponLevel = (await read('武器等级', 250, 1954, 550, 46)).match(/Lv\.?([1-9]\d?)$/i)?.[1] || weaponLine.match(/Lv\.?([1-9]\d?)$/i)?.[1] || ''
    await reader.configure('eng', '0123456789')
    form.refine = await digits('精炼', 79, 1956, 29, 39)
    if (!form.weapon && weaponType && Number(form.weaponLevel)>0 && Number(form.weaponLevel)<=90) {
        const base=await digits('武器基础攻击力',403,2016,66,36)
        const pool = !weaponMatches.length && visibleName.length === 1
            ? weaponChoices.filter(w => w.label.includes(visibleName)) : weaponMatches
        const matches=pool.filter(w=>{
            if(!rosterCatalog.weapons[w.key]) return false
            return [false,true].some(ascend=>Math.round(weaponBaseStats({name:w.key,level:Number(form.weaponLevel),ascend}).FIGHT_PROP_BASE_ATTACK)===Number(base))
        })
        if(matches.length===1) form.weapon=matches[0].key
    }
    if (form.weapon) transcript.push(['武器名匹配',catalog.locale[catalog.weapons[form.weapon].nameLocale]])
    // Talent badges are black rounded rectangles; their horizontal spacing varies with passive count.
    const strip = ctx.getImageData(35, 1195, 1010, 20).data
    const runs = []
    let last = -100
    for (let x = 0; x < 1010; x++) {
        let dark = 0
        for (let y = 0; y < 20; y++) {
            const i = 4*(y*1010+x)
            if (Math.max(strip[i],strip[i+1],strip[i+2]) < 50) dark++
        }
        if (dark < 9) continue
        if (x-last > 10) runs.push({left:x+35})
        runs.at(-1).right = x+35
        last=x
    }
    const badges = runs.filter(r => r.right-r.left >= 22 && r.right-r.left < 68)
    for (const [i,r] of badges.slice(0,3).entries()) {
        const center=Math.round((r.left+r.right)/2), width=r.right-r.left>=44?33:19
        form.talents[i] = await digits(['普通攻击','元素战技','元素爆发'][i],center-Math.floor(width/2),1192,width,24)
    }
    // Read the luminosity of each node's rim, never the varying artwork inside it.
    const nodes = [[918,343],[970,435],[998,533],[998,633],[970,733],[918,827]].map(([x,y])=>{
        const pixels = ctx.getImageData(x-32,y-32,65,65).data, ring = []
        let lockInk = 0
        for(let j=-32;j<=32;j++) for(let k=-32;k<=32;k++) {
            const d = j*j+k*k
            const p=4*((j+32)*65+k+32)
            if(d < 14*14 && Math.min(pixels[p],pixels[p+1],pixels[p+2])>155) lockInk++
            if(d >= 28*28 && d <= 32*32) ring.push(Math.max(pixels[p],pixels[p+1],pixels[p+2]))
        }
        const v = ring.sort((a,b)=>a-b)[Math.floor(ring.length*.65)]
        return v > 165 ? '1' : v < 85 && lockInk>35 ? '0' : '?'
    }).join('')
    form.constellation = /^1*0*$/.test(nodes) ? String(nodes.indexOf('0') < 0 ? 6 : nodes.indexOf('0')) : ''
    transcript.push(['命座图标',nodes])
    await reader.configure('eng', '0123456789.%')
    for (const [i,label] of ['生命值','攻击力','防御力','元素精通','暴击率','暴击伤害','元素充能效率'].entries()) {
        const y=[1382,1469,1555,1642,1382,1469,1729][i], percent=i>=4
        const text=await read(label,percent?903:405,y,percent?114:116,48)
        form.stats[label]=text.replace(/%$/,'').match(percent ? /^\d+\.\d$/ : /^\d+$/)?.[0] || ''
    }
    return form
}
