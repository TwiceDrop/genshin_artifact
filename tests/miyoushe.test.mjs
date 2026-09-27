import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createMysConverter, mergeEquipped, artifactFingerprint } from '../src/import/miyoushe.mjs'
import { MysClient, ds } from '../server/mys.mjs'
import { createLocalServer } from '../server/local.mjs'
import ts from 'typescript'

const meta = name => JSON.parse(fs.readFileSync(new URL(`../src/assets/_gen_${name}.js`, import.meta.url), 'utf8').replace(/^.*\nexport default /, '').trim().replace(/;$/, ''))
const characters = meta('character'), weapons = meta('weapon'), artifacts = meta('artifact'), targets = meta('tf')
const locale = JSON.parse(fs.readFileSync(new URL('../src/i18n/generated/zh-cn.json', import.meta.url)))
const converter = createMysConverter({ characters, weapons, artifacts, targets, locale })
// Exercise the actual app's TS conversion boundary, not a parallel test-only converter.
const converterSource = fs.readFileSync(new URL('../src/utils/converter.ts', import.meta.url), 'utf8').replace("import artifactsData from '@/assets/_gen_artifact'", `const artifactsData = ${JSON.stringify(artifacts)}`)
const appConverter = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(converterSource, { compilerOptions: { module: ts.ModuleKind.ES2020 } }).outputText).toString('base64')}`)
const setName = Object.keys(artifacts).find(k => artifacts[k].name2 === 'GladiatorFinale') || Object.keys(artifacts).find(k => artifacts[k].maxStar === 5 && artifacts[k].flower)
function fixture() {
    const set = artifacts[setName]
    return { base: { id: 10000021, name: locale[characters.Amber.nameLocale], element: 'Pyro', level: 90, actived_constellation_num: 3 },
        weapon: { name: locale[weapons.HuntersBow.nameLocale], level: 20, promote_level: 1, affix_level: 1 },
        skills: [1, 2, 3].map((i, n) => ({ skill_type: 1, name: locale[characters.Amber[`skillName${i}`]], level: [8, 8, 11][n] })),
        relics: [{ id: 123, pos: 1, name: locale[set.flower.text], rarity: 5, level: 20, main_property: { property_type: 2, value: '4,780' }, sub_property_list: [{ property_type: 20, value: '10.5%' }, { property_type: 22, value: '21.0%' }, { property_type: 6, value: '10.5%' }, { property_type: 28, value: '21' }] }],
    }
}
test('convert real Mona catalog: equipment, percentage units, displayed talent levels, and boundary ascension', () => {
    const raw = fixture(), untouched = structuredClone(raw), result = converter.character(raw, '123456789')
    assert.deepEqual(raw, untouched)
    assert.equal(result.preset.character.skill3, 10) // displayed Lv11 -> index10; no second constellation adjustment
    assert.equal(result.preset.weapon.ascend, true)
    assert.equal(result.gear[0].setName, setName)
    assert.equal(result.gear[0].mainTag.value, 4780)
    assert.equal(result.gear[0].normalTags[0].value, .105)
    raw.base.level = 80
    assert.throws(() => converter.character(raw, '123456789'), /突破/)
    raw.base.promote_level = 6
    assert.equal(converter.character(raw, '123456789').preset.character.ascend, true)
    raw.weapon.promote_level = 0
    assert.equal(converter.character(raw, '123456789').preset.weapon.ascend, false)
})
test('unknown data and incomplete talents are not turned into plausible defaults', () => {
    const raw = fixture()
    raw.weapon.name = '未来武器'
    assert.throws(() => converter.character(raw, '123456789'), /未知武器/)
    assert.throws(() => converter.artifact({ ...fixture().relics[0], name: '未来圣遗物' }), /未知圣遗物/)
    const skill = fixture(); skill.skills.pop()
    assert.throws(() => converter.character(skill, '123456789'), /天赋/)
    const bad = fixture().relics[0]; bad.sub_property_list[0].value = ''
    assert.throws(() => converter.artifact(bad), /属性/)
})
test('inventory import is idempotent, preserves identical item multiplicity and does not mutate switched gear', () => {
    const one = converter.character(fixture(), '123456789'), two = { ...one, key: 'second' }
    const inventory = [], add = a => { const id = inventory.length + 1; inventory.push({ ...structuredClone(a), id }); return id }
    const first = mergeEquipped([one, two], inventory, add)
    assert.equal(first.added, 2); assert.notEqual(first.equipment[one.key][0], first.equipment[two.key][0])
    const repeat = mergeEquipped([two, one], inventory, add, first.equipment)
    assert.equal(repeat.added, 0); assert.equal(repeat.reused, 2)
    assert.deepEqual(repeat.equipment, first.equipment)
    const original = structuredClone(inventory)
    const changed = structuredClone(one); changed.gear[0].normalTags[0].value = .14
    const third = mergeEquipped([changed, two], inventory, add, repeat.equipment)
    assert.equal(third.added, 1); assert.deepEqual(inventory.slice(0, 2), original)
    const reordered = structuredClone(one.gear[0]); reordered.normalTags.reverse()
    assert.equal(artifactFingerprint(reordered), artifactFingerprint(one.gear[0]))
})
test('record DS covers exactly the transmitted JSON and query', () => {
    const body = '{"role_id":"123456789"}', query = 'game_biz=hk4e_cn'
    const [t, r, hash] = ds(body, query).split(',')
    assert.equal(hash, createHash('md5').update(`salt=xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs&t=${t}&r=${r}&b=${body}&q=${query}`).digest('hex'))
})
test('every generated set crosses the app/WASM boundary; imported Sandrone equipment computes a real curve', async () => {
    for (const [key, data] of Object.entries(artifacts)) {
        assert.equal(appConverter.convertArtifactName(key), data.name2)
        assert.equal(appConverter.convertArtifactNameBack(data.name2), key)
    }
    const { bindings: b } = await import('../mona_wasm/pkg/bindings.js')
    const bridge = await import('../mona_wasm/pkg/mona_wasm_bg.js')
    b.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm', import.meta.url))), { './mona_wasm_bg.js': bridge }).exports)
    const snapshot = JSON.parse(fs.readFileSync(new URL('./fixtures/miyoushe-synthetic.json', import.meta.url)))
    const e = converter.character(snapshot.characters[0], snapshot.role.uid)
    const input = { character: e.preset.character, weapon: e.preset.weapon, artifacts: e.gear.map((a, id) => appConverter.convertArtifact({ ...a, id })), buffs: [], artifact_config: null, enemy: null,
        skill: { index: 5, config: { Sandrone: Object.fromEntries(characters.Sandrone.configSkill.map(c => [c.name, c.default])) } } }
    assert.equal(input.artifacts.filter(a => a.set_name === 'ScarletProof').length, 5)
    const analysis = b.K2.get_damage_analysis(input, null)
    assert.ok(analysis.direct_stellarconduct.expectation > 0)
    const { createDamageEvaluator, computeCurve } = await import('../src/algorithms/stat-gain/curve.mjs')
    const stats = ['CriticalRate', 'CriticalDamage', 'ATKPercentage', 'ElementalMastery']
    const evaluator = createDamageEvaluator({ CalculatorInterface: b.K2 }, input, 'direct_stellarconduct', null, stats, 'average')
    const curve = computeCurve(evaluator.evaluate, { stats })
    assert.equal(curve.baseline, analysis.direct_stellarconduct.expectation)
    assert.ok(curve.points[20].damage > curve.baseline)
})
test('owned roster uses authenticated list + batched details; rejects unbound UID and reports missing entries', async () => {
    const calls = []
    const client = new MysClient(async (url, options) => {
        calls.push({ url, options })
        const data = url.includes('getUserGameRoles') ? { list: [{ game_uid: '123456789', region: 'cn_gf01', nickname: '测试' }] }
            : url.endsWith('/getFp') ? { code: 200, device_fp: '0123456789' }
            : url.endsWith('/character/list') ? { list: [{ id: 10000021 }, { id: 10000022 }] } : { list: [fixture()] }
        return { ok: true, json: async () => ({ retcode: 0, data }) }
    })
    client.cookie = 'test-cookie'
    await client.getRoles()
    await assert.rejects(client.snapshot('987654321'), /绑定/)
    const snapshot = await client.snapshot('123456789')
    assert.equal(snapshot.total, 2); assert.equal(snapshot.characters.length, 1); assert.equal(snapshot.failures.length, 1)
    assert.equal(calls[1].options.headers.Cookie, undefined)
    assert.equal(JSON.parse(calls[1].options.body).device_id, client.device)
    const recordCalls = calls.filter(c => c.url.includes('/character/'))
    assert.equal(recordCalls.length, 2)
    for (const call of recordCalls) {
        assert.equal(call.options.headers.Cookie, 'test-cookie')
        assert.equal(call.options.headers['x-rpc-device_fp'], '0123456789')
        assert.equal(call.options.headers['x-rpc-device_id'], client.device)
    }
    assert.deepEqual(JSON.parse(recordCalls[1].options.body).character_ids, [10000021, 10000022])
    await client.snapshot('123456789')
    assert.equal(calls.filter(c => c.url.endsWith('/getFp')).length, 1)
    assert.ok(!JSON.stringify(snapshot).includes('test-cookie'))
    client.clear(); assert.equal(client.cookie, ''); assert.equal(client.deviceFp, '')
})
test('device rejection stops import even when getFp returns a fallback fingerprint with retcode zero', async () => {
    const calls = []
    const client = new MysClient(async url => {
        calls.push(url)
        return { ok: true, json: async () => ({ retcode: 0, data: { code: 403, device_fp: '0123456789' } }) }
    })
    client.cookie = 'private-cookie'; client.roles = [{ uid: '123456789', region: 'cn_gf01' }]
    await assert.rejects(client.snapshot('123456789'), /设备初始化失败（403）/)
    assert.equal(calls.length, 1); assert.ok(calls[0].endsWith('/getFp')); assert.equal(client.deviceFp, '')
})
test('upstream errors identify the failed stage without relaying response secrets or mislabeling every error as verification', async () => {
    let retcode = 5003
    const client = new MysClient(async () => ({ ok: true, json: async () => ({ retcode, message: 'private-cookie https://example.com/?stoken=secret', data: { token: 'private-token' } }) }))
    await assert.rejects(client.request('https://api-takumi-record.mihoyo.com', '/game_record/app/genshin/api/character/list'), e => {
        assert.match(e.message, /角色列表读取失败（米游社 5003）/)
        assert.doesNotMatch(e.message, /private|stoken|example/)
        return true
    })
    retcode = -100
    await assert.rejects(client.request('https://api-takumi-record.mihoyo.com', '/game_record/app/genshin/api/character/detail'), /角色详情读取失败.*凭证已失效/)
    retcode = 1034
    await assert.rejects(client.request('https://api-takumi-record.mihoyo.com', '/game_record/app/genshin/api/character/list'), /米游社要求验证/)
})
test('local API rejects foreign origins and unauthenticated requests; logout invalidates session', async t => {
    let cleared = 0
    const server = createLocalServer({ clientFactory: () => ({ createQR: async () => ({ url: 'https://user.mihoyo.com/qr', expiresAt: Date.now() + 120000 }), clear: () => cleared++, pollQR: async () => ({ status: 'Waiting' }), getRoles: async () => [] }) })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}/api/mys/`
    const headers = { 'X-Mona-Local': '1' }
    assert.equal((await fetch(base + 'login', { method: 'POST' })).status, 403)
    assert.equal((await fetch(base + 'login', { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' } })).status, 403)
    assert.equal((await fetch(base + 'roles', { headers })).status, 401)
    const login = await fetch(base + 'login', { method: 'POST', headers })
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly; SameSite=Strict/)
    headers.Cookie = cookie.split(';')[0]
    assert.equal((await fetch(base + 'poll', { method: 'POST', headers })).status, 200)
    assert.equal((await fetch(base + 'logout', { method: 'POST', headers })).status, 200)
    assert.equal(cleared, 1)
    assert.equal((await fetch(base + 'roles', { headers })).status, 401)
})
