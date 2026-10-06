import {artifactEff, artifactTags} from "@/constants/artifact"
// @ts-ignore
import objectHash from "object-hash"
import {artifactsData} from "@/assets/artifacts"
import { toSnakeCase, deepCopy } from "@/utils/common"
import { wasmGetArtifactsRankByCharacter } from "@/wasm"
import {convertArtifact, convertArtifactStatNameBack} from "@/utils/converter"
import type {
    ArtifactPosition,
    ArtifactSetName, ArtifactStatName,
    ArtifactSubStatName,
    IArtifact,
    IArtifactContentOnly
} from "@/types/artifact"
import { useArtifactStore } from "@/store/pinia/artifact"
import { hash, hashExceptValue } from "@/utils/artifactHash"
import { positions } from "@/constants/artifact"
import {useI18n} from "@/i18n/i18n";
import {useKumiStore} from "@/store/pinia/kumi";
import { convertGoodArtifacts } from '@/import/good'


const artifactStore = useArtifactStore()

// count min and max upgrade count
export function howManyUpgradeCount(value: number, tagName: ArtifactStatName, star: number): [number, number] {
    const eff = (artifactEff as any)[star][tagName]
    const min = Math.round(value / eff[3])
    const max = Math.round(value / eff[0])

    return [min, max];
}


// create new default artifact config
export function newDefaultArtifactConfigForWasm(): any {
    let configs: any = {}

    for (let name in artifactsData) {
        const data = artifactsData[name]
        const name2 = data.name2
        const config4 = data.config4 ?? []
        const config2 = data.config2 ?? []
        const configAll = config2.concat(config4)
        if (configAll.length > 0) {
            let c: any = {}
            for (let item of configAll) {
                c[item.name] = deepCopy(item.default)
            }

            const snake = toSnakeCase(name2)
            const configName = "config_" + snake
            configs[configName] = c
        }
    }

    return configs
}

// toggle artifact omit/not omit
export function toggleArtifact(id: number) {
    artifactStore.toggleArtifact(id)
}

// remove artifact
export function removeArtifact(id: number) {
    artifactStore.removeArtifact(id)
}

// get artifact item
export function getArtifact(id: number): IArtifact | undefined {
    return artifactStore.artifacts.value.get(id)
}

// get image url
export function getArtifactImage(setName: ArtifactSetName, position: ArtifactPosition): string {
    const data = artifactsData[setName]
    if (data[position]) {
        return data[position].url
    }
    throw new Error("artifact can't exist")
}

export function getArtifactImageByArtifact(artifact: IArtifactContentOnly): string {
    return getArtifactImage(artifact.setName, artifact.position)
}

export function updateArtifact(id: number, newArtifact: IArtifactContentOnly): void {
    artifactStore.updateArtifact(id, newArtifact)
}

export function newArtifact(artifact: IArtifactContentOnly, omit: boolean = false): number {
    return artifactStore.addArtifact(artifact, omit)
}


interface ImportJsonResult {
    skip: number,
    upgrade: number,
    remove: number,
    add: number,
}

