import { computed } from 'vue'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { wornArtifactIds } from '@/import/roster-equipment.mjs'

export function useRosterLoadout(entry) {
    const { data } = useMiyousheStore(), presets = usePresetStore()
    const row = computed(() => data.value.entries.find(row => row.key === entry().key))
    const state = computed(() => data.value.rosterLoadouts?.[entry().key])
    const configs = computed(() => state.value?.configs || [])
    const worn = computed(() => wornArtifactIds(row.value, presets.presets.value))
    const hasDraft = computed(() => state.value?.draft?.every((id, i) => id === worn.value[i]) === true)
    const selectedConfig = computed(() => {
        if (entry().characterVariant || hasDraft.value) return
        return configs.value.find(c => c.name === state.value?.active)
    })
    return { row, state, configs, worn, hasDraft, selectedConfig }
}
