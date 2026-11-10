import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import targets from '@/assets/_gen_tf'
import locale from '@/i18n/generated/zh-cn.json'
import { createMysConverter } from '@/import/miyoushe.mjs'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { watchContent as artifactsContent } from '@/store/pinia/artifact'
import { watchContent as presetsContent } from '@/store/pinia/preset'
import { useAccountStore } from '@/store/pinia/account'
import backend from '@/store/backend'
import { useMona } from '@/wasm/mona'

export async function saveGameSnapshot(snapshot, accountId, source, checkActive) {
    const mona = await useMona()
    checkActive()
    if (useAccountStore().currentAccountId.value !== accountId) throw new Error('莫娜账号已切换，数据未写入')
    const converter = createMysConverter({ characters, weapons, artifacts, targets, locale,
        inferAscend(c, w, hp) {
            if (!Number.isFinite(hp)) return undefined
            const values = [false, true].map(ascend => mona.CommonInterface.get_attribute({ character: { ...c, ascend }, weapon: w, artifacts: [], buffs: [], artifact_config: null }).hp['角色基础生命'])
            const errors = values.map(n => Math.abs(n - hp))
            if (Math.min(...errors) > 3 || Math.abs(values[0] - values[1]) < 1) return undefined
            return errors[1] < errors[0]
        },
    })
    const store = useMiyousheStore(), imported = store.importSnapshot(snapshot, converter, source)
    const saved = JSON.parse(JSON.stringify({ miyoushe: store.data.value, artifacts: artifactsContent(), presets: presetsContent() }))
    // Preserve the existing account persistence ordering before reporting completion.
    await new Promise(resolve => setTimeout(resolve, 0))
    for (const [type, content] of Object.entries(saved)) await backend.setItem(`mona_account_${type}_${accountId}`, content)
    await backend.allReady()
    return imported
}
