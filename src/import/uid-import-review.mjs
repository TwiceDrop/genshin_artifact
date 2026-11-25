import { artifactFingerprint, POSITIONS } from './miyoushe.mjs'
import { wornArtifactIds } from './roster-equipment.mjs'
import { canonicalGameElement } from './character-summary.mjs'

export function accountGameUid(data) {
    const uids = new Set([...Object.keys(data.snapshots || {}), ...(data.entries || []).map(row => row.uid),
        ...Object.keys(data.uidArtifactIds || {})].map(String).filter(uid => /^\d{8,10}$/.test(uid)))
    const selected = String(data.selectedUid)
    return data.boundUid || (uids.has(selected) ? selected : [...uids][0]) || ''
}

export const slotLabels = ['生之花', '死之羽', '时之沙', '空之杯', '理之冠']
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
    const ids = wornArtifactIds(row, presets)
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
    if (!previous.size) return []
    const rows = next.data.entries.filter(r => r.uid === uid)
    const owners = new Map()
    for (const [key, row] of previous) {
        if (row.manual) continue
        for (const id of wornArtifactIds(row, old.presets)) {
            if (Number.isInteger(id) && id >= 0) owners.set(id, key)
        }
    }
    const links = new Map()
    for (const row of rows) {
        if (row.manual) continue
        const to = rowKey(row)
        const before = previous.get(to)
        const beforeIds = before ? wornArtifactIds(before, old.presets) : []
        wornArtifactIds(row, next.presets).forEach((id, slot) => {
            const from = owners.get(id)
            if (from === undefined || from === to || beforeIds[slot] === id) return
            const transfer = { from, to, id, slot }
            for (const key of [from, to]) {
                if (!links.has(key)) links.set(key, [])
                links.get(key).push(transfer)
            }
        })
    }
    const raws = state => new Map((state.data.snapshots[uid]?.characters || []).map(r => [rawKey(r), r]))
    const oldRaw = raws(old), newRaw = raws(next), changes = []
    const fields = ['等级', '角色突破', '命之座', '天赋', '武器', '武器等级', '武器突破', '精炼']
    for (const row of rows) {
        const key = rowKey(row), prior = previous.get(key)
        if (!prior) {
            if (links.has(key)) changes.push({ key, label: row.label, details: [], row })
            continue
        }
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
        if (details.length || links.has(key)) changes.push({ key, label: row.label, details, prior, row })
    }
    // A chain A→B→C needs one decision even when A and C never traded directly.
    const remaining = new Map(changes.map(role => [role.key, role]))
    const groups = []
    for (const change of changes) {
        if (!remaining.has(change.key)) continue
        const roles = [], transfers = new Set(), pending = [change.key]
        while (pending.length) {
            const key = pending.pop()
            const role = remaining.get(key)
            if (!role) continue
            roles.push(role)
            remaining.delete(key)
            for (const transfer of links.get(key) || []) {
                transfers.add(transfer)
                pending.push(transfer.from === key ? transfer.to : transfer.from)
            }
        }
        groups.push({ roles, transfers: [...transfers] })
    }
    return groups
}

// Retain the old build everywhere it is read, including the raw snapshot used on the next GOOD import.
function keepRoleVersions(uid, skipped, old, next) {
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

function clearTransferredSlot(role, id, slot, next, raws) {
    const row = role.row, preset = next.presets[row.presetName]?.item
    if (wornArtifactIds(row, next.presets)[slot] !== id) return
    for (const owner of [row, preset]) {
        if (owner?.artifactIds) owner.artifactIds = owner.artifactIds.map((current, i) => i === slot ? -1 : current)
    }
    if (row.equippedArtifacts) row.equippedArtifacts = row.equippedArtifacts.filter(a => a.position !== POSITIONS[slot])
    const raw = raws.get(role.key)
    if (raw?.relics) raw.relics = raw.relics.filter(a => Number(a.pos) !== slot + 1)
}

export function applyRoleReview(uid, groups, kept, old, next) {
    const raws = new Map((next.data.snapshots[uid]?.characters || []).map(raw => [rawKey(raw), raw]))
    const skipped = []
    for (const group of groups) {
        if (!group.transfers.length && !kept.has(group)) continue
        const roles = new Map(group.roles.map(role => [role.key, role]))
        if (kept.has(group)) skipped.push(...group.roles.filter(role => role.prior))
        for (const { from, to, id, slot } of group.transfers) {
            if (kept.has(group)) {
                // Keep adding a new role; leave just the disputed slot with its old owner.
                if (!roles.get(to).prior) clearTransferredSlot(roles.get(to), id, slot, next, raws)
            } else {
                // A role preset file may transfer a piece without including the old wearer.
                clearTransferredSlot(roles.get(from), id, slot, next, raws)
            }
        }
    }
    const skippedUpdates = skipped.filter(role => role.details.length || wornArtifactIds(role.row, next.presets).some((id, i) => id !== wornArtifactIds(role.prior, old.presets)[i])).length
    if (skipped.length) keepRoleVersions(uid, skipped, old, next)
    return skippedUpdates
}
