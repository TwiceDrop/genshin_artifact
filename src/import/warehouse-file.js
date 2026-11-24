import { ElMessageBox } from 'element-plus'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { importMonaJson } from '@/utils/artifacts'
import { convertGoodArtifacts } from './good'
import { uidImportSession } from './uid-import-session'
import { mergeUidWarehouse } from './save-game-snapshot.mjs'
import { useAccountStore } from '@/store/pinia/account'

export async function importWarehouseFile(file, removeUnseen, backup, cleanup) {
    if (file?.format !== 'GOOD') return importMonaJson(file, removeUnseen, backup, cleanup)
    const session = uidImportSession(useAccountStore().currentAccountId.value)
    const pieces = Object.values(convertGoodArtifacts(file)).flat()
    const uid = file.metadata?.uid ?? (await ElMessageBox.prompt('导入到原神 UID', '导入 GOOD 圣遗物', {
        inputValue: useMiyousheStore().selectedUid.value || '', inputPattern: /^\d{8,10}$/, inputErrorMessage: '请输入 8 至 10 位原神 UID'
    })).value
    return session.run(String(uid), 'GOOD 圣遗物', draft => {
        const added = mergeUidWarehouse(uid, pieces, draft)
        return { added, reused: pieces.length - added }
    })
}
