export const POLESTAR_FIELD = 'ResonancePolestarField'
export const POLESTAR_MAX_STACKS = 12

export function polestarFieldState(buffs) {
    const matches = buffs.filter(b => b.name === POLESTAR_FIELD)
    const entry = matches.find(b => !b.lock) || matches[0]
    return { enabled: matches.some(b => !b.lock), stacks: entry?.config?.[POLESTAR_FIELD]?.stacks ?? 0 }
}

// The shortcut edits the same native resonance buff that presets and the picker use.
// Collapse duplicate entries when edited so this field is never applied twice.
export function updatePolestarField(buffs, patch, newId) {
    const previous = polestarFieldState(buffs)
    const enabled = patch.enabled ?? previous.enabled, stacks = Number(patch.stacks ?? previous.stacks)
    if (!Number.isFinite(stacks) || stacks < 0 || stacks > POLESTAR_MAX_STACKS) throw new Error('极星辉域层数须在 0～12 之间')
    const existing = buffs.find(b => b.name === POLESTAR_FIELD && !b.lock) || buffs.find(b => b.name === POLESTAR_FIELD)
    if (!existing && !enabled) return buffs
    const entry = { ...existing, id: existing?.id ?? newId(), name: POLESTAR_FIELD, lock: !enabled, config: { [POLESTAR_FIELD]: { stacks } } }
    return [...buffs.filter(b => b.name !== POLESTAR_FIELD), entry]
}
