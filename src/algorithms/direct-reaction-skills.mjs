import {isDirectDamageReaction, visibleDamageReactionKeys} from './reaction-labels.mjs'

// Skill indices that can produce a direct lunar or stellar hit in the single-hit calculator.
// A candidate can still resolve to ordinary damage under the current skill settings.
const cryoTraveler = [13, 14, 15, 16]
const candidateHits = {
    AetherCryo: cryoTraveler,
    LumineCryo: cryoTraveler,
    Columbina: [4, 10, 11, 12],
    Cyno: [11],
    Flins: [17, 18, 19, 20, 21],
    Ineffa: [11, 12],
    Lauma: [9, 10],
    Linnea: [9, 10],
    Mitya: [8, 12, 13, 15],
    Nefer: [11, 12, 13, 16, 17],
    Odette: [12, 13, 15, 16, 18, 19, 22, 23, 24, 25],
    Qiqi: [19],
    Sandrone: [5, 11, 14, 15, 17, 18, 19, 20, 21, 22],
    Vesna: [13, 14, 15, 17, 19],
    Wriothesley: [12, 13, 15, 17, 18],
    YaeMiko: [14, 16],
    YumemizukiMizuki: [14, 15],
    Zibai: [13, 15, 17],
}

export function directReactionSkillIndices(character, groups, analyzeHit) {
    const indices = new Set()
    const candidates = candidateHits[character]
    if (!candidates) return indices

    for (const group of groups) {
        for (const {index} of group.items) {
            if (candidates.includes(index) && visibleDamageReactionKeys(analyzeHit(index)).some(isDirectDamageReaction)) {
                indices.add(index)
            }
        }
    }
    return indices
}
