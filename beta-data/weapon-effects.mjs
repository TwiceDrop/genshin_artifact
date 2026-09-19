// Coverage is a user-selected average, not an automatic combat timeline.
const signatures = new Set(['BeyondTheChrysalis', 'HymnOfTheMaelstrom']);
export const isSignatureWeapon = weapon => signatures.has(weapon?.name);
function range(value, min, max, label, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        throw Error(`${label}应为 ${min}～${max}${integer ? ' 的整数' : ''}`);
    }
    return value;
}
export function normalizeSignatureWeapon(weapon) {
    if (!isSignatureWeapon(weapon)) return weapon;
    range(weapon.level, 1, 90, '武器等级', true);
    range(weapon.refine, 1, 5, '武器精炼', true);
    if (weapon.ascend && ![20, 40, 50, 60, 70, 80].includes(weapon.level)) throw Error('只有突破等级可以选择突破后');
    const old = weapon.params?.[weapon.name] || {};
    let params;
    if (weapon.name === 'BeyondTheChrysalis') {
        params = {
            on_field: old.on_field ?? true,
            loyal_rate: old.loyal_rate === undefined ? (old.loyal_wind ? 100 : 0) : old.loyal_rate,
            rebel_rate: old.rebel_rate === undefined ? (old.rebel_wind ? 100 : 0) : old.rebel_rate,
            plenty_rate: old.plenty_rate === undefined ? 0 : old.plenty_rate,
        };
        for (const key of ['loyal_rate', 'rebel_rate', 'plenty_rate']) range(params[key], 0, 100, 'BUFF 覆盖率（%）');
    } else {
        params = {stacks: old.stacks ?? 0, boosted: old.boosted ?? false, on_field: old.on_field ?? true, hp: old.hp === undefined ? 0 : old.hp};
        range(params.stacks, 0, 3, '蜜酿层数', true);
        range(params.hp, 0, 500000, '特效来源最终生命值');
    }
    return {...weapon, params: {[weapon.name]: params}};
}
export function chrysalisEffects(weapon) {
    const normalized = normalizeSignatureWeapon(weapon);
    const p = normalized.params.BeyondTheChrysalis, r = normalized.refine;
    const on = p.on_field ? 1 : 0;
    return {
        criticalDamage: (.4 + .16 * r) * p.loyal_rate / 100 * on,
        stellarSwirlBonus: (.27 + .09 * r) * p.rebel_rate / 100 * on,
        energyPerTrigger: 4.5 + .5 * r,
        energyPerFourSeconds: (4.5 + .5 * r) * p.plenty_rate / 100 * on,
    };
}
