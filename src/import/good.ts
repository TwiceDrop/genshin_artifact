import mainStats from './data/good-main-stat.json'
import { goodArtifactSlots, goodArtifactStats } from './data/good-artifact-keys.mjs'
import { artifactsData } from '@/assets/artifacts'
import { characterData } from '@/assets/character'
import { mainStatMap } from '@/constants/artifact'
import { convertArtifactName, convertArtifactNameBack } from '@/utils/converter'
import { useI18n } from '@/i18n/i18n'
import type { ArtifactPosition, ArtifactStatName, IArtifact, IArtifactContentOnly, IArtifactTag } from '@/types/artifact'

const slots = goodArtifactSlots as Record<string, ArtifactPosition>
const stats = goodArtifactStats as Record<string, ArtifactStatName>
const slotKeys = Object.fromEntries(Object.entries(slots).map(([key, position]) => [position, key]))
const statKeys = Object.fromEntries(Object.entries(stats).map(([key, name]) => [name, key]))

// Standard GOOD keys for sets whose Mona/WASM names differ.
const sets: Record<string, string> = {
    NightOfTheSkysUnveiling: 'RealmMirrorNight',
    SilkenMoonsSerenade: 'SpinMoonSerenade',
    CelestialGift: 'HeavensGift'
}
const setKeys = new Map(Object.entries(sets).map(([key, name]) => [name, key]))
const locations: Record<string, string> = { Traveler: '旅行者', Manekin: '奇偶·男性', Manekina: '奇偶·女性' }

class GoodArtifactError extends Error {}

function convertGoodArtifact(a: any, label: string, ta: ReturnType<typeof useI18n>['ta']): IArtifactContentOnly & { equip?: string } {
    const setKey = a?.setKey
    const setName = Object.prototype.hasOwnProperty.call(sets, setKey) ? sets[setKey] : convertArtifactNameBack(setKey)
    if (!Object.prototype.hasOwnProperty.call(artifactsData, setName))
        throw new GoodArtifactError(`${label}：未知套装 ${setKey}`)
    const position = slots[a.slotKey], name = stats[a.mainStatKey]
    if (!Object.prototype.hasOwnProperty.call(mainStatMap, position) || !mainStatMap[position].some(stat => stat === name))
        throw new GoodArtifactError(`${label}：部位或主词条无法识别 ${a.slotKey} / ${a.mainStatKey}`)
    const value = (mainStats as any)[a.rarity]?.[a.mainStatKey]?.[a.level]
    if (!Number.isInteger(a.rarity) || !Number.isInteger(a.level) || value === undefined)
        throw new GoodArtifactError(`${label}：不支持的星级或等级 ${a.rarity} / ${a.level}`)
    const convertSubstat = (s: any) => {
        const key = s?.key
        if (!['hp', 'hp_', 'atk', 'atk_', 'def', 'def_', 'eleMas', 'enerRech_', 'critRate_', 'critDMG_'].includes(key) || !Number.isFinite(s.value))
            throw new GoodArtifactError(`${label}：副词条无法识别 ${key}`)
        return { name: stats[key], value: key.endsWith('_') ? s.value / 100 : s.value }
    }
    if (!Array.isArray(a.substats)) throw new GoodArtifactError(`${label}：副词条无法识别 substats`)
    const normalTags = a.substats.map(convertSubstat)
    let unactivatedTags: IArtifactContentOnly['normalTags'] = []
    if (a.level === 0 && normalTags.length === 3 && a.unactivatedSubstats?.length === 1) {
        if (!Array.isArray(a.unactivatedSubstats)) throw new GoodArtifactError(`${label}：副词条无法识别 unactivatedSubstats`)
        unactivatedTags = a.unactivatedSubstats.map(convertSubstat)
    }
    let equip = a.location
    const character = characterData[a.location as keyof typeof characterData]
    if (character) equip = ta(character.nameLocale)
    else if (locations[equip]) equip = locations[equip]
    return {
        setName, position, star: a.rarity, level: a.level,
        mainTag: { name, value: a.mainStatKey.endsWith('_') ? value : Math.round(value) },
        normalTags, unactivatedTags, equip
    }
}

export function convertGoodArtifacts(raw: any, failures?: string[]) {
    if (![1, 2, 3].includes(raw.version)) throw new Error(`不支持 GOOD 版本：${raw.version}`)
    if (!Array.isArray(raw.artifacts)) throw new Error('GOOD 文件未包含圣遗物数组 artifacts')
    const result: Record<ArtifactPosition, ReturnType<typeof convertGoodArtifact>[]> = { flower: [], feather: [], sand: [], cup: [], head: [] }
    const { ta } = useI18n()
    raw.artifacts.forEach((a: any, index: number) => {
        const label = `GOOD 第 ${index + 1} 件圣遗物`
        try {
            const artifact = convertGoodArtifact(a, label, ta)
            result[artifact.position].push(artifact)
        } catch (error) {
            if (!failures || !(error instanceof GoodArtifactError)) throw error
            failures.push(error.message)
        }
    })
    return result
}

export function convertGoodWarehouse(raw: any) {
    const failures: string[] = []
    const artifacts = convertGoodArtifacts(raw, failures)
    if (Object.values(artifacts).every(group => group.length === 0)) {
        if (failures.length) throw new AggregateError(failures, failures[0])
        throw new Error('文件中没有可导入的圣遗物')
    }
    return { artifacts, failures }
}

function exportGoodSubstat(stat: IArtifactTag) {
    const key = statKeys[stat.name]
    return { key, value: key.endsWith('_') ? stat.value * 100 : stat.value }
}

export function exportGoodWarehouse(artifacts: readonly IArtifact[]) {
    return {
        format: 'GOOD',
        version: 3,
        source: 'MonaArtifact',
        artifacts: artifacts.map(item => ({
            setKey: setKeys.get(item.setName) ?? convertArtifactName(item.setName),
            slotKey: slotKeys[item.position],
            level: item.level,
            rarity: item.star,
            mainStatKey: statKeys[item.mainTag.name],
            location: '',
            lock: Boolean(item.omit),
            substats: item.normalTags.map(exportGoodSubstat),
            ...(item.unactivatedTags?.length ? { unactivatedSubstats: item.unactivatedTags.map(exportGoodSubstat) } : {}),
        })),
    }
}
