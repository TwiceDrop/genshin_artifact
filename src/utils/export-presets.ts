import {ElMessage} from 'element-plus'
import {useI18n} from '@/i18n/i18n'
import {exportRolePresets} from '@/import/role-presets'
import {downloadString} from '@/utils/common'

export async function exportAllPresets() {
    const {t} = useI18n()
    try { await downloadString(JSON.stringify(exportRolePresets()), 'application/json', t('misc.preset')) }
    catch (error: any) { ElMessage.error(error.message) }
}
