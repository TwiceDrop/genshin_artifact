export const DAMAGE_REACTION_LABELS = Object.freeze({
    normal: '普通伤害 / 治疗',
    melt: '融化',
    vaporize: '蒸发',
    spread: '蔓激化',
    aggravate: '超激化',
    direct_moonelectro: '直接月感电',
    direct_moonbloom: '直接月绽放',
    direct_mooncrystallize: '直接月结晶',
    direct_stellarconduct: '直接星超导',
    direct_stellarswirl: '直接星扩散',
})

export const STELLAR_DAMAGE_REACTIONS = Object.freeze([
    'direct_stellarconduct', 'direct_stellarswirl',
])

export const ADDITIONAL_DAMAGE_REACTIONS = Object.freeze([
    'direct_moonbloom', 'direct_mooncrystallize',
    ...STELLAR_DAMAGE_REACTIONS,
])

export function damageReactionLabel(key) {
    return DAMAGE_REACTION_LABELS[key] || '其他伤害'
}

export function damageReactionOptions(analysis = {}, { includeUncalibrated = false } = {}) {
    const visible = new Set(visibleDamageReactionKeys(analysis))
    return Object.entries(analysis || {})
        .filter(([key, value]) => visible.has(key) && value && typeof value === 'object' && Number.isFinite(value.expectation)
            && (includeUncalibrated || analysis.reaction_availability?.[key]?.status !== 'uncalibrated'))
        .map(([key]) => ({ key, label: damageReactionLabel(key) }))
}

export function defaultDamageReaction(analysis = {}) {
    const options = damageReactionOptions(analysis)
    const positive = options.filter(({ key }) => analysis[key].expectation > 0)
    // A skill's direct stellar damage is distinct from its ordinary damage and reaction previews.
    for (const key of ['direct_stellarswirl', 'direct_stellarconduct', 'direct_moonelectro', 'direct_moonbloom', 'direct_mooncrystallize']) {
        if (positive.some(option => option.key === key)) return key
    }
    return positive[0]?.key || options[0]?.key || ''
}

export function stellarDamageResults(analysis = {}) {
    return damageReactionOptions(analysis, { includeUncalibrated: true })
        .filter(({ key }) => STELLAR_DAMAGE_REACTIONS.includes(key))
        .map(option => ({ ...option, ...analysis[option.key] }))
}


// Direct reaction skills are their own hit type. Native kernels also expose
// hypothetical reaction previews; those must not appear as this skill's hits.
export function visibleDamageReactionKeys(analysis = {}) {
    analysis ||= {}
    const finite = key => Number.isFinite(analysis[key]?.expectation)
    const direct = ['direct_stellarconduct', 'direct_stellarswirl', 'direct_moonelectro', 'direct_mooncrystallize', 'direct_moonbloom'].filter(finite)
    if (direct.length) return direct
    const keys = ['normal', 'melt', 'vaporize', 'spread', 'aggravate']
    return keys.filter(finite)
}
