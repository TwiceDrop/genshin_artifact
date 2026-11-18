export interface ICharacter {
    name: string,
    level: number,
    ascend: boolean,
    constellation: number,
    skill1: number,
    skill2: number,
    skill3: number,
    resonated_elements?: string[],
    params: any
}

export type CharacterName = string
