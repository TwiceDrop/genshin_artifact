import {type ICharacter} from "@/types/character"
import {type ITargetFunction} from "@/types/targetFunction"
import {type IWeapon} from "@/types/weapon"
import type {ArtifactStatName} from "@/types/artifact"

export interface IBuff {
    name: string,
    config: any,
    lock: boolean,
    source_id?: string,
    source_effect?: string,
}

export type IBuffWithID = IBuff & { id: number }

export type IBuffWasm = Omit<IBuff, "lock">

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
    }
}

export interface IPreset {
    name: string,
    artifactIds?: number[],
    miyousheKey?: string,
    algorithm?: PresetAlgorithm,
    artifactConfig?: any,
    artifactEffectMode?: ArtifactEffectMode,
    constraint?: IConstraint,
    dslSource?: string,
    useDSL?: boolean,
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

export interface IConstraint {
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
