const skillFields = { skill1: 'skill1', skill2: 'skill2', skill3: 'skill3', e_level: 'skill2', q_level: 'skill3', burst_level: 'skill3' }
const skillsByBuff = { LaumaSkillResMinus: 'skill2', LaumaBurst: 'skill3', KamisatoAyatoQ: 'skill3', FurinaQ: 'skill3',
    XilonenE: 'skill2', YumemizukiMizukiE: 'skill2', IllugaQ: 'skill3', AlyoshaHunterPrecision: 'skill2' }
const constellationFields = { c1: 1, c2: 2, c4: 4, c6: 6, enable_c6: 6, has_c2: 2, is_c6: 6, c4_enabled: 4 }
export function isBoundBuffField(buff, field) {
    return !!(skillFields[field] || (field === 'skill_level' && skillsByBuff[buff.name]) ||
        (buff.name === 'ColumbinaQ' && field === 'level') || constellationFields[field] || field === 'constellation')
}
export function groupCharacterBuffs(buffs, rules) {
    const groups = new Map()
    for (const buff of buffs.filter(b => b.genre === 'Character')) {
        const owner = rules[buff.name]?.character || 'Unmapped'
        if (!groups.has(owner)) groups.set(owner, { character: owner, buffs: [] })
        groups.get(owner).buffs.push(buff)
    }
    return [...groups.values()]
}
export function characterBuffProfile(character, uid, entries, presets) {
    const entry = entries.find(e => String(e.uid) === String(uid) && presets[e.presetName]?.item?.character?.name === character)
    const saved = entry && presets[entry.presetName]?.item.character
    return { constellation: saved?.constellation ?? 0,
        skill1: saved ? saved.skill1 + 1 : 10, skill2: saved ? saved.skill2 + 1 : 10, skill3: saved ? saved.skill3 + 1 : 10,
        imported: !!saved, source: entry?.key || '' }
}
export function buffAvailability(rule, profile) {
    if (!rule) return { allowed: true, label: '条件待核对' }
    const required = rule.minConstellation
    return { allowed: profile.constellation >= required, label: required ? (profile.constellation >= required ? `${required}命 · 已解锁` : `需要${required}命`) : '基础 / 条件效果' }
}
export function availableCharacterBuffs(buffs, rules, profile, selectedNames = []) {
    const selected = new Set(selectedNames)
    return buffs.filter(buff => !selected.has(buff.name) && buffAvailability(rules[buff.name], profile).allowed)
}
export function groupSelectedBuffs(entries, metadata, rules) {
    const groups = new Map(), other = []
    for (const entry of entries) {
        const character = metadata[entry.name]?.genre === 'Character' && rules[entry.name]?.character
        if (!character) { other.push(entry); continue }
        if (!groups.has(character)) groups.set(character, { character, buffs: [] })
        groups.get(character).buffs.push(entry)
    }
    return { characters: [...groups.values()], other }
}
export function bindBuffConfig(buff, profile, manual) {
    if (!buff.config.length) return 'NoConfig'
    const values = Object.fromEntries(buff.config.map(c => [c.name, c.default]))
    for (const c of buff.config) if (!isBoundBuffField(buff,c.name) && manual?.[buff.name]?.[c.name] !== undefined) values[c.name] = manual[buff.name][c.name]
    for (const c of buff.config) {
        const skill = skillFields[c.name] || (c.name === 'skill_level' ? skillsByBuff[buff.name] : null) || (buff.name === 'ColumbinaQ' && c.name === 'level' ? 'skill3' : null)
        if (skill) values[c.name] = Math.min(c.max ?? 15, Math.max(c.min ?? 1, profile[skill]))
        if (constellationFields[c.name]) values[c.name] = profile.constellation >= constellationFields[c.name]
        if (c.name === 'constellation') values[c.name] = profile.constellation
    }
    // This buff has a C6-dependent stack ceiling; never seed an invalid two-stack C0 buff.
    if (buff.name === 'AlyoshaHunterPrecision') values.stacks = Math.min(values.stacks, profile.constellation >= 6 ? 2 : 1)
    return { [buff.name]: values }
}
