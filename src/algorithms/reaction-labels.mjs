export const DAMAGE_REACTION_LABELS = Object.freeze({
    normal: '普通伤害 / 治疗',
    melt: '融化',
    vaporize: '蒸发',
    spread: '蔓激化',
    aggravate: '超激化',
    moonfall: '月绽放',
    moonelectro: '月感电',
    mooncrystallize: '月结晶',
    direct_moonelectro: '直接月感电',
    direct_moonbloom: '直接月绽放',
    direct_mooncrystallize: '直接月结晶',
    stellarconduct: '反应星超导',
    stellarswirl_anemo: '反应星扩散·风',
    stellarswirl_cryo: '反应星扩散·冰',
    direct_stellarconduct: '直接星超导',
    direct_stellarswirl: '直接星扩散',
})

export const STELLAR_DAMAGE_REACTIONS = Object.freeze([
    'stellarconduct', 'stellarswirl_anemo', 'stellarswirl_cryo',
    'direct_stellarconduct', 'direct_stellarswirl',
])

export const ADDITIONAL_DAMAGE_REACTIONS = Object.freeze([
    'direct_moonbloom', 'mooncrystallize', 'direct_mooncrystallize',
    ...STELLAR_DAMAGE_REACTIONS,
])

export function damageReactionLabel(key) {
    return DAMAGE_REACTION_LABELS[key] || '其他伤害'
}

export function damageReactionOptions(analysis = {}) {
    return Object.entries(analysis || {})
        .filter(([, value]) => value && typeof value === 'object' && Number.isFinite(value.expectation))
        .map(([key]) => ({ key, label: damageReactionLabel(key) }))
}

export function defaultDamageReaction(analysis = {}) {
    const options = damageReactionOptions(analysis)
    const positive = options.filter(({ key }) => analysis[key].expectation > 0)
    // A skill's direct stellar damage is distinct from its ordinary damage and reaction previews.
    for (const key of ['direct_stellarswirl', 'direct_stellarconduct']) {
        if (positive.some(option => option.key === key)) return key
    }
    return positive[0]?.key || options[0]?.key || ''
}

export function stellarDamageResults(analysis = {}) {
    return damageReactionOptions(analysis)
        .filter(({ key }) => STELLAR_DAMAGE_REACTIONS.includes(key))
        .map(option => ({ ...option, ...analysis[option.key] }))
}
