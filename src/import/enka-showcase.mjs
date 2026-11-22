import { avatars, weaponNames, enkaArtifactSetName } from './enka-catalog.mjs'

const positions = { EQUIP_BRACER: 1, EQUIP_NECKLACE: 2, EQUIP_SHOES: 3, EQUIP_RING: 4, EQUIP_DRESS: 5 }
const properties = {
    HP: 2, HP_PERCENT: 3, ATTACK: 5, ATTACK_PERCENT: 6, DEFENSE: 8, DEFENSE_PERCENT: 9,
    CRITICAL: 20, CRITICAL_HURT: 22, CHARGE_EFFICIENCY: 23, HEAL_ADD: 26, ELEMENT_MASTERY: 28,
    PHYSICAL_ADD_HURT: 30, FIRE_ADD_HURT: 40, ELEC_ADD_HURT: 41, WATER_ADD_HURT: 42,
    GRASS_ADD_HURT: 43, WIND_ADD_HURT: 44, ROCK_ADD_HURT: 45, ICE_ADD_HURT: 46,
}
function property(id, value) {
    return { property_type: properties[id?.replace(/^FIGHT_PROP_/, '')], value }
}
function relic(item) {
    const flat = item.flat, main = flat.reliquaryMainstat
    return { id: item.itemId, pos: positions[flat.equipType], icon: flat.icon, set: { name: enkaArtifactSetName(flat.setId, flat.setNameTextMapHash) },
        rarity: flat.rankLevel, level: item.reliquary.level - 1, main_property: property(main?.mainPropId, main?.statValue),
        sub_property_list: (flat.reliquarySubstats || []).map(stat => property(stat.appendPropId, stat.statValue)) }
}

function showcaseCharacter(avatar, { characters, weapons, locale }) {
    const id = avatar.avatarId
    const traveler = id === 10000005 || id === 10000007
    const meta = avatars[traveler ? id + '-' + avatar.skillDepotId : id]
    const character = characters[meta?.name]
    if (!character) throw new Error('此展柜角色或元素尚未适配')
    const item = avatar.equipList?.find(e => e.weapon)
    if (!item) throw new Error('展柜未返回武器')
    const weapon = weapons[weaponNames[item.itemId]]
    const weaponName = weapon && locale[weapon.nameLocale]
    const skills = meta.skills.map((skill, index) => ({
        name: locale[character['skillName' + (index + 1)]], skill_type: 1,
        level: Number(avatar.skillLevelMap?.[skill]) + Number(avatar.proudSkillExtraLevelMap?.[meta.proud[index]] || 0),
    }))
    return {
        base: { id, name: locale[character.nameLocale], element: meta.element, level: avatar.propMap?.['4001']?.val,
            promote_level: Number(avatar.propMap?.['1002']?.val ?? 0), actived_constellation_num: avatar.talentIdList?.length ?? 0 },
        weapon: { id: item.itemId, name: weaponName, icon: item.flat?.icon, level: item.weapon.level,
            promote_level: item.weapon.promoteLevel ?? 0, affix_level: 1 + Number(Object.values(item.weapon.affixMap || {})[0] ?? 0) },
        skills, relics: avatar.equipList.filter(e => e.reliquary).map(relic),
    }
}

export function enkaSnapshot(uid, data, catalog) {
    if (!Array.isArray(data?.avatarInfoList) || !data.avatarInfoList.length) throw new Error('该 UID 没有公开角色详情，请在游戏角色展柜中开启「显示角色详情」')
    const characters = [], failures = []
    for (const avatar of data.avatarInfoList) {
        try { characters.push(showcaseCharacter(avatar, catalog)) }
        catch (error) { failures.push('角色 ' + avatar.avatarId + '：' + error.message) }
    }
    if (!characters.length) throw new Error(failures.join('；'))
    const role = { uid }
    if (!data.profileUnavailable && data.playerInfo?.nickname) role.nickname = data.playerInfo.nickname
    return { version: 1, source: 'enka', role, characters, failures, total: characters.length,
        importedAt: new Date().toISOString(), scope: 'showcase-equipped-artifacts' }
}
