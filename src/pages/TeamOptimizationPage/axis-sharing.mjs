import { computed, onBeforeUnmount, ref } from 'vue'
import { cloudApi } from '@/platform/cloud.mjs'
import { sharedAxis, axisSummary } from '../../../beta-data/shared-axis.mjs'
import { TEAM_ACTION_CATALOG } from '../../../beta-data/team-engine/action-catalog.mjs'

export const shareLoginReturn = { draft: null }
export const shareFingerprint = axis => JSON.stringify(sharedAxis(axis, TEAM_ACTION_CATALOG))

// Older libraries predate shareSourceId. Two open editors must adopt the same
// first-publication ID, even if both still hold an unmodified library in memory.
async function firstPublicationId(item, account) {
    if (item.shareSourceId) return item.shareSourceId
    const key = 'mona.share-source.' + JSON.stringify([account, item.key, item.axis.id])
    return navigator.locks.request(key, () => {
        const id = localStorage.getItem(key) || crypto.randomUUID()
        localStorage.setItem(key, id)
        item.shareSourceId = id
        return id
    })
}

export function useAxisSharing({ entry, currentDraft, save, persist, login, localAccount }) {
    const open = ref(false), busy = ref(false), message = ref(''), verified = ref(false)
    const context = ref(null)
    let generation = 0, contextRead = 0
    const owner = computed(() => context.value && JSON.stringify([context.value.url, context.value.userId]))
    const binding = computed(() => entry.value?.shares?.[owner.value])
    const published = computed(() => binding.value?.record)
    const active = computed(() => published.value?.status === 'active')
    const link = computed(() => published.value && context.value ? context.value.url + '/s/' + published.value.id : '')
    function changed(axis, record) {
        if (!record) return false
        try { return record.fingerprint !== shareFingerprint(axis) }
        catch { return true } // Incomplete local drafts are still editable and pending. Publish reports the validation error.
    }
    function entryStatus(item) {
        const record = item.shares?.[owner.value]?.record
        if (record?.status !== 'active') return ''
        return changed(item.axis, record) ? '待更新' : '已分享'
    }
    // Invalid drafts still need to open the dialog so the publish action can report their validation error.
    const dirty = computed(() => {
        if (!active.value) return false
        try { return changed(currentDraft(), published.value) }
        catch { return true }
    })
    function close() {
        generation++
        open.value = false
        busy.value = false
        verified.value = false
        message.value = ''
    }
    async function readContext() {
        const read = ++contextRead
        const config = await cloudApi('config')
        if (read === contextRead) context.value = config.user ? { url: config.url, userId: config.user.id } : null
    }
    function contextChanged() {
        close()
        context.value = null
        readContext().catch(error => { message.value = error.message })
    }
    window.addEventListener('mona-cloud-context-change', contextChanged)
    onBeforeUnmount(() => { close(); window.removeEventListener('mona-cloud-context-change', contextChanged) })
    readContext().catch(error => { message.value = error.message })
    function keep(record, item, key) {
        const { axis, ...summary } = record
        item.shares[key].record = { ...summary, fingerprint: shareFingerprint(axis), summary: axisSummary(axis) }
    }
    async function refresh(token) {
        const record = published.value, item = entry.value, key = owner.value
        if (!record) { verified.value = true; return }
        const data = await cloudApi('v1/shares/' + record.id, 'GET', undefined, context.value)
        if (generation !== token) return
        keep(data, item, key)
        await persist()
        if (generation === token) verified.value = true
    }
    async function show({ returning = false } = {}) {
        const token = ++generation
        open.value = !returning
        busy.value = true
        message.value = ''
        verified.value = false
        try {
            await readContext()
            if (token !== generation) return
            if (!context.value) {
                close()
                if (!returning) await login()
                return
            }
            open.value = true
            await refresh(token)
        } catch (error) {
            if (token === generation) {
                open.value = true
                message.value = error.message
            }
        }
        finally { if (token === generation) busy.value = false }
    }
    async function copy() {
        await navigator.clipboard.writeText(link.value)
    }
    async function run(kind, days) {
        if (busy.value || !verified.value) return
        const token = generation, key = owner.value, account = localAccount()
        busy.value = true
        message.value = ''
        try {
            const record = published.value
            if (kind === 'revoke') {
                await cloudApi('v1/shares/' + record.id, 'DELETE', undefined, context.value)
                if (token !== generation) return
                entry.value.shares[key] = { requestId: record.id }
                await persist()
                return
            }
            const axis = sharedAxis(currentDraft(), TEAM_ACTION_CATALOG)
            await save()
            if (token !== generation || account !== localAccount()) return
            const item = entry.value
            item.shares ??= {}
            if (record && !active.value) item.shares[key] = { requestId: record.id }
            if (!item.shares[key]) item.shares[key] = { requestId: await firstPublicationId(item, account) }
            await persist() // Persist the operation ID before the first network attempt, including retries after restart.
            if (token !== generation) return
            const creating = kind === 'create'
            const data = creating
                ? await cloudApi('v1/shares', 'POST', { requestId:item.shares[key].requestId, days, axis }, context.value)
                : await cloudApi('v1/shares/' + record.id, 'PUT', { version:record.version, axis }, context.value)
            if (token !== generation) return
            keep(data, item, key)
            await persist()
            if (creating && data.status === 'active' && token === generation) {
                try { await copy(); return '已复制链接' }
                catch { message.value = '链接已生成，请手动复制。' }
            }
            if (!creating) return '已发布更新'
        } catch (error) {
            if (token !== generation) return
            message.value = error.message
            if (error.code === 'SHARE_CONFLICT' || error.status === 410) {
                verified.value = false
                try { await refresh(token) }
                catch (refreshError) { message.value += ' · ' + refreshError.message }
            }
        } finally { if (token === generation) busy.value = false }
    }
    return { open, busy, message, verified, active, published, link, dirty, entryStatus, show, close, run, copy }
}
