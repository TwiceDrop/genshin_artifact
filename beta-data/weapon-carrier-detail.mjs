// Neutral carriers can still emit named, zero-valued passives in the legacy kernel.
export function removeInactiveCarrierPassive(detail, passive) {
    for (const sources of Object.values(detail)) {
        if (!sources || typeof sources !== 'object') continue;
        for (const [label, value] of Object.entries(sources)) {
            if (value === 0 && label.startsWith(passive)) delete sources[label];
        }
    }
}

export function isWeaponDetail(method) {
    return method === 'get_attribute' || method === 'get_damage_analysis';
}

// The legacy kernel aggregates corrections and player-added BUFFs under one key.
// Move only the known correction into the weapon's own secondary-stat entry.
export function restoreWeaponSubstat(sources, buffLabel, correction, weaponValue) {
    if (!sources || !Object.hasOwn(sources, buffLabel)) return;
    const remaining = sources[buffLabel] - correction;
    if (Math.abs(remaining) < 1e-12) delete sources[buffLabel];
    else sources[buffLabel] = remaining;
    if (weaponValue === 0) delete sources['武器副词条'];
    else sources['武器副词条'] = weaponValue;
}
