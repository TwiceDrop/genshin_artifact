const total = composition => Object.values(composition || {}).reduce((sum, value) => sum + Number(value), 0)
export function attributeComparison(composition, baseline, percentage = false) {
    const digits = percentage ? 1 : 0, scale = percentage ? 100 : 1
    const rounded = value => Number((value * scale).toFixed(digits))
    const format = value => `${value.toFixed(digits)}${percentage ? '%' : ''}`
    const current = rounded(total(composition))
    if (!baseline) return { current: format(current), before: null, delta: '', direction: '' }
    const before = rounded(total(baseline)), difference = Number((current - before).toFixed(digits))
    return { current: format(current), before: format(before),
        delta: `${difference > 0 ? '+' : ''}${format(difference)}`,
        direction: difference > 0 ? 'increase' : difference < 0 ? 'decrease' : '' }
}