export function importMonaJson(rawObj: any, removeNonExisting: boolean, backupImportDir: boolean): ImportJsonResult {
    if (rawObj?.format === 'GOOD') rawObj = convertGoodArtifacts(rawObj)
    for (const position of positions) {
        if (rawObj?.[position] !== undefined && !Array.isArray(rawObj[position])) throw new Error(`圣遗物部位 ${position} 必须是数组`)
    }
    const importFlat = positions.flatMap(position => rawObj?.[position] ?? [])
    if (importFlat.length === 0) throw new Error('文件中没有可导入的圣遗物')
    const matchesInitialSubstats = (previous: IArtifact, next: IArtifactContentOnly) =>
        previous.level < 4 && previous.normalTags.length === 3 &&
        previous.setName === next.setName && previous.position === next.position &&
        previous.star === next.star && previous.mainTag.name === next.mainTag.name &&
        next.level >= previous.level && previous.normalTags.every(oldTag =>
            next.normalTags.some(tag => tag.name === oldTag.name && tag.value.toFixed(5) === oldTag.value.toFixed(5)))
    const fourthStatUpgrades = importFlat.map(next => {
        if (next.level < 4 || next.normalTags.length !== 4) return undefined
        const matches = [...artifactStore.artifacts.value.values()].filter(previous => matchesInitialSubstats(previous, next))
        if (matches.length !== 1) return undefined
        const previous = matches[0]
        return importFlat.filter(item => matchesInitialSubstats(previous, item)).length === 1 ? previous : undefined
    })
    // hash of level, main stat, sub stats, rarity, set name, slot
    let hashAll: Record<string, IArtifact> = {}
    // hash of level, main stat without value, sub stats without value, rarity, set name, slot
    let hashEV: Record<string, IArtifact> = {}
    let existingIds = new Set()

    let equips: Map<string, (number | null)[]> = new Map()

    for (let artifact of artifactStore.artifacts.value.values()) {
        const h = hash(artifact)
        const hev = hashExceptValue(artifact)

        hashAll[h] = artifact
        hashEV[hev] = artifact
    }

    let skipCount = 0
    let upgradeCount = 0
    let newCount = 0

    for (const [index, artifact] of importFlat.entries()) {
        const h = hash(artifact)
        const hev = hashExceptValue(artifact)
        let artifactId = 0
        const upgraded = hashEV[hev] && artifact.level > hashEV[hev].level ? hashEV[hev] : fourthStatUpgrades[index]

        if (hashAll[h]) {
            // this artifacts exists
            const id = hashAll[h].id
            skipCount += 1
            existingIds.add(id)
            artifactId = id
        } else if (upgraded) {
            const id = upgraded.id
            const content = { ...artifact, omit: upgraded.omit }
            updateArtifact(id, content)
            upgradeCount += 1
            existingIds.add(id)
            artifactId = id
        } else {
            // new artifact
            newCount += 1
            artifactId = newArtifact(artifact, !!artifact.omit)
        }

        if (artifact.equip && artifact.equip !== "") {
            // artifact has equip data
            const equipCharacter = artifact.equip
            let arr = equips.get(equipCharacter)
            if (arr === undefined) {
                arr = [null, null, null, null, null]
                equips.set(equipCharacter, arr)
            }
            arr[positionToIndex(artifact.position)] = artifactId
        }
    }

    let removeCount = 0
    if (removeNonExisting) {
        for (let originalArtifacts of Object.values(hashAll)) {
            const id = originalArtifacts.id
            if (!existingIds.has(id)) {
                removeCount += 1
                console.log("remove", originalArtifacts)
                removeArtifact(id)
            }
        }
    }

    console.log(`import result: skip${skipCount}, upgrade${upgradeCount}, new${newCount}, remove${removeCount}`)

    // add new artifacts groups to store
    const kumiStore = useKumiStore()
    if(kumiStore.itemById(1)?.dir)
    {
        if(backupImportDir) kumiStore.backupImportDir()
        else kumiStore.clearDir(1)
        for (const equipName of equips.keys()) {
           const artifacts = equips.get(equipName)
           if (artifacts !== undefined) {
               kumiStore.addKumi(1, equipName, artifacts)
           }
        }   
    }

    return {
        skip: skipCount,
        upgrade: upgradeCount,
        add: newCount,
        remove: removeCount
    }
}

export function getArtifactThumbnail(name: ArtifactSetName): string {
    let data = artifactsData[name]
    if (!data) {
        console.log(name)
    }

    for (let position of positions) {
        if (Object.prototype.hasOwnProperty.call(data, position)) {
            return data[position].url
        }
    }

    throw new Error("artifact with no artifact")
}

