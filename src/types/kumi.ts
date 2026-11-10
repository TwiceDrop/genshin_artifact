import type {CharacterName} from "./character"

type ArtifactItem = number | null

export interface KumiItem {
    id: number,
    title: string,
    sourceCharacter?: CharacterName,
    dir: boolean,
    children?: number[],
    artifactIds?: [ArtifactItem, ArtifactItem, ArtifactItem, ArtifactItem, ArtifactItem]
}