// Match the three levelled combat talents to catalog names, independently of
// API ordering and extra active skills such as alternate sprint.
export function normalizeTalentName(value) {
    if (typeof value !== 'string') return ''
    return value.normalize('NFKC').trim()
        .replace(/^普通攻击\s*[·•・‧∙:：\-—]\s*/u, '')
        .replace(/^normal\s+attack\s*[:：·•・\-—]\s*/i, '')
        .replace(/[•・‧∙]/gu, '·')
        .replace(/\s+/gu, '')
        .toLowerCase()
}

export function resolveActiveTalents(skills, character, locale) {
    if (!Array.isArray(skills)) throw new Error('无法确定三个主动天赋的对应关系：技能列表缺失')
    const names = [1, 2, 3].map(i => locale?.[character?.[`skillName${i}`]])
    const keys = names.map(normalizeTalentName)
    if (keys.some(key => !key) || new Set(keys).size !== 3) {
        throw new Error('无法确定三个主动天赋的对应关系：角色目录的天赋名称缺失或重复')
    }
    const active = skills.filter(skill => skill && Number(skill.skill_type) === 1)
    const matches = keys.map(key => active.filter(skill => normalizeTalentName(skill.name) === key))
    const problems = matches.flatMap((rows, i) => rows.length === 1 ? [] : [`${rows.length ? '重复匹配' : '缺少'}「${names[i]}」`])
    if (problems.length) throw new Error('无法确定三个主动天赋的对应关系：' + problems.join('；'))
    return matches.map((rows, i) => {
        const skill = rows[0], level = Number(skill.level)
        if (!Number.isInteger(level) || level < 1 || level > 15) {
            throw new Error(`主动天赋「${names[i]}」等级超出支持范围`)
        }
        return skill
    })
}
