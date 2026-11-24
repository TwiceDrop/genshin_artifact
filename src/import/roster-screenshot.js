import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
import { artifactTags, mainStatMap, subStats } from '@/constants/artifact'
import { avatars } from './enka-catalog.mjs'
import { snapshotRelic, snapshotWeapon } from './miyoushe.mjs'
import { comparePanelRolls } from '@/algorithms/roster-panel-rolls.mjs'
import { convertArtifact } from '@/utils/converter'
import { slotLabels } from './artifact-screenshot.mjs'

const identities = new Map(Object.entries(avatars).map(([key, avatar]) =>
    [avatar.name, {id:Number(key.split('-')[0]), element:avatar.element}]))
export const rosterChoices = Object.keys(characters).filter(name => identities.has(name))
export const promotionLevels = [20,40,50,60,70,80]
export const comparisonStats = {生命值:'hp', 攻击力:'atk', 防御力:'def', 元素精通:'elemental_mastery', 暴击率:'critical', 暴击伤害:'critical_damage', 元素充能效率:'recharge'}

function integer(value, min, max, label) {
    const n = Number(value)
    if (value === '' || value == null || !Number.isInteger(n) || n < min || n > max) throw new Error('请核对' + label)
    return n
}
function promoted(level, value, label) {
    if (promotionLevels.includes(level) && value !== 'yes' && value !== 'no') throw new Error('请核对' + label + '突破状态')
    return promotionLevels.includes(level) && value === 'yes'
}
export function reviewedRole({role:r, drafts}) {
    if (!/^\d{8,10}$/.test(r.uid)) throw new Error('请核对原神 UID')
    const meta = characters[r.character], identity = identities.get(r.character)
    if (!meta || !identity) throw new Error('请选择角色')
    if (!weapons[r.weapon] || weapons[r.weapon].type !== meta.weapon) throw new Error('请选择该角色的武器')
    const level = integer(r.level,1,100,'角色等级'), weaponLevel = integer(r.weaponLevel,1,90,'武器等级')
    const character = {name:r.character, level, ascend:promoted(level,r.ascend,'角色'), constellation:integer(r.constellation,0,6,'命座')}
    const weapon = {name:r.weapon, level:weaponLevel, ascend:promoted(weaponLevel,r.weaponAscend,'武器'), refine:integer(r.refine,1,5,'精炼')}
    const skills = r.talents.map((v,i)=>({level:integer(v,1,15,'天赋等级'),skill_type:1,name:locale[meta['skillName'+(i+1)]]}))
    const pieces = drafts.map((d,index)=>{
        const set = artifacts[d.setName]
        const slot = slotLabels[d.position] || ('第 ' + (index + 1) + ' 件圣遗物')
        const pieceName = locale[set?.[d.position]?.text]
        const piece = pieceName ? slot + '「' + pieceName + '」' : slot
        if (!set || !mainStatMap[d.position]) throw new Error('请核对' + piece + '的套装和部位')
        const star=integer(d.star,set.minStar,set.maxStar,'圣遗物星级')
        const seen = new Set()
        const convert = (t, label, allowed)=>{
            const stat = artifactTags[t.name]
            const field = '请核对' + piece + '的' + label
            if (!stat) throw new Error(field + '：缺少有效的词条名称')
            const named = field + '「' + stat.chs + '」'
            if (!allowed.includes(t.name)) throw new Error(named + '：词条类型不符')
            if (seen.has(t.name)) throw new Error(named + '：词条重复')
            seen.add(t.name)
            if (t.value == null || t.value === '') throw new Error(named + '：缺少数值')
            const value = Number(t.value)
            if (!Number.isFinite(value) || value <= 0) throw new Error(named + '：数值无效')
            return {name:t.name,value:value/(stat.percentage?100:1)}
        }
        return {setName:d.setName,position:d.position,star,level:integer(d.level,0,[0,4,4,12,16,20][star],'圣遗物等级'),
            mainTag:convert(d.mainTag,'主词条',mainStatMap[d.position]),
            normalTags:d.normalTags.map((t,i)=>convert(t,'第 ' + (t.row ?? (i+1)) + ' 条副词条',subStats))}
    })
    if (new Set(pieces.map(p=>p.position)).size !== pieces.length) throw new Error('圣遗物部位重复')
    const raw = {base:{...identity,name:locale[meta.nameLocale],level, promote_level:promotionLevels.filter(n=>n<level || (n===level && character.ascend)).length,
        actived_constellation_num:character.constellation},weapon:snapshotWeapon(weapon,locale[weapons[r.weapon].nameLocale]), skills,
        relics:pieces.map(p=>snapshotRelic(p,locale[artifacts[p.setName].nameLocale]))}
    return {uid:r.uid,raw,character,weapon,pieces}
}
export function compareRolePanel(review, measured) {
    const entries = Object.entries(comparisonStats)
    const targets = Object.fromEntries(entries.map(([label,key]) => [key, measured[label]]))
    const panel = comparePanelRolls({character:review.character, weapon:review.weapon, artifacts:review.pieces.map(convertArtifact)}, targets)
    return Object.fromEntries(entries.map(([label,key]) => [label, panel[key]]))
}
