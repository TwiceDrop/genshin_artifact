const missing = value => value == null || value === ''
const roleFields = ['uid', 'character', 'level', 'constellation', 'weapon', 'weaponLevel', 'refine']

function missingFields({role, drafts}) {
    let count = drafts.length ? 0 : 1
    if (role) {
        count += [...roleFields.map(key => role[key]), ...role.talents, ...Object.values(role.stats)].filter(missing).length
    }
    for (const piece of drafts) {
        count += [piece.setName, piece.position, piece.star, piece.level].filter(missing).length
        for (const line of [piece.mainTag, ...piece.normalTags]) {
            count += Number(missing(line.name)) + Number(missing(line.value))
        }
        // An upgrade unlocks a missing line before it can improve another.
        const minimum = Math.min(4, Math.max(0, piece.star - 2) + Math.floor(piece.level / 4))
        count += Math.max(0, minimum - piece.normalTags.length)
    }
    return count
}

function fill(primary, secondary, keys) {
    const result = {...primary}
    for (const key of keys) if (missing(result[key]) && !missing(secondary[key])) result[key] = secondary[key]
    return result
}

function mergeLine(line, other) {
    if (!other || (line.name && other.name && line.name !== other.name)) return line
    if (!line.name && !missing(line.value) && !missing(other.value) && Number(line.value) !== Number(other.value)) return line
    return fill(line, other, ['name', 'value'])
}

function mergePiece(piece, other) {
    if (!other || (piece.position && other.position && piece.position !== other.position) ||
        (piece.setName && other.setName && piece.setName !== other.setName)) return piece
    const result = fill(piece, other, ['setName', 'position', 'star', 'level'])
    result.mainTag = mergeLine(piece.mainTag, other.mainTag)
    // In a battle record both engines use the same geometrically located rows.
    // Freeform scans have no stable row indices; pair those by stat name.
    const tags = piece.normalTags.map(line => {
        const matches = other.normalTags.filter(candidate => {
            if (piece.region) return candidate.row === line.row
            if (line.name) return candidate.name === line.name
            return !missing(line.value) && Number(line.value) === Number(candidate.value)
        })
        return matches.length === 1 ? mergeLine(line, matches[0]) : line
    })
    for (const candidate of other.normalTags) {
        if (!candidate.name || tags.some(line => line.name === candidate.name)) continue
        if (piece.region && tags.some(line => line.row === candidate.row)) continue
        if (tags.length < 4) tags.push(candidate)
    }
    result.normalTags = piece.region ? tags.sort((a,b) => a.row - b.row) : tags
    return result
}

function mergeResults(first, second) {
    let role = first.role
    if (role) {
        const other = second.role
        if (['character','uid'].some(key => role[key] && other[key] && role[key] !== other[key])) return first
        const weaponConflict = role.weapon && other.weapon && role.weapon !== other.weapon
        role = fill(role, other, weaponConflict ? roleFields.filter(k => k !== 'weaponLevel' && k !== 'refine') : roleFields)
        role.talents = role.talents.map((value, i) => missing(value) ? other.talents[i] : value)
        role.stats = fill(role.stats, other.stats, Object.keys(other.stats))
        role.transcript = [...role.transcript, ...other.transcript.map(([key, value]) => ['Tesseract · ' + key, value])]
    }
    const drafts = first.drafts.slice()
    for (const other of second.drafts) {
        const index = drafts.findIndex(piece => other.region
            ? piece.region?.top === other.region.top && piece.region.left === other.region.left
            : !piece.region)
        if (index < 0) drafts.push(other)
        else drafts[index] = mergePiece(drafts[index], other)
    }
    return {role, drafts}
}

export async function recognizeWithBackup(signal, primary, secondary, names, panelMatches = () => true) {
    signal.throwIfAborted()
    let first, failure
    try {
        first = await primary()
    } catch (error) {
        if (error.name === 'MultipleArtifactRegionsError') throw error
        failure = error
    }
    signal.throwIfAborted()
    if (first && !missingFields(first) && panelMatches(first)) return first
    let second
    try {
        second = await secondary()
    } catch (error) {
        signal.throwIfAborted()
        if (error.name === 'MultipleArtifactRegionsError') throw error
        if (!first) throw new Error(names[0] + '：' + (failure.message || failure) + '；' + names[1] + '：' + (error.message || error))
        console.warn(names[1] + ' OCR', error)
        return first
    }
    signal.throwIfAborted()
    if (!first) return second
    const merged = mergeResults(first, second)
    if (!merged.role || merged === first || panelMatches(merged)) return merged
    // Keep the screenshot's original measured totals as the independent check.
    // Replace conflicting readings only if the entire second build matches them.
    if (second.drafts.length === merged.drafts.length && !missingFields(second)) {
        const alternative = {...second, role: {...second.role, stats:merged.role.stats, transcript:merged.role.transcript}}
        if (panelMatches(alternative)) return alternative
    }
    return merged
}
