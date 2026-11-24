import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import targets from '@/assets/_gen_tf'
import locale from '@/i18n/generated/zh-cn.json'
import { createMysConverter } from '@/import/miyoushe.mjs'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { uidImportSession } from './uid-import-session'
import { artifactFingerprint } from './miyoushe.mjs'
import { selectUidInventory } from './uid-inventory.mjs'
import { useMona } from '@/wasm/mona'

export function saveGameSnapshot(snapshot, accountId, source, checkActive, preserveEquipped = false, session = uidImportSession(accountId, checkActive)) {
    return savePreparedSnapshot(String(snapshot.role.uid), () => snapshot, source, session, preserveEquipped)
}

export async function savePreparedSnapshot(uid, build, source, session, preserveEquipped = false, warehouse = []) {
    const mona = await useMona()
    session.check()
    const converter = createMysConverter({ characters, weapons, artifacts, targets, locale,
        inferAscend(c, w, hp) {
            if (!Number.isFinite(hp)) return undefined
            const values = [false, true].map(ascend => mona.CommonInterface.get_attribute({ character: { ...c, ascend }, weapon: w, artifacts: [], buffs: [], artifact_config: null }).hp['角色基础生命'])
            const errors = values.map(n => Math.abs(n - hp))
            if (Math.min(...errors) > 3 || Math.abs(values[0] - values[1]) < 1) return undefined
            return errors[1] < errors[0]
        },
    })
    return session.run(uid, source, async draft => {
        const snapshot = await build(draft)
        session.check()
        const result = useMiyousheStore().importSnapshot(snapshot, converter, source, preserveEquipped, draft)
        result.added += mergeUidWarehouse(uid, warehouse, draft)
        return result
    })
}

// GOOD includes unequipped pieces. Count identical pieces separately and reuse the ones just matched on the characters.
export function mergeUidWarehouse(uid, pieces, { roster, presets, inventory }) {
    if (!pieces.length) return 0
    const data = roster.data.value, pool = new Map()
    for (const piece of selectUidInventory(uid, data, presets.presets.value, inventory.artifacts.value, true)) {
        const key = artifactFingerprint(piece)
        if (!pool.has(key)) pool.set(key, [])
        pool.get(key).push(piece.id)
    }
    const groups = data.uidArtifactIds ??= {}, owned = new Set(groups[uid])
    let added = 0
    for (const piece of pieces) {
        let id = pool.get(artifactFingerprint(piece))?.pop()
        if (id === undefined) { id = inventory.addArtifact(piece); added++ }
        owned.add(id)
    }
    groups[uid] = [...owned]
    return added
}
