import { computed, ref, watch } from 'vue'
import { artifactFingerprint } from '../import/miyoushe.mjs'
import { randomUUID } from '../platform/crypto-browser.mjs'

export const snapshotEquipment = items => JSON.parse(JSON.stringify(Array.from({ length: 5 }, (_, i) => items[i] || null)))
const signature = items => JSON.stringify(items.map(a => a ? [a.id ?? null, artifactFingerprint(a)] : null))
export function compareEquipment(items, baseline) {
    return Array.from({ length: 5 }, (_, i) => {
        if (!baseline) return ''
        const current = items[i], old = baseline[i]
        if (!current && !old) return ''
        if (!current) return '已卸下'
        if (!old) return '新增'
        return current.id !== old.id || artifactFingerprint(current) !== artifactFingerprint(old) ? '已替换' : ''
    })
}

// Storage is part of the active Mona account; key includes the game UID and character.
export function useArtifactComparison({ storage, key, items, gameBaseline }) {
    const sessionBaseline = ref(null), selectedHistoryId = ref('')
    const update = patch => { storage.value = { ...storage.value, ...patch } }
    const enabled = computed({ get: () => storage.value.enabled !== false, set: enabled => update({ enabled }) })
    const mode = computed({ get: () => storage.value.mode || 'session', set: mode => update({ mode }) })
    const history = computed(() => (storage.value.history || []).filter(row => row.key === key.value))
    const historyId = computed({
        get: () => history.value.some(row => row.id === selectedHistoryId.value) ? selectedHistoryId.value : history.value[0]?.id || '',
        set: id => { selectedHistoryId.value = id },
    })
    const historyRow = computed(() => history.value.find(row => row.id === historyId.value))
    const baseline = computed(() => !enabled.value ? null : mode.value === 'game' ? gameBaseline.value?.items
        : mode.value === 'history' ? historyRow.value?.items : sessionBaseline.value)
    const changes = computed(() => compareEquipment(items.value, baseline.value))
    const description = computed(() => {
        if (!enabled.value) return '圣遗物对比已关闭'
        if (mode.value === 'game') return gameBaseline.value?.description || '该 UID 的角色尚无游戏内穿戴记录，请先同步角色'
        if (mode.value === 'history') return historyRow.value ? `对比历史：${historyRow.value.label} · ${new Date(historyRow.value.time).toLocaleString()}` : '暂无该角色的配装历史，可保存当前配装或开始计算'
        return sessionBaseline.value ? '对比本次开始计算前穿戴的圣遗物' : '开始计算后，将与本次计算前的穿戴进行对比'
    })
    function record(label, equipment = items.value) {
        const frozen = snapshotEquipment(equipment)
        if (!frozen.some(Boolean)) return
        const all = storage.value.history || []
        const existing = all.find(row => row.key === key.value && row.label === label && signature(row.items) === signature(frozen))
        if (existing) return existing.id
        const row = { id: randomUUID(), key: key.value, label, time: new Date().toISOString(), items: frozen }
        const previousSelection = historyId.value
        update({ history: [row, ...all.filter(row => row.key === key.value).slice(0, 49), ...all.filter(row => row.key !== key.value)] })
        selectedHistoryId.value = previousSelection || row.id
        return row.id
    }
    function begin(equipment) {
        sessionBaseline.value = snapshotEquipment(equipment)
        record('计算前穿戴', equipment)
    }
    function reset() { sessionBaseline.value = null; selectedHistoryId.value = '' }
    watch(key, reset, { flush: 'sync' })
    return { enabled, mode, history, historyId, baseline, changes, description, record, begin, reset }
}
