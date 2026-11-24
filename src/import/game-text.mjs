const tones = {
    FFD780: 'gold', FF9999: 'pyro', '80C0FF': 'hydro', '80FFD7': 'anemo',
    FFACFF: 'electro', '99FF88': 'dendro', '99FFFF': 'cryo', FFE699: 'geo',
}

// Game records mark text with color tags; older exported records can use Markdown emphasis.
export function gameTextRuns(source = '') {
    const text = source.replace(/\{(?:LINK#[^}]+|\/LINK)\}/g, '')
    const runs = []
    let end = 0
    for (const match of text.matchAll(/<color=#([\da-f]{6})(?:[\da-f]{2})?>([\s\S]*?)<\/color>|\*\*([\s\S]+?)\*\*|<i>([\s\S]*?)<\/i>/gi)) {
        if (match.index > end) runs.push({ text: text.slice(end, match.index) })
        if (match[4] !== undefined) runs.push({ text: match[4], italic: true })
        else runs.push({ text: match[2] ?? match[3], tone: match[1] ? tones[match[1].toUpperCase()] || 'emphasis' : 'gold' })
        end = match.index + match[0].length
    }
    if (end < text.length) runs.push({ text: text.slice(end) })
    return runs
}
