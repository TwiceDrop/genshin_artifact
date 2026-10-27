// Each saved preset is one local sample. No community statistics are fabricated.
export function localDatabase(presets, inventory, convert) {
    const groups = {}, rolls = { CriticalRate: .033, CriticalDamage: .066, ATKPercentage: .0498, HPPercentage: .0498,
        DEFPercentage: .062, ElementalMastery: 19.75, Recharge: .055, ATKFixed: 16.75, HPFixed: 254, DEFFixed: 19.75 }
    for (const { item } of Object.values(presets)) {
        if (!item?.character?.name || !item.weapon?.name) continue
        const name = item.character.name
        const g = groups[name] ||= { count: 0, weapons: {}, sets: {}, mains: { Sand: {}, Goblet: {}, Head: {} }, subs: {} }
        g.count++; g.weapons[item.weapon.name] = (g.weapons[item.weapon.name] || 0) + 1
        const sets = {}
        for (const id of item.artifactIds || []) {
            const raw = inventory.get(id); if (!raw) continue
            const a = convert(raw)
            sets[a.set_name] = (sets[a.set_name] || 0) + 1
            const main = g.mains[a.slot]
            if (main) main[a.main_stat[0]] = (main[a.main_stat[0]] || 0) + 1
            for (const [stat, value] of a.sub_stats) if (rolls[stat]) g.subs[stat] = (g.subs[stat] || 0) + value / rolls[stat]
        }
        const four = Object.keys(sets).find(s => sets[s] >= 4), pairs = Object.keys(sets).filter(s => sets[s] >= 2).sort()
        const key = JSON.stringify(four ? { Set4: four } : pairs.length >= 2 ? { Set22: pairs.slice(0, 2) } : pairs.length ? { Set2: pairs[0] } : 'Chiri')
        g.sets[key] = (g.sets[key] || 0) + 1
    }
    const character_result = {}
    for (const [name, g] of Object.entries(groups)) {
        const ratios = entries => entries.map(([k,v]) => [k,v / g.count]).sort((a,b) => b[1]-a[1])
        character_result[name] = { sample_count: g.count, weapon_usage: ratios(Object.entries(g.weapons)),
            artifact_set_usage: ratios(Object.entries(g.sets)).map(([k,v]) => [JSON.parse(k),v]),
            main_stat_usage: Object.fromEntries(Object.entries(g.mains).map(([slot, counts]) => {
                const total = Object.values(counts).reduce((a,b) => a+b,0)
                return [slot, Object.fromEntries(Object.entries(counts).map(([s,n]) => [s,n / total]))]
            })), artifact_sub_stat_statistics: Object.fromEntries(Object.entries(g.subs).map(([s,n]) => [s,n / g.count])) }
    }
    return { character_result, source: 'local-presets' }
}
