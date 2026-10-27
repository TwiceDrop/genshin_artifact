const mainStats = require('./data/good-main-stat.json')
const mainKeys = {
    lifeStatic: 'hp', lifePercentage: 'hp_', attackStatic: 'atk', attackPercentage: 'atk_',
    defendStatic: 'def', defendPercentage: 'def_', elementalMastery: 'eleMas', recharge: 'enerRech_',
    critical: 'critRate_', criticalDamage: 'critDMG_', cureEffect: 'heal_', physicalBonus: 'physical_dmg_',
    fireBonus: 'pyro_dmg_', waterBonus: 'hydro_dmg_', iceBonus: 'cryo_dmg_', thunderBonus: 'electro_dmg_',
    windBonus: 'anemo_dmg_', rockBonus: 'geo_dmg_', dendroBonus: 'dendro_dmg_'
}
const equalValue = (a, b) => Number.isFinite(a) && Number.isFinite(b) && a.toFixed(5) === b.toFixed(5)
function hasLevelZeroMain(a) {
    const key = mainKeys[a.mainTag.name], value = mainStats[a.star]?.[key]?.[0]
    return value !== undefined && equalValue(a.mainTag.value, key.endsWith('_') ? value : Math.round(value))
}
function isPreviewLevelFour(a) {
    return a.level === 4 && a.normalTags.length === 4 && hasLevelZeroMain(a)
}
function isLevelZeroEquivalent(zero, preview) {
    if (zero.level !== 0 || preview.level !== 4 ||
        zero.setName !== preview.setName || zero.position !== preview.position || zero.star !== preview.star ||
        zero.mainTag.name !== preview.mainTag.name || !hasLevelZeroMain(zero) || !isPreviewLevelFour(preview)) return false
    // Unactivated stats are identity evidence only, never active calculator stats.
    const tags = zero.normalTags.length === 3 && zero.unactivatedTags?.length === 1
        ? [...zero.normalTags, ...zero.unactivatedTags] : zero.normalTags
    return tags.length === 4 && new Set(tags.map(t => t.name)).size === 4 &&
        new Set(preview.normalTags.map(t => t.name)).size === 4 && tags.every(t =>
            preview.normalTags.some(p => t.name === p.name && equalValue(t.value, p.value)))
}
function levelZeroMatches(existing, incoming) {
    const candidates = incoming.map(next => existing.filter(old =>
        isLevelZeroEquivalent(next, old) || isLevelZeroEquivalent(old, next)))
    const uses = new Map()
    for (const matches of candidates) for (const old of matches) uses.set(old, (uses.get(old) || 0) + 1)
    // No subset guessing and no many-to-one collapse of legitimately separate items.
    return candidates.map(matches => matches.length === 1 && uses.get(matches[0]) === 1 ? matches[0] : undefined)
}
exports.isPreviewLevelFour = isPreviewLevelFour
exports.levelZeroMatches = levelZeroMatches

// Read-only reference collection; saved presets and UID ownership are never rewritten.
function artifactImportContext(presets, groups, data) {
    const protectedIds = new Set(), owners = new Map()
    const protect = ids => { for (const id of ids || []) protectedIds.add(id) }
    const own = (uid, ids) => { for (const id of ids || []) {
        if (!owners.has(id)) owners.set(id, new Set())
        owners.get(id).add(String(uid))
    } }
    for (const row of Object.values(presets)) protect(row.item?.artifactIds)
    for (const row of groups) protect(row.artifactIds)
    for (const [uid, ids] of Object.entries(data.uidArtifactIds || {})) own(uid, ids)
    for (const row of data.entries || []) { protect(row.artifactIds); own(row.uid, row.artifactIds) }
    for (const row of data.artifactComparison?.history || []) protect(row.items.filter(Boolean).map(a => a.id))
    return { protectedIds, owners }
}
function confirmedZeroDuplicates(items, context) {
    const zeros = items.filter(a => a.level === 0), previews = items.filter(isPreviewLevelFour)
    const matches = levelZeroMatches(previews, zeros)
    return matches.flatMap((preview, i) => {
        if (!preview || context.protectedIds.has(preview.id) || !!preview.omit !== !!zeros[i].omit) return []
        const oldOwners = context.owners.get(preview.id) || new Set()
        const newOwners = context.owners.get(zeros[i].id) || new Set()
        if (oldOwners.size !== newOwners.size || [...oldOwners].some(uid => !newOwners.has(uid))) return []
        return [{ removedId: preview.id, keptId: zeros[i].id }]
    })
}
exports.artifactImportContext = artifactImportContext
exports.confirmedZeroDuplicates = confirmedZeroDuplicates
