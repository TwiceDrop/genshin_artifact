import { resolveActiveTalents } from './character-talents.mjs'
import { travelerName } from '../../beta-data/traveler-model.mjs'

export const ELEMENT_NAMES = { Pyro: '火', Hydro: '水', Anemo: '风', Electro: '雷', Dendro: '草', Cryo: '冰', Geo: '岩' }
const ELEMENT_ALIAS = { Fire: 'Pyro', Water: 'Hydro', Wind: 'Anemo', Electric: 'Electro', Grass: 'Dendro', Ice: 'Cryo', Rock: 'Geo' }
export const canonicalGameElement = element => ELEMENT_ALIAS[element] || element
const WEAPON_NAMES = { Sword: '单手剑', Claymore: '双手剑', Polearm: '长柄武器', Bow: '弓', Catalyst: '法器' }
const shownNumber = value => value !== undefined && value !== null && Number.isFinite(Number(value)) ? String(Number(value)) : '—'

export function isPickerCharacter(name, label) {
    return !name?.startsWith('Manekin') && !/^奇偶(?:$|\s*[·・])/.test(label || '')
}

export function equippedSetCounts(gear) {
    const counts = new Map(), positions = new Set()
    for (const item of gear) {
        if (!item || positions.has(item.position)) continue
        positions.add(item.position)
        if (item.setName) counts.set(item.setName, (counts.get(item.setName) || 0) + 1)
    }
    return counts
}

export function equippedSetEffects(gear, artifacts, translate) {
    const effects = []
    for (const [setName, count] of equippedSetCounts(gear)) {
        const set = artifacts[setName]
        for (const pieces of [1, 2, 4]) {
            const description = set?.['effect' + pieces]
            if (pieces <= count && description != null) {
                effects.push({ key: setName + pieces, name: translate(set.nameLocale), pieces, text: translate(description) })
            }
        }
    }
    return effects
}

export function fourPieceSet(gear, artifacts, locale) {
    const name = [...equippedSetCounts(gear)].find(([, count]) => count >= 4)?.[0]
    return name ? locale[artifacts[name]?.nameLocale] || name : '无'
}

function withFrozenGear(live, frozen = []) {
    const covered = new Set(live.filter(Boolean).map(item => item.position))
    return [...live, ...frozen.filter(item => !covered.has(item.position))]
}

export function rosterCharacterMeta(entry, preset, raw, characters, locale) {
    return characters[preset?.character.name] || characters[travelerName(Number(raw?.base?.id ?? entry.id), raw?.base?.element ?? entry.element)] || Object.values(characters).find(c => locale[c.nameLocale] === entry.label)
}

export function characterSummary(entry, { preset, raw, characters, weapons, artifacts, locale, inventory }) {
    const character = preset?.character, weapon = preset?.weapon
    const meta = rosterCharacterMeta(entry, preset, raw, characters, locale)
    const element = meta?.element || canonicalGameElement(raw?.base?.element) || ''
    const weaponMeta = weapons[weapon?.name]
    const label = meta ? locale[meta.nameLocale] : entry.label
    let talents = ['—', '—', '—'], talentError = ''
    if (character) talents = [character.skill1, character.skill2, character.skill3].map(n => n === undefined ? '—' : shownNumber(Number(n) + 1))
    else if (raw) {
        try { talents = resolveActiveTalents(raw.skills, meta, locale).map(skill => shownNumber(skill.level)) }
        catch (error) { talentError = error.message }
    }
    // Saved IDs that no longer resolve in the warehouse (restored or exported UID data) fall back to the entry's frozen in-game gear.
    const savedGear = !!preset || (!!entry.artifactIds && !!entry.equippedArtifacts)
    const gear = savedGear ? withFrozenGear((preset?.artifactIds || entry.artifactIds || []).map(id => inventory.get(id)), entry.equippedArtifacts)
        : (raw?.relics || []).map(r => ({ position: r.pos, setName: r.set?.name || Object.keys(artifacts).find(k => ['flower', 'feather', 'sand', 'cup', 'head'].some(p => locale[artifacts[k][p]?.text] === r.name)) }))
    return {
        key: entry.key, uid: entry.uid, presetName: entry.presetName, label,
        characterName: meta?.name, avatar: meta?.avatar || raw?.base?.icon,
        splash: meta?.splash || meta?.avatar || raw?.base?.icon || '',
        element, elementLabel: ELEMENT_NAMES[element] || '未知元素', weaponType: WEAPON_NAMES[meta?.weapon] || '未知武器类型',
        constellation: shownNumber(character?.constellation ?? entry.constellation ?? raw?.base?.actived_constellation_num),
        level: character?.level ?? entry.level ?? raw?.base?.level,
        talentLevels: talents,
        preset, raw, savedGear, equipped: savedGear ? gear.filter(Boolean) : entry.equippedArtifacts || [],
        talents: `天赋：${talents.join('、')}`,
        set: fourPieceSet(gear, artifacts, locale),
        weapon: `${locale[weaponMeta?.nameLocale] || raw?.weapon?.name || '未知武器'} 精炼${shownNumber(weapon?.refine ?? raw?.weapon?.affix_level)}阶 ${shownNumber(weapon?.level ?? raw?.weapon?.level)}级`,
        warning: entry.warning || (preset && entry.error?.startsWith('本次同步未返回该角色') ? entry.error : '') || (!entry.error ? talentError : ''),
        error: (preset && entry.error?.startsWith('本次同步未返回该角色') ? '' : entry.error) || (!preset ? '计算预设已删除，请重新同步角色' : ''),
    }
}
