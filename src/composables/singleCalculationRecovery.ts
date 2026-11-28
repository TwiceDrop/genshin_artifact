import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import { showCalculationNotice } from '@/store/calculation-history'
import { singleDraftKey } from '@/store/single-calculation-draft'
import { canonical } from '@/algorithms/artifact-score/cache.mjs'

export function useSingleCalculationRecovery<T>(options: {
    account: () => number, capture: () => T, restore: (draft: T) => Promise<void>,
    restart: () => void, openRoute: () => Promise<void>, running: () => boolean,
}) {
    const owner = options.account()
    const key = singleDraftKey(owner)
    const route = useRoute()
    const state = computed(() => JSON.stringify(options.capture()))
    const pending = shallowRef<T | null>(null)
    const restoring = ref(false)
    let active = false, enabled = false, first = true, timer = 0
    let lastSaved = '', path = ''

    function save(backgroundResult = false) {
        window.clearTimeout(timer)
        if ((!active && !backgroundResult) || !enabled || owner !== options.account() || state.value === lastSaved) return
        try {
            localStorage.setItem(key, JSON.stringify({ path, draft: JSON.parse(state.value) }))
            lastSaved = state.value
        } catch (e) { showCalculationNotice('error', '单次计算进度保存失败：' + String(e)) }
    }
    watch(state, () => {
        if (!active || !enabled) return
        window.clearTimeout(timer)
        timer = window.setTimeout(save, 250)
    })
    function matchesCurrent(draft: T) {
        return JSON.stringify(draft) === state.value || canonical(draft) === canonical(JSON.parse(state.value))
    }
    function enter() {
        if (active || route.name !== 'calculate') return
        active = true
        const reload = first && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type === 'reload'
        if (first) lastSaved = state.value
        first = false
        path = route.fullPath
        const explicit = route.query.preset || route.params.presetName || route.query.history
        const stored = localStorage.getItem(key)
        if (stored && !options.running()) {
            try {
                const saved = JSON.parse(stored)
                if (!explicit || (reload && saved.path === path)) {
                    enabled = matchesCurrent(saved.draft)
                    if (enabled) lastSaved = state.value
                    else pending.value = saved.draft
                    return
                }
            } catch (e) { showCalculationNotice('error', '单次计算进度读取失败：' + String(e)) }
        }
        enabled = true
        if (explicit) void options.openRoute()
    }
    async function resume() {
        if (!pending.value || restoring.value) return
        restoring.value = true
        try {
            const storedState = JSON.stringify(pending.value)
            if (!matchesCurrent(pending.value)) await options.restore(pending.value)
            if (!active || owner !== options.account()) return
            pending.value = null
            enabled = true
            // Restoring can normalize a preset or freeze its selected result's equipment.
            lastSaved = storedState
            save()
        } catch (e) { showCalculationNotice('error', '单次计算进度恢复失败：' + String(e)) }
        finally { restoring.value = false }
    }
    function restart() {
        enabled = false
        localStorage.removeItem(key)
        pending.value = null
        options.restart()
    }
    function leave() {
        save()
        active = false
        pending.value = null
    }
    function visibility() { if (document.visibilityState === 'hidden') save() }
    const flush = () => save()
    onMounted(() => {
        enter()
        window.addEventListener('pagehide', flush)
        document.addEventListener('visibilitychange', visibility)
    })
    onActivated(enter)
    onDeactivated(leave)
    onBeforeUnmount(() => {
        leave()
        enabled = false
        window.removeEventListener('pagehide', flush)
        document.removeEventListener('visibilitychange', visibility)
    })
    return { pending, restoring, resume, restart, saveBackgroundResult: () => save(true) }
}
