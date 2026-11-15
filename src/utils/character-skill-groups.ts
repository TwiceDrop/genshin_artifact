// 角色技能按普攻、战技、爆发分组，供技能下拉框和计算器伤害卡的技能列表共用。
export interface SkillGroup {
    title: string
    items: { index: number, label: string }[]
}

interface CharacterSkillData {
    skillName1: number, skillName2: number, skillName3: number
    skillMap1: { index: number, text: number }[]
    skillMap2: { index: number, text: number }[]
    skillMap3: { index: number, text: number }[]
}

export function characterSkillGroups(data: CharacterSkillData, ta: (index: number) => string): SkillGroup[] {
    const groups: [number, { index: number, text: number }[]][] = [
        [data.skillName1, data.skillMap1],
        [data.skillName2, data.skillMap2],
        [data.skillName3, data.skillMap3],
    ]
    return groups
        .filter(([, skills]) => skills.length > 0)
        .map(([name, skills]) => ({
            title: ta(name),
            items: skills.map(skill => ({ index: skill.index, label: ta(skill.text) })),
        }))
}
