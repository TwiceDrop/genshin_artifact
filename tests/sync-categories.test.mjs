import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSyncSettings, normalizeSyncSettings, mergeForUpload, mergeForDownload, hasDisabledProfileFields } from '../src/cloud/sync-categories.mjs'
import { createProfileSync } from '../src/cloud/profile-sync-core.mjs'

const KEYS = ['name', 'artifacts', 'presets', 'kumi', 'miyoushe', 'comparisonSettings', 'teamDpsConfigurations', 'teamDpsTasks']
const make = tag => Object.fromEntries(KEYS.map(key => [key, key === 'name' ? tag : { from: tag, key }]))

test('默认全开，缺项补齐，只有明确 false 才关闭', () => {
    assert.deepEqual(Object.values(defaultSyncSettings()), Array(6).fill(true))
    const settings = normalizeSyncSettings({ artifacts: false, uid: 0, bogus: false })
    assert.equal(settings.artifacts, false)
    assert.equal(settings.uid, true)
    assert.equal('bogus' in settings, false)
    assert.deepEqual(normalizeSyncSettings(null), defaultSyncSettings())
})

test('上传：关闭的类别取云端原值，字段齐全；全开时等于本机', () => {
    const local = make('local'), remote = make('remote')
    const merged = mergeForUpload(local, remote, { artifacts: false, characters: false })
    assert.deepEqual(Object.keys(merged).sort(), [...KEYS].sort())
    for (const key of ['artifacts', 'presets', 'kumi', 'comparisonSettings']) assert.deepEqual(merged[key], remote[key])
    for (const key of ['name', 'miyoushe', 'teamDpsConfigurations', 'teamDpsTasks']) assert.deepEqual(merged[key], local[key])
    assert.deepEqual(mergeForUpload(local, remote, defaultSyncSettings()), local)
    assert.equal(local.artifacts.from, 'local')
})

test('上传：云端还没有版本时关闭的类别为 null（档案校验允许）', () => {
    assert.equal(mergeForUpload(make('local'), null, { teams: false }).teamDpsTasks, null)
})

test('拉取：关闭的类别保留本机，名称始终取云端', () => {
    const local = make('local'), remote = make('remote')
    const merged = mergeForDownload(local, remote, { uid: false, teams: false })
    assert.deepEqual(merged.miyoushe, local.miyoushe)
    assert.deepEqual(merged.teamDpsTasks, local.teamDpsTasks)
    assert.deepEqual(merged.artifacts, remote.artifacts)
    assert.equal(merged.name, 'remote')
    assert.equal(hasDisabledProfileFields({ cookie: false, history: false }), false)
})

function harness(initialLocal, remoteRevision) {
    const store = new Map(), puts = []
    const state = { local: initialLocal, remote: remoteRevision }
    const api = async (path, method = 'GET', body) => {
        if (path === 'config') return { url: 'https://x', user: { id: 'u' } }
        if (method === 'PUT') { puts.push(body); return { revision: { revision: state.remote.revision + 1 } } }
        if (path === 'v1/profiles' && method === 'POST') return { profile: { id: 'p' } }
        if (path === 'v1/profiles?includeDeleted=true') return { profiles: [] }
        if (path === 'v1/profiles/p') return { profile: { revision: state.remote.revision, deletedAt: null }, revision: state.remote }
        throw new Error('unexpected ' + path)
    }
    let n = 0
    const sync = createProfileSync({
        api, currentAccountId: () => 1, accountNames: () => ({}), canRestore: () => true,
        storage: { getItem: async key => store.get(key), setItem: async (key, value) => { store.set(key, JSON.parse(JSON.stringify(value))) }, subscribeMutations: () => () => {} },
        capture: async () => JSON.parse(JSON.stringify(state.local)),
        restore: async (id, data) => { state.local = data },
        createLocal: async () => {}, uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    })
    return { sync, puts, state, store }
}

test('同步流程：关闭圣遗物后上传带云端原值，并记录上次同步时间', async () => {
    const h = harness(make('local'), { revision: 3, schemaVersion: 1, data: make('remote') })
    await h.sync.setSyncSettings({ artifacts: false })
    await h.sync.createCurrent()
    assert.equal(h.puts.length, 1)
    assert.deepEqual(h.puts[0].data.artifacts, make('remote').artifacts)
    assert.deepEqual(h.puts[0].data.presets, make('local').presets)
    assert.equal(typeof h.store.get('mona_cloud_profiles_v1').bindings[0].lastSyncedAt, 'string')
    assert.equal(h.store.get('mona_cloud_profiles_v1').syncSettings.artifacts, false)
})

test('同步流程：关闭圣遗物后拉取云端新版本不覆盖本机圣遗物', async () => {
    const h = harness(make('local'), { revision: 1, schemaVersion: 1, data: make('remote') })
    await h.sync.createCurrent()
    await h.sync.setSyncSettings({ artifacts: false })
    h.state.remote = { revision: 9, schemaVersion: 1, data: make('remote9') }
    await h.sync.tick()
    assert.equal(h.state.local.name, 'remote9')
    assert.deepEqual(h.state.local.presets, make('remote9').presets)
    assert.deepEqual(h.state.local.artifacts, make('local').artifacts)
})
