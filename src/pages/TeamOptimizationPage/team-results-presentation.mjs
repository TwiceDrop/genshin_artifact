/** @typedef {'flower' | 'feather' | 'sand' | 'goblet' | 'head'} TeamResultSlot */
/** @typedef {Partial<Record<TeamResultSlot, number | string>>} TeamResultBuild */
/** @typedef {import('../../types/artifact').IArtifact} IArtifact */

/** @type {readonly TeamResultSlot[]} */
const slots = ['flower', 'feather', 'sand', 'goblet', 'head']

/** @param {ReadonlyArray<Pick<IArtifact, 'setName'> | undefined>} items */
export function teamResultSets(items) {
    const counts = new Map()
    for (const item of items) {
        if (item) counts.set(item.setName, (counts.get(item.setName) ?? 0) + 1)
    }
    return Array.from(counts, ([name, count]) => ({ name, count, effect: count >= 4 ? 4 : count >= 2 ? 2 : 0 }))
}

/** @param {number} value @param {number} first */
export function teamResultDamageDelta(value, first) {
    return first > 0 ? ((value - first) / first * 100).toFixed(2) + '%' : null
}

/**
 * @template T
 * @param {TeamResultBuild} build
 * @param {ReadonlyMap<number, T> | undefined} items
 * @param {TeamResultBuild} [first]
 */
export function teamResultSlots(build, items, first) {
    return slots.map(key => {
        const id = build[key]
        const baselineId = first?.[key]
        return {
            key,
            item: id == null ? undefined : items?.get(Number(id)),
            different: !!first && (id == null || baselineId == null ? id !== baselineId : Number(id) !== Number(baselineId)),
        }
    })
}
