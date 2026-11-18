// Takes the flat ExcelBinOutput tables and TextMap_MediumCHS.json from AnimeGameData
// a311cd77d7dafbd2bedc7d3cac4e986c6125b586. Only export items offered by this app.
import fs from 'node:fs'
import path from 'node:path'
import characters from '../src/assets/_gen_character.js'
import weapons from '../src/assets/_gen_weapon.js'
import sets from '../src/assets/_gen_artifact.js'

const read = name => JSON.parse(fs.readFileSync(path.join(process.argv[2], name + '.json'), 'utf8'))
const table = name => read(name + 'ExcelConfigData')
const names = read('TextMap_MediumCHS')
const locale = JSON.parse(fs.readFileSync(new URL('../src/i18n/generated/zh-cn.json', import.meta.url)))
const avatars = table('Avatar')
const gear = table('Weapon')
const setRows = table('ReliquarySet')
const affixes = table('EquipAffix')
const talents = table('ProudSkill')
const constellations = table('AvatarTalent')
const depots = table('AvatarSkillDepot')
const characterPromotions = table('AvatarPromote')
const weaponPromotions = table('WeaponPromote')
const curves = {}
const units = {}
const arms = {}
const bonuses = {}
const props = row => Object.fromEntries(row.addProps.filter(p => p.value).map(p => [p.propType, p.value]))

function promotions(rows, field, id) {
    const stages = rows.filter(row => row[field] === id).sort((a, b) => (a.promoteLevel || 0) - (b.promoteLevel || 0))
    return Object.fromEntries(stages[0].addProps.map(p => p.propType).filter(Boolean).map(key =>
        [key, stages.map(stage => props(stage)[key] || 0)]).filter(([, values]) => values.some(Boolean)))
}

const curveRows = [...table('AvatarCurve'), ...table('WeaponCurve')]
for (const row of curveRows) {
    for (const curve of row.curveInfos) {
        (curves[curve.type] ??= [])[row.level - 1] = curve.value
    }
}

for (const [key, meta] of Object.entries(characters)) {
    const id = key.startsWith('Aether') ? 10000005 : key.startsWith('Lumine') ? 10000007 :
        key.startsWith('Manekina') ? 10000118 : undefined
    const avatar = id ? avatars.find(row => row.id === id) :
        avatars.find(row => names[row.nameTextMapHash] === locale[meta.nameLocale])
    const base = {FIGHT_PROP_BASE_HP: avatar.hpBase, FIGHT_PROP_BASE_ATTACK: avatar.attackBase, FIGHT_PROP_BASE_DEFENSE: avatar.defenseBase}
    const growth = Object.fromEntries(avatar.propGrowCurves.filter(p => p.type in base)
        .map(p => [p.type, [base[p.type], p.growCurve]]))
    const fixed = []
    // The two Traveler wind depots share C2's direct ER stat. Other Traveler
    // depots currently have no direct talent or constellation properties.
    const depotId = key === 'AetherAnemo' ? 504 : key === 'LumineAnemo' ? 704 : avatar.skillDepotId
    const depot = depots.find(row => row.id === depotId)
    for (const unlock of depot.inherentProudSkillOpens) {
        const talent = talents.find(row => row.proudSkillGroupId === unlock.proudSkillGroupId && row.level === 1)
        if (talent && Object.keys(props(talent)).length)
            fixed.push({ascension: unlock.needAvatarPromoteLevel || 0, stats: props(talent)})
    }
    depot.talents.forEach((id, i) => {
        const talent = constellations.find(row => row.talentId === id)
        if (talent && Object.keys(props(talent)).length) fixed.push({constellation: i + 1, stats: props(talent)})
    })
    units[key] = {growth, promotion: promotions(characterPromotions, 'avatarPromoteId', avatar.avatarPromoteId), fixed}
}

for (const [key, meta] of Object.entries(weapons)) {
    const weapon = gear.find(row => names[row.nameTextMapHash] === locale[meta.nameLocale]) ??
        gear.find(row => row.icon === 'UI_EquipIcon_' + meta.internalName)
    const growth = Object.fromEntries(weapon.weaponProp.filter(p => p.propType && p.initValue)
        .map(p => [p.propType, [p.initValue, p.type]]))
    const passive = affixes.filter(row => weapon.skillAffix.includes(row.id) && Object.keys(props(row)).length)
        .sort((a, b) => (a.level || 0) - (b.level || 0)).map(props)
    const maxLevel = Math.max(...weaponPromotions.filter(p => p.weaponPromoteId === weapon.weaponPromoteId).map(p => p.unlockMaxLevel))
    arms[key] = {growth, promotion: promotions(weaponPromotions, 'weaponPromoteId', weapon.weaponPromoteId), maxLevel, passive}
}

for (const meta of Object.values(sets)) {
    const label = locale[meta.nameLocale]
    const set = setRows.find(s => affixes.some(a => a.id === s.equipAffixId && names[a.nameTextMapHash] === label))
    bonuses[meta.name2] = set.setNeedNum.flatMap((pieces, i) => {
        const row = affixes.find(a => a.id === set.equipAffixId && (a.level || 0) === i)
        return Object.keys(props(row)).length ? [{pieces, label: label + pieces, stats: props(row)}] : []
    })
}

const usedCurves = new Set([...Object.values(units), ...Object.values(arms)].flatMap(item =>
    Object.values(item.growth).map(([, curve]) => curve)))
const data = {curves: Object.fromEntries([...usedCurves].map(key => [key, curves[key]])), characters: units, weapons: arms, sets: bonuses}
// One indexed entry per line keeps catalog changes reviewable.
const sections = Object.entries(data).map(([key, entries]) =>
    JSON.stringify(key) + ': {\n' + Object.entries(entries).map(([name, row]) =>
        '  ' + JSON.stringify(name) + ': ' + JSON.stringify(row)).join(',\n') + '\n}')
fs.writeFileSync(new URL('../beta-data/roster-attributes.mjs', import.meta.url),
    '// Generated by beta-tools/extract-roster-attributes.mjs\nexport default {\n' + sections.join(',\n') + '\n}\n')
