import test from 'node:test'
import assert from 'node:assert/strict'
import { appendBackup, backupCounts, captureBackup, validateBackup } from '../src/store/account-backup.mjs'

function source() {
    return new Map(Object.entries({
        mona_accounts: { currentAccountId: 2, allAccounts: [{ id: 1, name: '同名' }, { id: 2, name: '同名' }] },
        mona_account_artifacts_2: { flower: [{ id: 13 }, { id: 14 }] },
        mona_account_presets_2: { 测试: { item: { character: { level: 88 }, weapon: { level: 80 }, artifactIds: [13] } } },
        mona_account_kumi_2: [{ id: 3, artifactIds: [13] }],
        mona_account_miyoushe_2: { snapshots: { '100000001': {} }, selectedUid: '100000001', entries: [{ uid: '100000002' }],
            uidArtifactIds: { '100000001': [13] }, importRecords: [{ id: 'synthetic' }] },
        mona_account_comparison_settings_2: { mode: 'session' },
        mona_account_team_dps_configurations_2: { entries: [{ key: 5, axis: { timeline: [] } }], nextId: 6, selectedId: 5 },
        mona_account_team_dps_tasks_2: { 5: { '100000001': { fields: { members: [1, 2, 3, 4] } } } },
        mona_account_calculation_history_2: { nextId: 8, entries: [{ id: 7, accountId: 2, kind: 'team', status: 'completed' }] },
        mona_account_calculation_history_2_7: { output: { dps: 411 }, items: { 13: { id: 13 } }, axis: { timeline: [] } },
        mona_cloud_profiles_v1: { sessionToken: 'synthetic-private' }
    }))
}
const capture = records => captureBackup(key => Promise.resolve(records.get(key)), '7.2.05', {})

test('all accounts round-trip with frozen results, axis tasks, inventory, UIDs and internal IDs intact', async () => {
    const original = source(), pack = validateBackup(JSON.parse(JSON.stringify(await capture(original))))
    assert.equal(pack.currentAccountId, 2)
    assert.deepEqual(backupCounts(pack.accounts[1]), { uids: 2, artifacts: 2, axes: 1, history: 1 })
    assert.ok(!JSON.stringify(pack).includes('synthetic-private'))
    const target = new Map([['mona_accounts', { currentAccountId: 1, allAccounts: [{ id: 1, name: '同名' }] }],
        ['mona_account_artifacts_1', { flower: [{ id: 13, level: 20 }] }], ['mona_account_calculation_history_8_70', { old: true }]])
    const before = structuredClone(target)
    const entries = appendBackup(pack, target.get('mona_accounts'), [...target.keys()])
    for (const [key, value] of entries) target.set(key, value)
    assert.deepEqual(target.get('mona_accounts').allAccounts.map(a => a.id), [1, 9, 10])
    assert.equal(target.get('mona_accounts').currentAccountId, 1)
    assert.deepEqual(target.get('mona_account_artifacts_1'), before.get('mona_account_artifacts_1'))
    assert.deepEqual(target.get('mona_account_calculation_history_8_70'), { old: true })
    const restored = (await capture(target)).accounts[2]
    assert.deepEqual(restored.data, pack.accounts[1].data)
    assert.deepEqual(restored.history.records[0].detail, pack.accounts[1].history.records[0].detail)
    assert.equal(restored.history.records[0].row.accountId, 10)
    assert.throws(() => appendBackup(pack, target.get('mona_accounts'), [...target.keys()]), /已导入/)
})

test('missing details, unsupported versions, duplicate IDs and credential fields stop before restore', async () => {
    const saved = source(), pack = await capture(saved)
    saved.delete('mona_account_calculation_history_2_7')
    await assert.rejects(capture(saved), /7 缺少详情/)
    assert.throws(() => validateBackup({ ...pack, version: 2 }), /版本/)
    assert.throws(() => validateBackup({ ...pack, accounts: [pack.accounts[0], pack.accounts[0]] }), /标识/)
    pack.accounts[0].data.miyoushe = { sessionToken: 'synthetic-private' }
    assert.throws(() => validateBackup(pack), /凭据/)
})
