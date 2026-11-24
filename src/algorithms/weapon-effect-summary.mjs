// A dash-separated refinement can itself contain slash-separated values for different stack counts.
// Some weapon descriptions instead use five plain slash-separated refinement values.
export function weaponEffectText(description, refine) {
    return description
        .replace(/<span\b[^>]*>([^<]*)<\/span>/gi, (_, content) => {
            const ranks = content.split('-')
            return ranks.length === 5 ? ranks[refine - 1] : content
        })
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\+?\d+(?:\.\d+)?%?(?:\/\+?\d+(?:\.\d+)?%?){4}/g, values => values.split('/')[refine - 1])
        .trim()
}

export function weaponEffectSummary(description, refine) {
    const text = weaponEffectText(description, refine)
    const end = text.search(/[。；;\n]|\.(?=\s)/)
    if (end >= 0 && text.slice(end + 1).trim()) return text.slice(0, end).trimEnd() + '…'
    return text
}
