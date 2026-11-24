import mapping from './data/good-character-mapping.mjs'

export const travelerBonuses = { Anemo: 'QE', Geo: 'QE', Electro: 'QE', Dendro: 'EQ', Hydro: 'EQ', Pyro: 'EQ', Cryo: 'QE' }

export function constellationTalentBonuses(name, rank) {
    const traveler = /^(?:Aether|Lumine)(.+)$/.exec(name)
    const order = traveler ? travelerBonuses[traveler[1]] : mapping.constellationTalents[name]
    const bonuses = [0, 0, 0]
    for (const [index, threshold] of [3, 5].entries()) {
        if (rank < threshold) continue
        const slot = 'AEQ'.indexOf(order?.[index] || '?')
        if (slot < 0) throw new Error('此角色的命座天赋等级尚未适配')
        bonuses[slot] += 3
    }
    return bonuses
}

export function changeConstellation(character, rank) {
    const before = constellationTalentBonuses(character.name, character.constellation)
    const after = constellationTalentBonuses(character.name, rank)
    const next = { ...character, constellation: rank }
    for (const [i, key] of ['skill1', 'skill2', 'skill3'].entries()) {
        next[key] = character[key] + after[i] - before[i]
    }
    return next
}

export function withBaseTalentLevels(character, levels) {
    const bonuses = constellationTalentBonuses(character.name, character.constellation)
    const next = { ...character }
    for (const [i, key] of ['skill1', 'skill2', 'skill3'].entries()) {
        next[key] = levels[i] + bonuses[i] - 1
    }
    return next
}
