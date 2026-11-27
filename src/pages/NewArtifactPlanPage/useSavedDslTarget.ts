import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { listDslEntries } from '@/store/dsl-library'
import type { DslLibraryEntry } from '@/types/dsl-library'

type TargetMode = 'normal' | 'dsl' | 'generator'
type TargetTab = TargetMode | 'saved'

interface SavedDslTargetOptions {
    open: Readonly<Ref<boolean>>
    character: Ref<string>
    accountId: Ref<number>
    reloadGeneration: Ref<number>
    mode: Ref<TargetMode>
    source: Ref<string>
}

export function useSavedDslTarget({ open, character, accountId, reloadGeneration, mode, source }: SavedDslTargetOptions) {
    const browsingSavedTargets = ref(false)
    const selected = shallowRef<DslLibraryEntry | null>(null)
    const savedTargets = shallowRef<DslLibraryEntry[]>([])
    const savedTargetsLoading = ref(false)
    const savedTargetsError = ref('')

    const activeSavedTarget = computed(() => {
        const entry = selected.value
        return entry && mode.value === 'dsl' && source.value === entry.source ? entry : null
    })
    const savedTargetId = computed(() => {
        const active = activeSavedTarget.value
        return active && savedTargets.value.some(entry => entry.id === active.id && entry.source === active.source)
            ? active.id : null
    })

    function forgetSavedTarget() {
        selected.value = null
        browsingSavedTargets.value = false
    }

    const optimizationTargetTab = computed<TargetTab>({
        get: () => browsingSavedTargets.value ? 'saved' : mode.value,
        set(tab) {
            if (tab === 'saved') {
                browsingSavedTargets.value = true
            } else {
                forgetSavedTarget()
                mode.value = tab
            }
        },
    })

    watch([character, accountId], () => {
        const fromLibrary = activeSavedTarget.value !== null
        forgetSavedTarget()
        if (fromLibrary) {
            mode.value = 'normal'
            source.value = ''
        }
    }, { flush: 'sync' })

    watch(open, (visible) => {
        if (!visible && !activeSavedTarget.value) browsingSavedTargets.value = false
    })

    watch([open, browsingSavedTargets, character, accountId, reloadGeneration], async ([visible, browsing, role, owner], _, onCleanup) => {
        savedTargets.value = []
        savedTargetsError.value = ''
        savedTargetsLoading.value = visible && browsing
        if (!visible || !browsing) return

        let current = true
        onCleanup(() => { current = false })
        try {
            const entries = await listDslEntries(owner)
            if (current) savedTargets.value = entries.filter(entry => entry.character === role)
        } catch (error) {
            if (current) savedTargetsError.value = error instanceof Error ? error.message : String(error)
        } finally {
            if (current) savedTargetsLoading.value = false
        }
    }, { flush: 'sync' })

    function selectSavedTarget(id: string) {
        const entry = savedTargets.value.find(item => item.id === id)
        if (!entry) return
        mode.value = 'dsl'
        source.value = entry.source
        selected.value = entry
    }

    return {
        optimizationTargetTab, savedTargets, savedTargetId, savedTargetsLoading, savedTargetsError,
        activeSavedTarget, selectSavedTarget, forgetSavedTarget,
    }
}
