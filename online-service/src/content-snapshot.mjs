import roles from '../static/share-roles.json' with { type: 'json' }
import { invalid } from './errors.mjs'

const string = value => {
    if (typeof value !== 'string' || !value.trim()) throw invalid('分享内容缺少有效文本')
    return value
}
const number = value => {
    if (!Number.isFinite(value)) throw invalid('预设中的数值无效')
    return value
}
function list(value, project, max = Infinity) {
    if (!Array.isArray(value) || value.length > max) throw invalid('预设列表无效')
    return value.map(project)
}
function numericFields(value, keys) {
    return Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, number(value[key])]))
}
export const resistances = ['pyro','hydro','cryo','electro','anemo','geo','dendro','physical']
export const thresholds = ['minRecharge','minElementalMastery','minCritical','minCriticalDamage']
const positions = ['flower','feather','sand','cup','head']
function piece(item) {
    if (!positions.includes(item?.position)) throw invalid('圣遗物部位无效')
    return { position:item.position, set:string(item.set), level:number(item.level), main:string(item.main),
        subs:list(item.subs,string,4) }
}

// Rebuild the public snapshot on the server, including each nested equipment record.
// Client-side projection also keeps account and inventory data out of the POST body.
export function contentSnapshot(kind, input) {
    if (!input || !Object.hasOwn(roles,input.character)) throw invalid('分享角色无效')
    const base = { title:string(input.title), character:input.character }
    if (kind === 'dsl') return { ...base, source:string(input.source) }
    if (kind !== 'preset') throw invalid('分享类型无效')
    if (typeof input.includeEquipment !== 'boolean') throw invalid('请选择圣遗物附带状态')
    const { weapon, filters } = input
    if (!weapon || !filters) throw invalid('缺少武器或计算设置')
    const talents = list(input.talents,number,3)
    if (talents.length !== 3) throw invalid('缺少天赋等级')
    const result = { ...base, level:number(input.level), constellation:number(input.constellation), talents,
        weapon:{name:string(weapon.name),level:number(weapon.level),refine:number(weapon.refine)},
        target:string(input.target), enemy:numericFields(input.enemy,['level',...resistances.map(id=>id+'_res')]),
        limits:numericFields(input.limits,thresholds), sets:list(input.sets,string),
        filters:Object.fromEntries(['sand','cup','head'].map(key=>[key,list(filters[key],string)])),
        buffs:list(input.buffs,string), includeEquipment:input.includeEquipment }
    if (result.includeEquipment) {
        result.equipment = list(input.equipment,piece,5)
        if (new Set(result.equipment.map(p=>p.position)).size !== result.equipment.length) throw invalid('圣遗物部位重复')
    }
    return result
}
