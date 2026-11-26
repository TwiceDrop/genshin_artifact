import { validateCatalogAxis, validateLegacyAxis } from './axis-format.mjs'

// Only fields belonging to the wire format cross the public share boundary.
// The file importer also accepts additional properties on otherwise valid axes.
function fields(value, names) {
    const result = {}
    for (const key of names) {
        if (!Object.hasOwn(value, key)) continue
        const item = value[key]
        if (!['string', 'number', 'boolean'].includes(typeof item)) throw new Error('轴字段类型无效：' + key)
        result[key] = item
    }
    return result
}

const coverageFields = {
    fanfare: ['startMs', 'endMs'], skirkC2: ['startMs', 'endMs'],
    vodyFlat: ['startMs', 'endMs', 'frontUses', 'backUses'],
    escoFlat: ['startMs', 'endMs', 'uses'], deathCrossing: ['startNormal', 'uses'],
}
const legacyEventFields = {
    switch: [], cast: ['action'], hit: ['action', 'label', 'weakpoint'],
    heal: ['recipients', 'healing', 'label'], reaction: ['reaction', 'label'],
    hp_change: ['ratio', 'change', 'recipients', 'label'], state: ['state', 'durationMs'],
    sprint: [], aim: [], pickup: [],
}

export function sharedAxis(input, catalog) {
    const actions = input.format === 'mona-action-axis'
    const axis = fields(input, ['format', 'formatVersion', 'id', 'title', 'initialActiveSlot', 'endHit',
        ...(actions ? ['rulesVersion'] : ['mechanics', 'revision', 'durationMs'])])
    axis.members = input.members.map(member => fields(member, ['slot', 'character']))
    const roles = new Map(axis.members.map(member => [member.slot, member.character]))
    axis.timeline = input.timeline.map(row => {
        const event = fields(row, ['id', 'kind', 'actor', 'timeMs'])
        if (actions && row.kind === 'action') {
            Object.assign(event, fields(row, ['action']))
            const role = roles.get(row.actor)
            const entry = Object.hasOwn(catalog, role) && catalog[role].find(action => action.id === row.action)
            if (row.params) event.params = fields(row.params, (entry?.parameters || []).map(parameter => parameter.key))
        }
        if (!actions) {
            Object.assign(event, fields(row, legacyEventFields[row.kind] || []))
            if (row.repeat) event.repeat = fields(row.repeat, ['count', 'intervalMs'])
        }
        if (row.when) event.when = fields(row.when, ['slot', 'constellationAtLeast', ...(actions ? ['otherwiseTimeMs'] : [])])
        return event
    })
    if (actions) {
        validateCatalogAxis(axis, catalog)
        if (!axis.timeline.some(row => row.kind === 'action')) throw new Error('请先添加动作')
    } else {
        axis.coverage = Object.fromEntries(Object.entries(coverageFields).map(([key, names]) => [key, fields(input.coverage[key], names)]))
        validateLegacyAxis(axis)
    }
    return axis
}

export function axisSummary(axis) {
    const legacy = axis.format === 'mona-team-axis'
    const count = legacy ? axis.timeline.length : axis.timeline.filter(row => row.kind === 'action').length
    return count + (legacy ? ' 个事件' : ' 个动作') + (axis.durationMs === undefined ? '' : ' · ' + axis.durationMs / 1000 + 's')
}
