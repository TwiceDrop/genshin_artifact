export const POSITIONS = ['flower', 'feather', 'sand', 'cup', 'head']
const PROPERTY = { 2: 'lifeStatic', 3: 'lifePercentage', 5: 'attackStatic', 6: 'attackPercentage', 8: 'defendStatic', 9: 'defendPercentage', 20: 'critical', 22: 'criticalDamage', 23: 'recharge', 26: 'cureEffect', 28: 'elementalMastery', 30: 'physicalBonus', 40: 'fireBonus', 41: 'thunderBonus', 42: 'waterBonus', 43: 'dendroBonus', 44: 'windBonus', 45: 'rockBonus', 46: 'iceBonus' }
const FLAT = new Set([2, 5, 8, 28])
const BREAKS = [20, 40, 50, 60, 70, 80]
function integer(value, min, max, label) {
    if (value === undefined || value === null || value === '') throw new Error(`${label}缺失`)
    const n = Number(value)
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}超出支持范围`)
    return n
}
function number(value) {
    const str = String(value ?? '').trim().replace(/[,，]/g, '').replace(/[%％]$/, '')
    return str !== '' && /^\d+(\.\d+)?$/.test(str) ? Number(str) : NaN
}
function property(p) {
    const name = PROPERTY[p?.property_type], n = number(p?.value)
    if (!name || !Number.isFinite(n)) throw new Error('圣遗物属性缺失或无法识别')
    return { name, value: FLAT.has(Number(p.property_type)) ? n : n / 100 }
}
function defaults(name, config = []) {
    return config?.length ? { [name]: Object.fromEntries(config.map(c => [c.name, c.default])) } : 'NoConfig'
}
const iconKey = url => String(url || '').match(/UI_(?:AvatarIcon|EquipIcon|RelicIcon)_[A-Za-z0-9_]+/)?.[0]

export function createMysConverter({ characters, weapons, artifacts, targets, locale, inferAscend }) {
    const find = (data, api) => {
        const matches = Object.keys(data).filter(k => locale[data[k].nameLocale] === api?.name || (iconKey(api?.icon) && [data[k].avatar, data[k].url].some(url => iconKey(url) === iconKey(api.icon))))
        return matches.length === 1 ? matches[0] : undefined
    }
    function artifact(raw) {
        const position = POSITIONS[integer(raw.pos, 1, 5, '圣遗物部位') - 1]
        const matches = Object.keys(artifacts).filter(k => {
            const meta = artifacts[k]
            return (raw.name && locale[meta[position]?.text] === raw.name) || (raw.set?.name && locale[meta.nameLocale] === raw.set.name) || (iconKey(raw.icon) && iconKey(meta[position]?.url) === iconKey(raw.icon))
        })
        if (matches.length !== 1) throw new Error(`未知圣遗物：${raw.name || raw.id}`)
        const star = integer(raw.rarity, 1, 5, '圣遗物星级')
        const level = integer(raw.level, 0, Math.min(20, star * 4), '圣遗物等级')
        if (!Array.isArray(raw.sub_property_list) || raw.sub_property_list.length > 4) throw new Error('副词条列表无效')
        const mainTag = property(raw.main_property), normalTags = raw.sub_property_list.map(property)
        if (normalTags.some(t => !['critical', 'criticalDamage', 'attackStatic', 'attackPercentage', 'lifeStatic', 'lifePercentage', 'defendStatic', 'defendPercentage', 'elementalMastery', 'recharge'].includes(t.name)) || new Set(normalTags.map(t => t.name)).size !== normalTags.length || normalTags.some(t => t.name === mainTag.name)) throw new Error('副词条类型无效')
        return { setName: matches[0], position, star, level, mainTag, normalTags }
    }
    function character(raw, uid) {
        const base = raw.base || {}, id = integer(base.id, 1, 999999999, '角色 ID')
        let name = find(characters, base)
        if ([10000005, 10000007].includes(id)) {
            const element = { Wind: 'Anemo', Rock: 'Geo', Electric: 'Electro', Grass: 'Dendro', Water: 'Hydro', Fire: 'Pyro', Ice: 'Cryo' }[base.element] || base.element
            name = (id === 10000005 ? 'Aether' : 'Lumine') + element
        }
        if (!characters[name]) throw new Error(`未知角色：${base.name || id}`)
        const weaponName = find(weapons, raw.weapon)
        if (!weaponName) throw new Error(`未知武器：${raw.weapon?.name || raw.weapon?.id}`)
        if (weapons[weaponName].type !== characters[name].weapon) throw new Error('角色与武器类型不匹配')
        const level = integer(base.level, 1, 100, '角色等级')
        const active = (raw.skills || []).filter(s => Number(s.skill_type) === 1)
        const named = [1, 2, 3].map(i => active.find(s => s.name === locale[characters[name][`skillName${i}`]]))
        const skills = named.every(Boolean) ? named : active
        if (skills.length !== 3) throw new Error('无法确定三个主动天赋的对应关系')
        const c = { name, level, ascend: false, constellation: integer(base.actived_constellation_num, 0, 6, '命座'),
            skill1: integer(skills[0].level, 1, 15, '普攻天赋') - 1, skill2: integer(skills[1].level, 1, 15, '战技天赋') - 1, skill3: integer(skills[2].level, 1, 15, '爆发天赋') - 1, params: defaults(name, characters[name].config) }
        const wl = integer(raw.weapon.level, 1, 90, '武器等级'), wp = integer(raw.weapon.promote_level, 0, 6, '武器突破')
        const w = { name: weaponName, level: wl, ascend: BREAKS.includes(wl) && wp > BREAKS.indexOf(wl), refine: integer(raw.weapon.affix_level, 1, 5, '武器精炼'), params: defaults(weaponName, weapons[weaponName].configs) }
        if (BREAKS.includes(level)) {
            const promote = base.promote_level ?? raw.promote_level
            if (promote !== undefined) c.ascend = integer(promote, 0, 6, '角色突破') > BREAKS.indexOf(level)
            else {
                const hp = number(raw.selected_properties?.find(p => Number(p.property_type) === 2000)?.base)
                const result = inferAscend?.(c, w, hp)
                if (typeof result !== 'boolean') throw new Error('突破临界等级缺少可靠基础生命值，需手动确认突破状态')
                c.ascend = result
            }
        }
        const tf = Object.values(targets).find(t => t.for === name) || Object.values(targets).find(t => t.for === 'common')
        if (!tf) throw new Error('缺少目标函数')
        if (!Array.isArray(raw.relics)) throw new Error('已装备圣遗物列表缺失')
        const gear = raw.relics.map(artifact)
        if (new Set(gear.map(a => a.position)).size !== gear.length) throw new Error('圣遗物部位重复')
        return { key: `${uid}:${id}:${base.element || ''}`, label: locale[characters[name].nameLocale], id, gear,
            preset: { name: `米游社 ${uid} · ${locale[characters[name].nameLocale]}`, character: c, weapon: w,
                targetFunction: { name: tf.name, params: defaults(tf.name, tf.config) }, buffs: [], artifactEffectMode: 'auto' } }
    }
    return { artifact, character }
}

// Content identity, not a game item ID. Preserve multiplicity within each snapshot.
export function artifactFingerprint(a) {
    const quantize = n => Number(Number(n).toFixed(6))
    return JSON.stringify([a.setName, a.position, a.star, a.level, a.mainTag.name, quantize(a.mainTag.value), a.normalTags.map(t => [t.name, quantize(t.value)]).sort((a, b) => a[0].localeCompare(b[0]))])
}
export function mergeEquipped(entries, existing, addArtifact, previous = {}) {
    const pool = new Map(), used = new Set(), equipment = {}
    let added = 0, reused = 0
    for (const a of existing) { const fp = artifactFingerprint(a); if (!pool.has(fp)) pool.set(fp, []); pool.get(fp).push(a.id) }
    for (const entry of entries) {
        const ids = [-1, -1, -1, -1, -1]
        for (const a of entry.gear) {
            const index = POSITIONS.indexOf(a.position), candidates = pool.get(artifactFingerprint(a)) || []
            const preferred = previous[entry.key]?.[index]
            let id = candidates.includes(preferred) && !used.has(preferred) ? preferred : candidates.find(id => !used.has(id))
            if (id === undefined) { id = addArtifact(a); added++ } else reused++
            used.add(id); ids[index] = id
        }
        equipment[entry.key] = ids
    }
    return { equipment, added, reused }
}
