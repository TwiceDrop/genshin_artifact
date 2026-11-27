import type { IBuff, IDslGeneratorState } from './preset'

export type DslNamedBuff = Pick<IBuff, 'name' | 'config'>
export interface DslLibraryDocument {
    name: string
    description?: string
    character: string
    source: string
    generator: IDslGeneratorState | null
    weapon: string | null
}

export interface DslLibraryEntry extends DslLibraryDocument {
    id: string
    distribution?: { service: string; revision: number }
}
