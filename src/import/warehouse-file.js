import { ElMessageBox } from 'element-plus'
import { shallowRef } from 'vue'
import { positions } from '@/constants/artifact'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { importMonaJson } from '@/utils/artifacts'
import { convertGoodWarehouse } from './good'
import { uidImportSession } from './uid-import-session'
import { mergeUidWarehouse } from './save-game-snapshot.mjs'
import { useAccountStore } from '@/store/pinia/account'

/** @type {import('vue').ShallowRef<{ file: unknown, accountId: number, reloadGeneration: number } | null>} */
export const pendingWarehouseImport = shallowRef(null)

export function isWarehouseFile(file) {
    if (file?.format === 'GOOD') {
        const characters = file.characters
        return Array.isArray(file.artifacts) && (characters == null || Array.isArray(characters) && characters.length === 0)
    }
    return file?.format !== 'mona-uid' && positions.some(position => Array.isArray(file?.[position]))
}

export async function importWarehouseFile(file, removeUnseen, backup, cleanup, dialogs = ElMessageBox) {
    if (file?.format !== 'GOOD') return importMonaJson(file, removeUnseen, backup, cleanup)
    const { artifacts, failures } = convertGoodWarehouse(file)
    const pieces = Object.values(artifacts).flat()
    const session = uidImportSession(useAccountStore().currentAccountId.value, undefined, dialogs)
    const uid = file.metadata?.uid ?? (await dialogs.prompt('导入到原神 UID', '导入 GOOD 圣遗物', {
        inputValue: useMiyousheStore().selectedUid.value || '', inputPattern: /^\d{8,10}$/, inputErrorMessage: '请输入 8 至 10 位原神 UID'
    })).value
    const result = await session.run(String(uid), 'GOOD 圣遗物', draft => {
        const added = mergeUidWarehouse(uid, pieces, draft)
        return { added, reused: pieces.length - added }
    })
    if (!failures.length) return result
    console.warn('GOOD 圣遗物', failures)
    return { ...result, warning: `已导入 ${pieces.length} 件圣遗物，跳过 ${failures.length} 件无法识别的圣遗物。` }
}
