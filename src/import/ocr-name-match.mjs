export function titleDistance(a,b) {
    let row = Array.from({length:b.length+1}, (_,i) => i)
    for (let i=0;i<a.length;i++) {
        const next = [i+1]
        for (let j=0;j<b.length;j++) next.push(Math.min(row[j+1]+1,next[j]+1,row[j]+Number(a[i]!==b[j])))
        row = next
    }
    return row[b.length]
}

// OCR can pick up the level badge, spaces, and decorative punctuation beside a name.
export function normalizeName(text) {
    return text.normalize('NFKC').replace(/Lv\.?\s*\d+.*$/i, '').replace(/[^\p{Script=Han}]/gu, '')
}

export function matchOcrName(text, choices) {
    const seen = normalizeName(text)
    if (!seen) return []
    const exact = choices.filter(choice => normalizeName(choice.label) === seen)
    if (exact.length || seen.length < 2) return exact

    let nearest = Infinity
    const matches = []
    for (const choice of choices) {
        const name = normalizeName(choice.label)
        // Short names tolerate one edit; long names still need most of their glyphs.
        const limit = Math.min(2, Math.max(1, Math.floor(name.length / 3)))
        if (name.length < 2 || Math.abs(name.length - seen.length) > limit) continue
        const distance = titleDistance(seen, name)
        if (distance > limit || distance > nearest) continue
        if (distance < nearest) matches.length = 0
        matches.push(choice)
        nearest = distance
    }
    return matches
}
