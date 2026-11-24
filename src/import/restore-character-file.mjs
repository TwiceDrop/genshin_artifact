import { ElMessageBox } from 'element-plus'
import { goodRosterSnapshot, validateGoodRoster } from '@/import/good-roster.mjs'
import { convertGoodArtifacts } from '@/import/good'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import targets from '@/assets/_gen_tf'
import { saveGameSnapshot, savePreparedSnapshot } from '@/import/save-game-snapshot.mjs'
import { uidImportSession } from './uid-import-session'
import { existingRosterKey } from './uid-import-review.mjs'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import locale from '@/i18n/generated/zh-cn.json'
import { recordUsage } from '@/usage-stats/index.mjs'
import { importUidPackage } from '@/import/uid-package.mjs'
import { importRolePresets, isRolePresetFile } from './role-presets.js'

async function restoreGood(file, store, source, session) {
    let uid = validateGoodRoster(file)
    session.check()
    try {
        if (!uid) {
            const input = await ElMessageBox.prompt('导入到原神 UID', '导入 GOOD v3', {
                inputValue: store.selectedUid.value || '', inputPattern: /^\d{8,10}$/, inputErrorMessage: '请输入 8 至 10 位原神 UID',
            })
            uid = input.value
            session.check()
        }
        const warehouse = file.artifacts ? Object.values(convertGoodArtifacts(file)).flat() : []
        return await savePreparedSnapshot(uid, async draft => {
            const traveler = await travelerForGood(file, uid, draft.roster.data.value.entries)
            return goodRosterSnapshot(file, uid, { traveler, catalog: { characters, weapons, artifacts, locale },
                data: draft.roster.data.value, presets: draft.presets.presets.value, inventory: draft.inventory.artifacts.value,
                convertArtifacts: convertGoodArtifacts })
        }, source, session, file.artifacts == null, warehouse)
    } catch (e) {
        if (e === 'cancel' || e === 'close') return
        throw e
    }
}

async function travelerForGood(file, uid, entries) {
    if (!file.characters.some(c => c?.key === 'Traveler')) return
    const saved = entries.find(e => e.uid === uid && [10000005, 10000007].includes(e.id))
    if (saved) return saved.id === 10000005 ? 'Aether' : 'Lumine'
    const input = await ElMessageBox.prompt('此 UID 的旅行者是空还是荧？', '导入 GOOD v3', {
        inputPattern: /^(空|荧)$/, inputErrorMessage: '请输入空或荧',
    })
    return input.value === '空' ? 'Aether' : 'Lumine'
}

export async function restoreCharacterFile(file, accountId, checkAccount) {
    const store = useMiyousheStore()
    const session = uidImportSession(accountId, checkAccount)
    const save = snapshot => saveGameSnapshot(snapshot, accountId, file.name, checkAccount, false, session)
    if (file.size > 50 * 1024 * 1024) throw new Error('文件超过 50 MB')
    const raw = JSON.parse(await file.text())
    if (isRolePresetFile(raw)) {
        const groups = new Map()
        for (const entry of raw) {
            const keys = [entry.item.miyousheKey, entry.rosterKey, entry.manualRoleKey].filter(Boolean)
            const ids = new Set(keys.map(key => key.split(':')[0]))
            if (ids.size > 1) throw new Error('预设的角色 UID 与归属 UID 不一致')
            const uid = [...ids][0] || ''
            if (!groups.has(uid)) groups.set(uid, [])
            groups.get(uid).push(entry)
        }
        for (const [uid, list] of [...groups].sort(([a], [b]) => Number(!!a) - Number(!!b))) await session.run(uid, file.name, ({ roster, presets }) => {
            const resolve = key => existingRosterKey(key, roster.data.value.entries)
            importRolePresets(list.map(e => ({ ...e, rosterKey: resolve(e.rosterKey), manualRoleKey: resolve(e.manualRoleKey),
                item: { ...e.item, miyousheKey: resolve(e.item.miyousheKey) } })), roster, presets, true)
            return { presets: list.length }
        })
        recordUsage('action.uid-data-restore')
        return { presets: raw.length }
    }
    if (raw?.format === 'GOOD') {
        const result = await restoreGood(raw, store, file.name, session)
        if (result) recordUsage('action.uid-data-restore')
        return result
    }
    if (raw?.format === 'mona-uid') {
        return session.run(String(raw.uid), file.name, ({ roster, inventory, presets }) => {
            const imported = importUidPackage(raw, { data: roster.data.value, presets: presets.presets.value, inventory: inventory.artifacts.value,
                addArtifact: a => inventory.addArtifact(a), updateArtifact: (id, a) => inventory.updateArtifact(id, a),
                addPreset: (name, item) => presets.addOrOverwrite(name, item), catalog: { characters, weapons, artifacts, targets } })
            roster.data.value = imported.data
            return { imported: imported.imported, added: imported.added, reused: raw.artifacts.length - imported.added }
        })
    }
    const snapshots = Array.isArray(raw) ? raw : [raw]
    if (snapshots.length > 10) throw new Error('单次最多恢复 10 个 UID')
    let result
    for (const snapshot of snapshots) result = await save(snapshot)
    recordUsage('action.uid-data-restore')
    return result
}
