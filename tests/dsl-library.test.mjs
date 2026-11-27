import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import characters from '../src/assets/_gen_character.js'
import weapons from '../src/assets/_gen_weapon.js'
import buffs from '../src/assets/_gen_buff.js'
import { dslShareId, exportDslDocument, importDslDocument } from '../src/algorithms/dsl-library.mjs'
import { generateDsl, skillRows } from '../src/algorithms/dsl-generator.mjs'
import { api } from '../beta-tools/runtime.mjs'

const skillNames = JSON.parse(readFileSync(new URL('../beta-data/dsl-skill-names.json', import.meta.url), 'utf8'))
const catalog = { characters, weapons, buffs, skillNames }
const defaults = configs => Object.fromEntries(configs.map(({ name, default: value }) => [name, value]))

function fixture() {
    return {
        name: '合成手法',
        character: 'Amber',
        source: 'result = 25\r\n',
        generator: null,
        weapon: null,
    }
}

test('a manual source keeps its exact newlines and omits local identifiers', () => {
    const document = fixture()
    const text = exportDslDocument({ ...document, id: 'local-entry' })
    assert.equal(JSON.parse(text).version, 1)
    assert.ok(!text.includes('local-entry'))
    assert.deepEqual(importDslDocument(text, catalog), document)
})

test('an optional description survives file exchange as plain text', () => {
    const document = { ...fixture(), description: '第一段\n<b>第二段</b>' }
    assert.deepEqual(importDslDocument(exportDslDocument(document), catalog), document)
})

test('a generated document retains the full named state and only the weapon needed to edit its overrides', () => {
    const document = fixture()
    const { index, text, token } = skillRows(characters.Amber, skillNames.Amber)[0]
    const buff = { name: 'XilonenE', config: { XilonenE: { ...defaults(buffs.XilonenE.config), elements: ['Pyro'] } } }
    document.weapon = 'PolarStar'
    document.generator = {
        character: 'Amber',
        entries: [{ index, text, token, params: defaults(characters.Amber.configSkill), reaction: 'normal', value: 'e',
            infusion: 'None', count: 2, weight: .5, state: 'burst' }],
        states: [{ name: 'burst', buffs: [buff], weapon: { stack: 0 } }],
    }
    document.source = generateDsl(document.generator)
    const fileText = exportDslDocument({ ...document, conditions: { character: { level: 90 }, enemy: { level: 90 } } })
    assert.equal(Object.hasOwn(JSON.parse(fileText).document, 'conditions'), false)
    const restored = importDslDocument(fileText, catalog)
    assert.deepEqual(restored, document)

    const input = {
        character: { name: 'Amber', level: 80, ascend: false, constellation: 0, skill1: 7, skill2: 7, skill3: 7,
            params: { Amber: defaults(characters.Amber.config) } },
        weapon: { name: 'PolarStar', level: 80, ascend: false, refine: 1, params: { PolarStar: { stack: 4 } } },
        buffs: [], enemy: null, artifact_config: null,
    }
    const evaluate = source => api.DSLInterface.run(source + '\nprint(hit1.normal.e, result)', input, [])
    const before = evaluate(document.source)
    const after = evaluate(restored.source)
    assert.equal(before.is_error, false, before.error_msg)
    assert.equal(after.is_error, false, after.error_msg)
    assert.equal(after.output, before.output)

    document.source = 'result = 0'
    assert.throws(() => importDslDocument(exportDslDocument(document), catalog), /源码与生成器配置不一致/)
})

test('malformed JSON, a new format version and unsupported record data report their cause', () => {
    assert.throws(() => importDslDocument('{', catalog), /不是有效的 JSON/)
    const file = JSON.parse(exportDslDocument(fixture()))
    const restore = () => importDslDocument(JSON.stringify(file), catalog)
    file.version = 2
    assert.throws(restore, /格式或版本不受支持/)
    file.version = 1
    file.document.description = []
    assert.throws(restore, /描述必须是文本/)
    delete file.document.description
    file.document.character = 'Unrecognized'
    assert.throws(restore, /角色无法识别/)
    file.document.character = ['Amber']
    assert.throws(restore, /角色无法识别/)
    file.document.character = 'Amber'
    file.document.generator = { character: 'Amber', entries: [], states: [
        { name: 'burst', buffs: [{ name: 'XilonenE', config: { XilonenE: { elements: [true] } } }] },
    ] }
    assert.throws(restore, /命名状态配置无效/)
})

test('DSL share import uses only a public id from the configured service', () => {
    const host = 'https://mona.example.test'
    const id = '10203040-1234-1234-1234-123412341234'
    assert.equal(dslShareId(host + ':443/s/' + id + '?tracking=chat', host), id)
    assert.throws(() => dslShareId(host + '.other.test/s/' + id, host), /当前在线服务/)
    assert.throws(() => dslShareId('https://user@mona.example.test/s/' + id, host), /当前在线服务/)
    assert.throws(() => dslShareId('blob:' + host + '/s/' + id, host), /当前在线服务/)
    assert.throws(() => dslShareId(host + '/s/' + id + '/download', host), /格式不正确/)
    assert.throws(() => dslShareId(host + '/s/' + id, ''), /设置在线服务地址/)
})
