import { matchDisplayedRarity } from './level-zero-match.cjs'

export const slotLabels = { flower: '生之花', feather: '死之羽', sand: '时之沙', cup: '空之杯', head: '理之冠' }

export function screenshotDraft(text, sets, locale, tags) {
    const lines = text.normalize('NFKC').split(/\r?\n/).map(line => line.replace(/\s+/g, '')).filter(Boolean)
    const draft = { setName: '', position: '', level: '', star: '', mainTag: { name: '', value: '' }, normalTags: [] }
    const positions = new Set()
    let start = -1
    for (const [index, line] of lines.entries()) {
        for (const [key, set] of Object.entries(sets)) {
            if (!draft.setName && line.includes(locale[set.nameLocale])) draft.setName = key
            for (const position of Object.keys(slotLabels)) {
                const piece = locale[set[position]?.text]
                if (!piece || !line.includes(piece)) continue
                draft.setName = key; draft.position = position; positions.add(position)
                if (start < 0) start = index
            }
        }
        for (const [key, label] of Object.entries(slotLabels)) {
            if (!line.includes(label)) continue
            positions.add(key); draft.position = key
            if (start < 0) start = index
        }
    }
    if (positions.size > 1) {
        const error = new Error('图中有多个圣遗物部位，请框选一件圣遗物的详情。')
        error.name = 'MultipleArtifactRegionsError'
        throw error
    }
    if (start < 0) return draft
    const names = [...new Set(Object.values(tags).map(tag => tag.chs.replace(/%$/, '')))].sort((a, b) => b.length - a.length)
    const readings = []
    for (let i = start; i < lines.length; i++) {
        const line = lines[i]
        if (/[124][件套]{1,2}(?:套|装|效果|:)/.test(line) || line.includes('已装备')) break
        const level = line.match(/^(?:强化等级|等级|Lv\.?|[+＋])[:+]?([0-9]{1,2})$/i)
        if (level && Number(level[1]) <= 20) { draft.level = Number(level[1]); continue }
        const stars = line.match(/[★⭐]{1,5}/u)
        if (stars) draft.star = [...stars[0]].length
        const label = names.find(name => line.includes(name))
        if (!label) continue
        let tail = line.slice(line.indexOf(label) + label.length)
        if (!/\d/.test(tail) && /^[+:]?\d[\d,.]*%?$/.test(lines[i + 1] || '')) tail += lines[++i]
        const amount = tail.replace(/[,，]/g, '').match(/(\d+(?:\.\d+)?)(%?)/)
        const matches = Object.values(tags).filter(tag => tag.chs.replace(/%$/, '') === label)
        const percentage = tail.includes('%') || !!amount?.[1].includes('.')
        const tag = matches.length === 1 ? matches[0] : matches.find(tag => tag.percentage === percentage)
        // In-game percentages display at most one decimal; OCR can read the % glyph as digits.
        const value = amount?.[1] || ''
        const validFormat = tag.percentage ? /^\d+(?:\.\d)?$/ : /^\d+$/
        readings.push({ name: tag.name, value: validFormat.test(value) ? value : '' })
    }
    if (readings.length) [draft.mainTag, ...draft.normalTags] = readings.slice(0, 5)
    if (!draft.star) draft.star = matchDisplayedRarity(draft.mainTag, draft.level, sets[draft.setName]) || (draft.level > 16 ? 5 : '')
    return draft
}
