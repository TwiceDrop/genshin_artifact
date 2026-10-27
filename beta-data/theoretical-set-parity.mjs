// A theoretical-set ranking must use the same character calculation as the
// damage panel. Compare the actual damage values before routing a new target
// through an independently compiled WASM core.
const close = (a, b, tolerance) => Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b))

export function compareTheoreticalSetParity(published, candidate, cases, tolerance = 1e-6) {
    const findings = []
    for (const {name, input, field} of cases) {
        try {
            const expected = published.CalculatorInterface.get_damage_analysis(input, null)?.[field]
            const actual = candidate.CalculatorInterface.get_damage_analysis(input, null)?.[field]
            const values = ['non_critical', 'critical', 'expectation']
            const equal = expected && actual && values.every(key => close(actual[key], expected[key], tolerance))
            findings.push({name, field, equal: !!equal,
                expected: expected && Object.fromEntries(values.map(key => [key, expected[key]])),
                actual: actual && Object.fromEntries(values.map(key => [key, actual[key]]))})
        } catch (error) {
            findings.push({name, field, equal: false, error: String(error)})
        }
    }
    return {equal: findings.length > 0 && findings.every(finding => finding.equal), findings}
}
