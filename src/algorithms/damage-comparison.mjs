export function damageComparison(current, before) {
    const rounded = value => Number.isFinite(value) ? Math.round(value) : null
    const value = rounded(current), old = rounded(before)
    if (value === null) return { current: '无数据', before: null, delta: '', percent: '', direction: '' }
    if (old === null) return { current: String(value), before: null, delta: '', percent: '', direction: '' }
    const delta = value - old
    const rate = before === 0 ? (current === 0 ? 0 : null) : (current - before) / Math.abs(before) * 100
    const percent = rate === null ? '百分比不适用' : `${rate > 0 ? '+' : ''}${Number(rate.toFixed(2)).toFixed(2)}%`
    return { current: String(value), before: String(old), percent, delta: `${delta > 0 ? '+' : ''}${delta}`,
        direction: delta > 0 ? 'increase' : delta < 0 ? 'decrease' : '' }
}