// as artifact set number will increase, old config is not enough
// this function automatically upgrade old config to new config
// if new config key also exists in old config, use old value
// otherwise, use default value
export function upgradeArtifactConfig(oldConfig: any) {
    if (!oldConfig) {
        return newDefaultArtifactConfigForWasm()
    }

    let newConfig: any = {}

    for (let name in artifactsData) {
        const data = artifactsData[name]
        const name2 = data.name2
        const snake = toSnakeCase(name2)
        const configName = "config_" + snake

        if (Object.prototype.hasOwnProperty.call(oldConfig, configName)) {
            newConfig[configName] = deepCopy(oldConfig[configName])
        } else {
            const config4 = data.config4 ?? []
            if (config4.length > 0) {
                let c: any = {}
                for (let item of config4) {
                    c[item.name] = item.default
                }

                newConfig[configName] = c
            }
        }
    }

    return newConfig
}

// get all artifacts(including omitted) using wasm format
export function getArtifactsWasm() {
    // const allFlat = store.getters["artifacts/allFlat"]

    let results: any[] = []
    for (let a of artifactStore.artifacts.value.values()) {
        results.push(convertArtifact(a))
    }
    return results
}

export function isArtifactExists(artifact: IArtifactContentOnly): boolean {
    const h = hash(artifact)
    return artifactStore.isHashExists(h)
}

/**
 * attackPercentage, 0.2 => "攻击力+20%"
 * attackStatic, 20 => "攻击力+20"
 */
export function displayedTag(name: ArtifactStatName, value: number) {
    const { t } = useI18n()

    let tagData = artifactTags[name];
    if (!tagData) {
        console.log(name)
        throw "tag name not exist";
    }

    let left = "";
    switch (name) {
        case "attackPercentage":
        case "attackStatic":
            // left = "攻击力";
            left = t("stat.attackStatic")
            break;
        case "lifePercentage":
        case "lifeStatic":
            // left = "生命值";
            left = t("stat.lifeStatic")
            break;
        case "defendPercentage":
        case "defendStatic":
            // left = "防御力";
            left = t("stat.defendStatic")
            break;
        default:
            // left = tagData.chs;
            left = t("stat", name)
            break;
    }

    if (tagData.percentage) {
        let s = (value * 100).toFixed(1);
        return left + "+" + s + "%";
    } else {
        return left + "+" + value;
    }
}

export function positionToIndex(p: ArtifactPosition): number {
    switch (p) {
        case "flower": return 0
        case "feather": return 1
        case "sand": return 2
        case "cup": return 3
        case "head": return 4
    }
}

export function defaultArtifactSortFunction(a: IArtifact, b: IArtifact): number {
    if (a.level !== b.level) {
        return b.level - a.level
    } else if (a.star !== b.star) {
        return b.star - a.star
    } else {
        return a.setName.localeCompare(b.setName)
    }
}

export function statName2Locale(name: ArtifactStatName): string {
    let data = artifactTags[name]
    if (!data) {
        const name2 = convertArtifactStatNameBack(name as any)
        data = artifactTags[name2]
    }

    if (!data) {
        throw new Error("cannot find name " + name)
    }

    const { t } = useI18n()

    // return data.chs
    return t("stat", data.name)
}

export function getArtifactAllConfigs(item: any): any {
    const config2 = item.config2 ?? []
    const config4 = item.config4 ?? []
    return config2.concat(config4)
}

/// Get artifacts configs (config2/config4) for current artifact name
export function getArtifactAllConfigsByName(name: ArtifactSetName): any {
    return getArtifactAllConfigs(artifactsData[name])
}

/// merge configs into a legit config
/// note: there may be circumstances where a merging config is not complete (e.g. lacking some config2 fields)
export function mergeArtifactConfig(config: any): any {
    const defaultConfig = newDefaultArtifactConfigForWasm()
    for (const key in config) {
        if (key in defaultConfig) {
            for (const configKey in config[key]) {
                if (configKey in defaultConfig[key]) {
                    defaultConfig[key][configKey] = deepCopy(config[key][configKey])
                }
            }
        }
    }
    console.log(defaultConfig)
    return defaultConfig
}
