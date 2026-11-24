import { artifactFingerprint, POSITIONS } from './miyoushe.mjs'
import { canonicalGameElement } from './character-summary.mjs'

export function accountGameUid(data) {
    const uids = new Set([...Object.keys(data.snapshots || {}), ...(data.entries || []).map(row => row.uid),
        ...Object.keys(data.uidArtifactIds || {})].map(String).filter(uid => /^\d{8,10}$/.test(uid)))
    const selected = String(data.selectedUid)
    return data.boundUid || (uids.has(selected) ? selected : [...uids][0]) || ''
}

const slotLabels = ['生之花', '死之羽', '时之沙', '空之杯', '理之冠']
const identity = (id, element) => id + ':' + canonicalGameElement(element || '')
const rawKey = raw => identity(raw.base.id, raw.base.element)
const rowKey = row => identity(row.id ?? row.key.split(':')[1], row.element || row.key.split(':')[2])
export function existingRosterKey(key, entries) {
    if (!key) return key
    const [uid, id, element] = key.split(':')
    return entries.find(row => row.uid === uid && rowKey(row) === identity(id, element))?.key || key
}
const show = value => value == null ? '无' : String(value)

function roleView(row, presets, inventory, raw) {
    const preset = presets[row.presetName]?.item, c = preset?.character, w = preset?.weapon
    const ids = preset?.artifactIds || row.artifactIds || []
    const talents = c ? [c.skill1, c.skill2, c.skill3].map(v => v + 1) :
        raw?.skills?.filter(s => s.skill_type === 1).slice(0, 3).map(s => s.level)
    return {
        fields: [c?.level ?? row.level, c?.ascend, c?.constellation ?? row.constellation, talents?.join(' / '),
            w?.name, w?.level, w?.ascend, w?.refine],
        gear: POSITIONS.map((position, i) => inventory.get(ids[i]) || row.equippedArtifacts?.find(a => a.position === position))
    }
}

export function importDifferences(uid, old, next, labels) {
    const previous = new Map(old.data.entries.filter(r => r.uid === uid).map(r => [rowKey(r), r]))
    const raws = state => new Map((state.data.snapshots[uid]?.characters || []).map(r => [rawKey(r), r]))
    const oldRaw = raws(old), newRaw = raws(next), changes = []
    const fields = ['等级', '角色突破', '命之座', '天赋', '武器', '武器等级', '武器突破', '精炼']
    for (const row of next.data.entries.filter(r => r.uid === uid)) {
        const key = rowKey(row), prior = previous.get(key)
        if (!prior) continue
        const a = roleView(prior, old.presets, old.inventory, oldRaw.get(key))
        const b = roleView(row, next.presets, next.inventory, newRaw.get(key))
        const details = []
        fields.forEach((field, i) => {
            if (a.fields[i] === b.fields[i]) return
            if ((i === 1 || i === 6) && a.fields[i - 1] !== b.fields[i - 1]) return
            const format = v => i === 4 && v ? labels.weapon(v) : typeof v === 'boolean' ? (v ? '已突破' : '未突破') : show(v)
            details.push(field + '：' + format(a.fields[i]) + ' → ' + format(b.fields[i]))
        })
        a.gear.forEach((piece, i) => {
            const incoming = b.gear[i]
            if ((piece && artifactFingerprint(piece)) === (incoming && artifactFingerprint(incoming))) return
            const format = p => p ? labels.set(p.setName) + ' +' + p.level : '空'
            details.push(slotLabels[i] + '：' + format(piece) + ' → ' + format(incoming) +
                (piece && incoming && format(piece) === format(incoming) ? '（词条不同）' : ''))
        })
        if (details.length) changes.push({ key, label: row.label, details, prior, row })
    }
    return changes
}

// Retain the old build everywhere it is read, including the raw snapshot used on the next GOOD import.
export function keepRoleVersions(uid, skipped, old, next) {
    const previousRaw = new Map((old.data.snapshots[uid]?.characters || []).map(raw => [rawKey(raw), raw]))
    const kept = new Map(skipped.map(change => [change.key, change]))
    next.data.entries = next.data.entries.map(row => row.uid === uid && kept.has(rowKey(row)) ? kept.get(rowKey(row)).prior : row)
    for (const { prior, row } of skipped) {
        for (const name of [prior.presetName, row.presetName].filter(Boolean)) {
            if (old.presets[name]) next.presets[name] = old.presets[name]
            else delete next.presets[name]
        }
        const groups = next.data.rosterCharacterPresets
        if (groups && old.data.rosterCharacterPresets?.[prior.key]) groups[prior.key] = old.data.rosterCharacterPresets[prior.key]
        else if (groups) delete groups[prior.key]
    }
    const snapshot = next.data.snapshots[uid]
    if (snapshot) {
        snapshot.characters = [...snapshot.characters.filter(raw => !kept.has(rawKey(raw))),
            ...skipped.flatMap(({key}) => previousRaw.has(key) ? [previousRaw.get(key)] : [])]
        snapshot.total = snapshot.characters.length
    }
}
