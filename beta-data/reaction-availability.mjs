// The published and extension kernels expose preview fields even when a new
// character has no calibrated path to that reaction. Keep the reason alongside
// the result instead of treating an absent field as zero damage.
export const NEW_REACTION_RESULTS = Object.freeze([
    'moonfall', 'moonelectro', 'mooncrystallize',
    'direct_moonbloom', 'direct_moonelectro', 'direct_mooncrystallize',
    'stellarconduct', 'stellarswirl_anemo', 'stellarswirl_cryo',
    'direct_stellarconduct', 'direct_stellarswirl',
]);

export function markReactionAvailability(result, calibrated = []) {
    const known = new Set(calibrated);
    const availability = { ...(result.reaction_availability || {}) };
    for (const key of NEW_REACTION_RESULTS) {
        if (!Object.hasOwn(result, key)) continue;
        if (known.has(key)) {
            if (Number.isFinite(result[key]?.expectation))
                availability[key] = { status: 'calibrated' };
            continue;
        }
        delete result[key];
        availability[key] = {
            status: 'uncalibrated',
            reason: '该角色的此类反应尚无经核对的完整结算公式',
        };
    }
    result.reaction_availability = availability;
    return result;
}
