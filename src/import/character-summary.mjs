export const ELEMENT_NAMES = { Pyro: '火', Hydro: '水', Anemo: '风', Electro: '雷', Dendro: '草', Cryo: '冰', Geo: '岩' }
const ELEMENT_ALIAS = { Fire: 'Pyro', Water: 'Hydro', Wind: 'Anemo', Electric: 'Electro', Grass: 'Dendro', Ice: 'Cryo', Rock: 'Geo' }
const WEAPON_NAMES = { Sword: '单手剑', Claymore: '双手剑', Polearm: '长柄武器', Bow: '弓', Catalyst: '法器' }
const shownNumber = value => value !== undefined && value !== null && Number.isFinite(Number(value)) ? String(Number(value)) : '—'

export function fourPieceSet(gear, artifacts, locale) {
    const counts = new Map(), positions = new Set()
    for (const item of gear) {
        if (!item || positions.has(item.position)) continue
        positions.add(item.position)
        if (item.setName) counts.set(item.setName, (counts.get(item.setName) || 0) + 1)
    }
    const name = [...counts].find(([, count]) => count >= 4)?.[0]
    return name ? locale[artifacts[name]?.nameLocale] || name : '无'
}

export function characterSummary(entry, { preset, raw, characters, weapons, artifacts, locale, inventory }) {
    const character = preset?.character, weapon = preset?.weapon
    const meta = characters[character?.name] || Object.values(characters).find(c => locale[c.nameLocale] === entry.label)
    const element = meta?.element || ELEMENT_ALIAS[raw?.base?.element] || raw?.base?.element || ''
    const weaponMeta = weapons[weapon?.name]
    const label = meta ? locale[meta.nameLocale] : entry.label
    const talents = character ? [character.skill1, character.skill2, character.skill3].map(n => n === undefined ? '—' : shownNumber(Number(n) + 1))
        : [0, 1, 2].map(i => shownNumber(raw?.skills?.filter(s => Number(s.skill_type) === 1)[i]?.level))
    const gear = preset ? (preset.artifactIds || entry.artifactIds || []).map(id => inventory.get(id))
        : (raw?.relics || []).map(r => ({ position: r.pos, setName: r.set?.name || Object.keys(artifacts).find(k => ['flower', 'feather', 'sand', 'cup', 'head'].some(p => locale[artifacts[k][p]?.text] === r.name)) }))
    return {
        key: entry.key, uid: entry.uid, presetName: entry.presetName, label,
        splash: meta?.splash || meta?.avatar || raw?.base?.icon || '',
        element, elementLabel: ELEMENT_NAMES[element] || '未知元素', weaponType: WEAPON_NAMES[meta?.weapon] || '未知武器类型',
        constellation: shownNumber(character?.constellation ?? entry.constellation ?? raw?.base?.actived_constellation_num),
        talents: `天赋：${talents.join('、')}`,
        set: fourPieceSet(gear, artifacts, locale),
        weapon: `${locale[weaponMeta?.nameLocale] || raw?.weapon?.name || '未知武器'} 精炼${shownNumber(weapon?.refine ?? raw?.weapon?.affix_level)}阶 ${shownNumber(weapon?.level ?? raw?.weapon?.level)}级`,
        warning: entry.warning || (preset && entry.error?.startsWith('本次同步未返回该角色') ? entry.error : ''),
        error: (preset && entry.error?.startsWith('本次同步未返回该角色') ? '' : entry.error) || (!preset ? '计算预设已删除，请重新同步角色' : ''),
    }
}
