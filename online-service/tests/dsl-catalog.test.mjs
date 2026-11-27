import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { fixture } from './helpers.mjs'
import { generateDsl, skillRows } from '../../src/algorithms/dsl-generator.mjs'
import characters from '../../src/assets/_gen_character.js'
import skillNames from '../../beta-data/dsl-skill-names.json' with { type: 'json' }

test('DSL catalogs require the admin token and preserve generated documents through updates', async t => {
    const f = await fixture()
    t.after(() => f.close())
    const token = 'synthetic-admin-token'
    const path = '/v1/dsl-catalog/Amber'
    const put = (body, adminToken = token) => f.request(path, { method:'PUT', body, token:adminToken,
        headers:{ Origin:f.base } })
    const anonymous = await f.request(path)
    assert.deepEqual(anonymous.body, { character:'Amber', revision:0, publishedAt:null, entries:[] })
    assert.equal((await put({ revision:0, entries:[] })).status, 503)
    f.config.dslAdminToken = token
    const player = await f.login()
    assert.equal((await put({ revision:0, entries:[] }, player.sessionToken)).status, 401)
    assert.equal((await f.request('/v1/admin/dsl-catalog')).status, 401)
    assert.ok((await f.request('/v1/admin/dsl-catalog', { token })).body.roles.some(role => role.id === 'Amber'))
    assert.equal((await fetch(f.base + '/admin/dsl')).status, 200)

    const { index, text, token:skill } = skillRows(characters.Amber, skillNames.Amber)[0]
    const generator = { character:'Amber', entries:[{ index, text, token:skill, reaction:'normal', value:'e', infusion:'None',
        params:Object.fromEntries(characters.Amber.configSkill.map(config => [config.name, config.default])),
        weight:1, count:1 }] }
    const document = { name:'合成手法', character:'Amber', source:generateDsl(generator), generator, weapon:null }
    const entry = { id:randomUUID(), document }
    const first = await put({ revision:0, entries:[entry] })
    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.equal(first.body.revision, 1)
    const downloaded = await f.request(path)
    assert.deepEqual(downloaded.body.entries, [entry])
    assert.equal(generateDsl(downloaded.body.entries[0].document.generator), document.source)

    const wrongRole = { ...entry, document:{ ...document, character:'Lisa' } }
    assert.equal((await put({ revision:1, entries:[wrongRole] })).status, 400)
    assert.equal((await put({ revision:1, entries:[entry, entry] })).status, 400)
    const mismatchedSource = { ...entry, document:{ ...document, source:'result = 123' } }
    assert.equal((await put({ revision:1, entries:[mismatchedSource] })).status, 400)
    assert.equal((await put({ revision:0, entries:[] })).status, 409)
    assert.equal((await f.request(path)).body.revision, 1)
    const second = await put({ revision:1, entries:downloaded.body.entries })
    assert.equal(second.body.revision, 2)
    const removed = await put({ revision:2, entries:[] })
    assert.deepEqual(removed.body.entries, [])
    assert.equal((await f.request(path)).body.revision, 3)
})
