import mainStats from './data/good-main-stat.json'
import { artifactsData } from '@/assets/artifacts'
import { characterData } from '@/assets/character'
import { mainStatMap } from '@/constants/artifact'
import { convertArtifactNameBack } from '@/utils/converter'
import { useI18n } from '@/i18n/i18n'

const slots: Record<string, string> = { flower: 'flower', plume: 'feather', sands: 'sand', goblet: 'cup', circlet: 'head' }
const stats: Record<string, string> = {
    hp: 'lifeStatic', hp_: 'lifePercentage', atk: 'attackStatic', atk_: 'attackPercentage',
    def: 'defendStatic', def_: 'defendPercentage', eleMas: 'elementalMastery',
    enerRech_: 'recharge', critRate_: 'critical', critDMG_: 'criticalDamage', heal_: 'cureEffect',
    physical_dmg_: 'physicalBonus', pyro_dmg_: 'fireBonus', hydro_dmg_: 'waterBonus',
    cryo_dmg_: 'iceBonus', electro_dmg_: 'thunderBonus', anemo_dmg_: 'windBonus',
    geo_dmg_: 'rockBonus', dendro_dmg_: 'dendroBonus'
}
// Standard GOOD keys for sets whose Mona/WASM names differ.
const sets: Record<string, string> = {
    NightOfTheSkysUnveiling: 'RealmMirrorNight',
    SilkenMoonsSerenade: 'SpinMoonSerenade',
    CelestialGift: 'HeavensGift'
}
const locations: Record<string, string> = { Traveler: '旅行者', Manekin: '奇偶·男性', Manekina: '奇偶·女性' }

export function convertGoodArtifacts(raw: any): any {
    if (![1, 2, 3].includes(raw.version)) throw new Error(`不支持 GOOD 版本：${raw.version}`)
    if (!Array.isArray(raw.artifacts)) throw new Error('GOOD 文件未包含圣遗物数组 artifacts')
    const result: any = { flower: [], feather: [], sand: [], cup: [], head: [] }
    const { ta } = useI18n()
    raw.artifacts.forEach((a: any, index: number) => {
        const label = `GOOD 第 ${index + 1} 件圣遗物`
        const setName = sets[a.setKey] || convertArtifactNameBack(a.setKey)
        if (!artifactsData[setName]) throw new Error(`${label}：未知套装 ${a.setKey}`)
        const position = slots[a.slotKey], name = stats[a.mainStatKey]
        if (!position || !(mainStatMap as any)[position].includes(name)) throw new Error(`${label}：部位或主词条无法识别 ${a.slotKey} / ${a.mainStatKey}`)
        const value = (mainStats as any)[a.rarity]?.[a.mainStatKey]?.[a.level]
        if (!Number.isInteger(a.rarity) || !Number.isInteger(a.level) || value === undefined) throw new Error(`${label}：不支持的星级或等级 ${a.rarity} / ${a.level}`)
        const normalTags = a.substats.map((s: any) => {
            const subName = stats[s.key]
            if (!['hp', 'hp_', 'atk', 'atk_', 'def', 'def_', 'eleMas', 'enerRech_', 'critRate_', 'critDMG_'].includes(s.key) || !Number.isFinite(s.value))
                throw new Error(`${label}：副词条无法识别 ${s.key}`)
            return { name: subName, value: s.key.endsWith('_') ? s.value / 100 : s.value }
        })
        let equip = a.location
        const character = characterData[a.location as keyof typeof characterData]
        if (character) equip = ta(character.nameLocale)
        else if (locations[equip]) equip = locations[equip]
        result[position].push({
            setName, position, star: a.rarity, level: a.level,
            mainTag: { name, value: a.mainStatKey.endsWith('_') ? value : Math.round(value) },
            normalTags, equip
        })
    })
    return result
}
