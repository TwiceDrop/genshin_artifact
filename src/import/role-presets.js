import { usePresetStore } from '@/store/pinia/preset'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { gameRosterPresetLabel, presetEquipmentChanges } from '@/utils/preset-workflow.mjs'
import characters from '@/assets/_gen_character'
import locale from '@/i18n/generated/zh-cn.json'
import { gameCharacters } from './good-roster.mjs'
import { isPickerCharacter } from './character-summary.mjs'

function customOwners(data) {
    const owners = new Map()
    for (const [key, group] of Object.entries(data.rosterCharacterPresets || {})) {
        for (const name of group.names) owners.set(name, key)
    }
    return owners
}

export function characterPresetChoices(row, data, presets) {
    const choices = []
    const base = presets[row.presetName]
    if (!base || !isPickerCharacter(base.item.character.name, row.label)) return choices
    choices.push(base.item.miyousheKey
        ? { ...base, key: row.key, presetName: base.name, name: gameRosterPresetLabel(row.uid) }
        : base)
    for (const name of data.rosterCharacterPresets?.[row.key]?.names || []) {
        const variant = presets[name]
        if (variant && name !== base.name && !variant.item.miyousheKey && variant.item.character.name === base.item.character.name) choices.push(variant)
    }
    for (const loadout of data.rosterLoadouts?.[row.key]?.configs || []) {
        choices.push({ ...base, name: loadout.name, presetName: base.name, loadout,
            key: JSON.stringify([row.key, loadout.name]) })
    }
    return choices
}

export function rosterPresetChoices(data, presets) {
    const choices = data.entries.flatMap(row => characterPresetChoices(row, data, presets))
    return [...new Map(choices.map(choice => [choice.key || choice.name, choice])).values()]
}

export function artifactExclusionGroups(data, presets, uid) {
    return data.entries.flatMap(row => {
        if (row.uid && row.uid !== uid) return []
        const choices = characterPresetChoices(row, data, presets)
        if (!choices.length) return []
        const role = characters[choices[0].item.character.name]
        return [{ key: row.key, uid: row.uid, label: locale[role.nameLocale], avatar: role.avatar,
            choices: choices.map(choice => {
                const game = !choice.loadout && !!choice.item.miyousheKey
                const key = choice.loadout ? 'saved:' + choice.name : game ? 'current' : 'role:' + choice.name
                return { key, name: choice.name, game, ids: choice.loadout?.ids ?? choice.item.artifactIds ?? [] }
            }) }]
    })
}

export function exportRolePresets(entries = usePresetStore().allFlat.value) {
    const data = useMiyousheStore().data.value, owners = customOwners(data)
    const manual = new Map(data.entries.filter(row => row.manual).map(row => [row.presetName, row.key]))
    return entries.map(entry =>
        manual.has(entry.name) ? { ...entry, manualRoleKey: manual.get(entry.name) } :
        owners.has(entry.name) ? { ...entry, rosterKey: owners.get(entry.name) } : entry)
}

function rosterEntry(key, name, item) {
    const [uid, id, element] = key.split(':')
    const role = item.character.name
    return { key, uid, id: Number(id), element, label: locale[characters[role]?.nameLocale] || role,
        presetName: name, level: item.character.level, constellation: item.character.constellation,
        artifactIds: item.artifactIds, ...(!item.miyousheKey && { manual: true }) }
}

