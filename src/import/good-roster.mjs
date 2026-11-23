import { avatars } from './enka-catalog.mjs'
import mapping from './data/good-character-mapping.mjs'
import { canonicalGameElement } from './character-summary.mjs'
import { snapshotRelic, snapshotWeapon } from './miyoushe.mjs'

const gameCharacters = new Map(Object.entries(avatars).map(([key, avatar]) =>
    [avatar.name, { id: Number(key.split('-')[0]), element: avatar.element }]))
const travelerBonuses = { Anemo: 'QE', Geo: 'QE', Electro: 'QE', Dendro: 'EQ', Hydro: 'EQ', Pyro: 'EQ', Cryo: 'QE' }

export function validateGoodRoster(file) {
    if (file?.format !== 'GOOD' || file.version !== 3) throw new Error('角色导入需要 GOOD v3 文件')
    if (!Array.isArray(file.characters) || !file.characters.length) throw new Error('GOOD 文件没有角色，请在 GGScanner 勾选角色后重新导出')
    if (file.characters.length > 300) throw new Error('单次最多导入 300 个角色')
    for (const field of ['weapons', 'artifacts']) {
        if (file[field] != null && !Array.isArray(file[field])) throw new Error('GOOD 文件格式无效：' + field)
    }
    const uid = file.metadata?.uid
    if (uid != null && !/^\d{8,10}$/.test(String(uid))) throw new Error('GOOD 文件的 UID 格式无效')
    return uid == null ? '' : String(uid)
}

function inRange(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(label + '超出支持范围')
    return value
}

function byWearer(rows) {
    const groups = new Map()
    for (const row of rows || []) {
        if (!row?.location) continue
        if (!groups.has(row.location)) groups.set(row.location, [])
        groups.get(row.location).push(row)
    }
    return groups
}

function resolveRole(row, traveler) {
    if (row.key !== 'Traveler') return mapping.characterAliases[row.key] || row.key
    const element = Object.keys(travelerBonuses).find(e => e.toLowerCase() === row.element?.toLowerCase())
    if (!element) throw new Error('旅行者缺少可识别的元素')
    if (!['Aether', 'Lumine'].includes(traveler)) throw new Error('请选择旅行者空或荧')
    return traveler + element
}

// GOODScanner reports base talents; Mona accepts the levels shown on the character card.
function snapshotSkills(row, name, meta, locale) {
    const levels = ['auto','skill','burst'].map(k => inRange(row.talent?.[k], 1, 10, '天赋'))
    const order = row.key === 'Traveler' ? travelerBonuses[meta.element] : mapping.constellationTalents[name]
    for (const [i, threshold] of [3, 5].entries()) {
        if (row.constellation < threshold) continue
        const slot = 'AEQ'.indexOf(order?.[i] || '?')
        if (slot < 0) throw new Error('此角色的命座天赋等级尚未适配')
        levels[slot] += 3
    }
    if (name === 'Tartaglia') levels[0]++
    return levels.map((level, i) => ({ level, skill_type: 1, name: locale[meta['skillName' + (i + 1)]] }))
}

export function goodRosterSnapshot(file, uid, { catalog, data, presets, inventory, convertArtifacts, traveler }) {
    const declared = validateGoodRoster(file)
    if (!/^\d{8,10}$/.test(uid) || (declared && declared !== uid)) throw new Error('导入目标 UID 无效或与文件不符')
    const { characters, weapons, artifacts, locale } = catalog
    const weaponGroups = byWearer(file.weapons), relicGroups = byWearer(file.artifacts)
    const previous = data.snapshots[uid]?.characters || []
    const roles = [], failures = [], seen = new Set()
    const encodeGear = a => snapshotRelic(a, locale[artifacts[a.setName].nameLocale])
    for (const row of file.characters) {
        try {
            const name = resolveRole(row, traveler), identity = gameCharacters.get(name), meta = characters[name]
            if (!identity || !meta) throw new Error('此角色尚未适配')
            const level = inRange(row.level, 1, 100, '等级'), ascension = inRange(row.ascension, 0, 6, '突破')
            const constellation = inRange(row.constellation, 0, 6, '命座')
            const skills = snapshotSkills(row, name, meta, locale)
            const old = previous.find(r => Number(r.base?.id) === identity.id && canonicalGameElement(r.base.element) === meta.element)
            const entry = data.entries.find(e => e.uid === uid && Number(e.id || e.key.split(':')[1]) === identity.id &&
                canonicalGameElement(e.element || e.key.split(':')[2]) === meta.element)
            const preset = presets[entry?.presetName]?.item
            const worn = weaponGroups.get(row.key) || []
            if (worn.length > 1) throw new Error('多把武器标记为此角色穿戴')
            let weapon
            if (worn.length) {
                const w = worn[0], info = weapons[mapping.weaponAliases[w.key] || w.key]
                if (!info || info.type !== meta.weapon) throw new Error('无法匹配装备武器：' + w.key)
                weapon = { name: locale[info.nameLocale], level: inRange(w.level, 1, 90, '武器等级'),
                    affix_level: inRange(w.refinement, 1, 5, '武器精炼'), promote_level: inRange(w.ascension, 0, 6, '武器突破') }
            } else {
                weapon = preset?.weapon ? snapshotWeapon(preset.weapon, locale[weapons[preset.weapon.name].nameLocale]) : old?.weapon
            }
            const equipped = relicGroups.get(row.key) || []
            let relics
            if (file.artifacts != null) {
                relics = Object.values(convertArtifacts({ ...file, artifacts: equipped })).flat().map(encodeGear)
                if (new Set(relics.map(r => r.pos)).size !== relics.length) throw new Error('同一角色的圣遗物部位重复')
            } else {
                relics = old?.relics ?? (entry?.equippedArtifacts || (preset?.artifactIds || []).map(id => inventory.get(id)).filter(Boolean)).map(encodeGear)
            }
            roles.push({ base: { id: identity.id, name: locale[meta.nameLocale], element: old?.base.element ?? entry?.key.split(':')[2] ?? identity.element,
                level, promote_level: ascension, actived_constellation_num: constellation }, skills, weapon, relics })
        } catch (e) { failures.push((row?.key || '未知角色') + '：' + e.message) }
    }
    if (!roles.length) throw new Error(failures.join('；'))
    for (const role of roles) {
        const key = role.base.id + ':' + role.base.element
        if (seen.has(key)) throw new Error('GOOD 文件含重复角色：' + role.base.name)
        seen.add(key)
    }
    const role = { uid }
    if (typeof file.metadata?.nickname === 'string' && file.metadata.nickname) role.nickname = file.metadata.nickname
    return { version: 1, source: 'good', role, characters: roles, total: roles.length, failures,
        importedAt: new Date().toISOString() }
}
