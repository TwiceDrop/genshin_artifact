import {type ICharacter} from "@/types/character"
import {type ITargetFunction} from "@/types/targetFunction"
import {type IWeapon} from "@/types/weapon"
import type {ArtifactStatName} from "@/types/artifact"

export interface IBuff {
    name: string,
    config: any,
    lock: boolean,
    source_id?: string,
    source_character?: string,
    source_effect?: string,
}

export type IBuffWithID = IBuff & { id: number }

export type IBuffWasm = Omit<IBuff, "lock">

export interface IDslGeneratorState {
    character: string,
    entries: any[],
    states?: {
        name: string,
        buffs: Pick<IBuffWasm, 'name' | 'config'>[],
        character?: Record<string, unknown>,
        weapon?: Record<string, unknown>,
    }[],
}

export interface ITeamContextSource {
    presetName: string,
    sourceId: string,
    triggers: {
        eActive?: boolean,
        songActive?: boolean,
        a1Active?: boolean,
        a4Active?: boolean,
        c1Active?: boolean,
        c2Active?: boolean,
        vesnaRadiance?: boolean,
        vesnaTalentActive?: boolean,
        vesnaTalentCoverage?: number,
        signatureStacks?: number,
        signatureBoosted?: boolean,
        signatureOnField?: boolean,
        recipientOnField?: boolean,
        odetteRadianceMode?: number, odetteStacks?: number,
        odetteBlessing?: boolean, odetteSplendor?: boolean, odetteDouble?: boolean, odetteDream?: boolean,
        qiqiTalisman?: boolean, qiqiC6?: boolean, sandroneBlessing?: boolean, sandroneC1?: boolean,
    }
}

export interface IPreset {
    name: string,
    enemy?: {level: number, electro_res: number, pyro_res: number, hydro_res: number, cryo_res: number, geo_res: number, anemo_res: number, dendro_res: number, physical_res: number},
    infusion?: string,
    skill?: {index: number, config: any},
    singleConfig?: any,
    artifactIds?: number[],
    miyousheKey?: string,
    algorithm?: PresetAlgorithm,
    artifactConfig?: any,
    artifactEffectMode?: ArtifactEffectMode,
    constraint?: IConstraint,
    dslSource?: string,
    useDSL?: boolean,
    targetMode?: 'normal' | 'dsl' | 'generator',
    optimizationMode?: 'damage' | 'panel',
    panelSearch?: {metric:string, direction:'asc'|'desc', resultLimit:number, minArtifactLevel:number, bounds:PanelBounds},
    dslGenerator?: IDslGeneratorState,
    filter?: IPresetArtifactFilter,
    character: ICharacter,
    weapon: IWeapon,
    targetFunction: ITargetFunction,
    buffs?: IBuff[],
    teamContext?: ITeamContextSource[],
    teamContextStellarMode?: boolean,
}

export type ArtifactEffectMode = "custom" | "auto"

export type PresetAlgorithm = "AStar" | "Heuristic" | "Naive"

export type PanelBounds = Record<string, {min?: number, max?: number}>

export interface IConstraint {
    minHp?: number,
    minAttack?: number,
    minDefense?: number,
    panelMax?: Record<string, number>,
    minCritical: number,
    minCriticalDamage: number,
    minElementalMastery: number,
    minRecharge: number,
    setNames: string[]
}

export interface IPresetArtifactFilter {
    gobletMainStats: ArtifactStatName[],
    headMainStats: ArtifactStatName[],
    sandMainStats: ArtifactStatName[]
}
