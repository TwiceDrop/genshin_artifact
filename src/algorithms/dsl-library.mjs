import { DSL_DAMAGE_TYPES, DSL_VALUES, generateDsl, skillRows } from './dsl-generator.mjs'
import { normalizeBuffParameters } from '../../beta-data/buff-rule-registry.mjs'

const format = 'mona-dsl-entry'
const version = 1
const elements = ['Electro', 'Pyro', 'Cryo', 'Dendro', 'Geo', 'Anemo', 'Hydro', 'Physical']
const stateName = /^[A-Za-z_][A-Za-z0-9_]*$/

function fields(value, required, optional = []) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        && required.every(key => Object.hasOwn(value, key))
        && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
}

const nonempty = value => typeof value === 'string' && value.trim().length > 0
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max

function parameterValue(value, config) {
    if (typeof value === 'number' && ((config.min !== undefined && value < config.min)
        || (config.max !== undefined && value > config.max))) return false
    switch (config.type) {
        case 'bool': return typeof value === 'boolean'
        case 'int':
        case 'intInput': return Number.isInteger(value)
        case 'float':
        case 'floatInput':
        case 'floatPercentageInput': return Number.isFinite(value)
        case 'option': return integer(value, 0, config.options.length - 1)
        case 'element4': return ['Pyro', 'Cryo', 'Electro', 'Hydro'].includes(value)
        case 'element8': return elements.includes(value)
        case 'element8multi':
            return Array.isArray(value) && new Set(value).size === value.length && value.every(item => elements.includes(item))
        default: return false
    }
}

function parameters(value, configs, partial = false) {
    const names = configs.map(config => config.name)
    return fields(value, partial ? [] : names, partial ? names : [])
        && configs.every(config => !Object.hasOwn(value, config.name) || parameterValue(value[config.name], config))
}

function configured(value, name, configs) {
    return configs.length === 0 ? value === 'NoConfig'
        : fields(value, [name]) && parameters(value[name], configs)
}

function validBuff(value, catalog) {
    if (!fields(value, ['name', 'config']) || typeof value.name !== 'string' || !Object.hasOwn(catalog.buffs, value.name)
        || !configured(value.config, value.name, catalog.buffs[value.name].config)) return false
    normalizeBuffParameters(value.name, value.config === 'NoConfig' ? {} : value.config[value.name])
    return true
}

function validateGenerator(generator, character, weapon, catalog) {
    if (!fields(generator, ['character', 'entries'], ['states']) || generator.character !== character.name
        || !Array.isArray(generator.entries) || (Object.hasOwn(generator, 'states') && !Array.isArray(generator.states))) {
        throw new Error('DSL 生成器配置无效')
    }
    const names = new Set()
    for (const state of generator.states ?? []) {
        if (!fields(state, ['name', 'buffs'], ['character', 'weapon']) || !nonempty(state.name)
            || !stateName.test(state.name) || names.has(state.name) || !Array.isArray(state.buffs)
            || !state.buffs.every(buff => validBuff(buff, catalog))
            || (Object.hasOwn(state, 'character') && !parameters(state.character, character.config, true))
            || (Object.hasOwn(state, 'weapon') && (!weapon || !parameters(state.weapon, weapon.configs ?? [], true)))) {
            throw new Error('DSL 命名状态配置无效')
        }
        names.add(state.name)
    }
    const skills = skillRows(character, catalog.skillNames[character.name])
    for (const entry of generator.entries) {
        if (!fields(entry, ['index', 'text', 'token', 'params', 'reaction', 'value', 'infusion', 'count', 'weight'], ['state'])
            || !skills.some(skill => skill.index === entry.index && skill.token === entry.token && skill.text === entry.text)
            || !parameters(entry.params, character.configSkill)
            || !DSL_DAMAGE_TYPES.some(type => type.key === entry.reaction) || !DSL_VALUES.some(type => type.key === entry.value)
            || (entry.infusion !== 'None' && !elements.slice(0, -1).includes(entry.infusion))
            || !Number.isInteger(entry.count) || entry.count < 0 || !Number.isFinite(entry.weight) || entry.weight < 0
            || (Object.hasOwn(entry, 'state') && !names.has(entry.state))) {
            throw new Error('DSL 技能段配置无效')
        }
    }
}

export function validateDslDocument(document, catalog) {
    if (!fields(document, ['name', 'character', 'source', 'generator', 'weapon'], ['description']) || !nonempty(document.name)
        || !nonempty(document.source)) throw new Error('DSL 条目缺少名称或源码')
    if (Object.hasOwn(document, 'description') && typeof document.description !== 'string') {
        throw new Error('DSL 条目描述必须是文本')
    }
    if (typeof document.character !== 'string' || !Object.hasOwn(catalog.characters, document.character)
        || !Object.hasOwn(catalog.skillNames, document.character)) {
        throw new Error('DSL 条目的角色无法识别')
    }
    const character = catalog.characters[document.character]
    const weapon = document.weapon
    if (weapon !== null && (typeof weapon !== 'string' || !Object.hasOwn(catalog.weapons, weapon)
        || catalog.weapons[weapon].type !== character.weapon || document.generator === null)) {
        throw new Error('DSL 武器效果配置无效')
    }
    if (document.generator !== null) {
        validateGenerator(document.generator, character, weapon === null ? null : catalog.weapons[weapon], catalog)
        if (generateDsl(document.generator) !== document.source) throw new Error('DSL 源码与生成器配置不一致')
    }
    return document
}

export function exportDslDocument(document) {
    const { name, description, character, source, generator, weapon } = document
    return JSON.stringify({ format, version, document: { name, description, character, source, generator, weapon } }, null, 2) + '\n'
}

export function importDslDocument(text, catalog) {
    let file
    try {
        file = JSON.parse(text)
    } catch (error) {
        throw new Error('DSL 文件不是有效的 JSON', { cause: error })
    }
    if (!fields(file, ['format', 'version', 'document']) || file.format !== format || file.version !== version) {
        throw new Error('DSL 文件格式或版本不受支持')
    }
    return validateDslDocument(file.document, catalog)
}

export function dslShareId(link, serviceUrl) {
    if (!serviceUrl) throw new Error('请先设置在线服务地址')
    let url
    try { url = new URL(link) }
    catch { throw new Error('分享链接格式不正确') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.origin !== new URL(serviceUrl).origin) {
        throw new Error('请使用当前在线服务生成的分享链接')
    }
    const match = /^\/s\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.exec(url.pathname)
    if (!match) throw new Error('分享链接格式不正确')
    return match[1].toLowerCase()
}