// A legacy custom preset may have no UID. Prefer the same character on the
// selected UID, or its sole matching UID when there is only one.
export function connectSavedRolePresets(roster = useMiyousheStore(), presets = usePresetStore()) {
    const data = roster.data.value
    const linked = new Set([...customOwners(data).keys(), ...data.entries.map(row => row.presetName)])
    const rows = new Map(data.entries.map(row => [row.key, row]))
    const gameOwner = role => {
        const matches = data.entries.filter(row => row.uid && presets.getPreset(row.presetName)?.item.character.name === role)
        return matches.find(row => row.uid === roster.selectedUid.value) || (matches.length === 1 ? matches[0] : null)
    }
    for (const local of data.entries.filter(row => row.manual && !row.uid && !row.linkedPresetOwner)) {
        const base = presets.getPreset(local.presetName)
        const owner = base && gameOwner(base.item.character.name)
        if (!owner) continue
        for (const name of [base.name, ...(data.rosterCharacterPresets?.[local.key]?.names || [])]) {
            roster.linkCharacterPreset(owner.key, name)
        }
        local.linkedPresetOwner = owner.key
    }
    for (const { name, item } of presets.allFlat.value) {
        if (linked.has(name)) continue
        const identity = gameCharacters.get(item.character.name)
        if (!identity) continue
        const key = item.miyousheKey || gameOwner(item.character.name)?.key || `:${identity.id}:${identity.element}`
        const row = rows.get(key)
        if (!row) {
            const base = rosterEntry(key, name, item)
            data.entries.push(base)
            rows.set(key, base)
        } else if (!item.miyousheKey) {
            roster.linkCharacterPreset(key, name)
        } else if (!row.presetName) {
            row.presetName = name
        }
    }
}

export function isRolePresetFile(value) {
    const validKey = key => key == null || (typeof key === 'string' && /^(?:\d{8,10})?:\d+:[^:]*$/.test(key))
    return Array.isArray(value) && value.every(entry => typeof entry?.name === 'string' && entry.name.trim() &&
        !Object.hasOwn(Object.prototype, entry.name) && typeof entry.item?.character?.name === 'string' &&
        typeof entry.item?.weapon?.name === 'string' && entry.item?.targetFunction?.name &&
        validKey(entry.item.miyousheKey) && !entry.item.miyousheKey?.startsWith(':') &&
        validKey(entry.rosterKey) && validKey(entry.manualRoleKey))
}

export function importRolePresets(entries, roster = useMiyousheStore(), presets = usePresetStore(), reviewGame = false) {
    const data = roster.data.value
    const owners = customOwners(data)
    for (const row of data.entries) if (row.manual) owners.set(row.presetName, row.key)
    // Establish roster entries before importing additional presets for those characters.
    const priority = entry => entry.item.miyousheKey ? 2 : entry.manualRoleKey ? 1 : 0
    const ordered = [...entries].sort((a, b) => priority(b) - priority(a))
    for (const entry of ordered) {
        const incoming = entry.item, role = incoming.character.name
        const named = presets.getPreset(entry.name)
        const game = incoming.miyousheKey && presets.allFlat.value.find(e => e.item.miyousheKey === incoming.miyousheKey)
        const key = incoming.miyousheKey || entry.manualRoleKey || entry.rosterKey || (named?.item.character.name === role && owners.get(entry.name)) ||
            data.entries.find(row => row.uid === roster.selectedUid.value && presets.getPreset(row.presetName)?.item.character.name === role)?.key
        const same = candidate => candidate?.item.character.name === role && !presetEquipmentChanges(candidate.item, incoming).length
        const customMatch = candidate => candidate && !candidate.item.miyousheKey && same(candidate) &&
            (owners.get(candidate.name) === (key || undefined) ||
                (candidate === named && !owners.has(candidate.name) && !entry.rosterKey && !incoming.miyousheKey))
        const keepGame = incoming.miyousheKey && (reviewGame || !game || same(game))
        const matched = keepGame ? game : customMatch(named) ? named : presets.allFlat.value.find(customMatch)
        let name = matched?.name || entry.name
        for (let suffix = 2; !matched && presets.getPreset(name); suffix++) name = `${entry.name} (${suffix})`
        const item = { ...incoming, name }
        if (!keepGame) delete item.miyousheKey
        presets.addOrOverwrite(name, item)
        const row = key && data.entries.find(row => row.key === key)
        if (keepGame || (entry.manualRoleKey && !row)) {
            if (row) {
                if (row.manual && keepGame) {
                    roster.linkCharacterPreset(key, row.presetName)
                    delete row.manual
                }
                if (reviewGame && keepGame) Object.assign(row, rosterEntry(key, name, item))
                else row.presetName = name
            }
            else {
                data.entries.push(rosterEntry(key, name, item))
                if (entry.manualRoleKey) owners.set(name, key)
            }
        } else if (key && row?.presetName !== name) {
            roster.linkCharacterPreset(key, name)
            owners.set(name, key)
        }
    }
    connectSavedRolePresets(roster, presets)
}
