// The published and extension kernels expose preview fields even when a new
// character has no calibrated path to that reaction. Keep the reason alongside
// the result. Uncalibrated values are visible previews, never certified results.
export const NEW_REACTION_RESULTS = Object.freeze([
    'direct_moonbloom', 'direct_moonelectro', 'direct_mooncrystallize',
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
        // Keep the kernel preview, including a genuine zero; do not invent a value.
        availability[key] = {
            status: 'uncalibrated',
            has_value: Number.isFinite(result[key]?.expectation) || Number.isFinite(result[key]),
            reason: Number.isFinite(result[key]?.expectation) || Number.isFinite(result[key])
                ? '已有技能直伤预览值，角色效果接入尚待校准'
                : '当前选择的技能未返回这类直伤数值，请核对技能及辉映状态',
        };
    }
    result.reaction_availability = availability;
    return result;
}
