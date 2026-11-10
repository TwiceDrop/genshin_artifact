export const SYNC_KEY = 'mona_cloud_profiles_v1'
const clone = value => JSON.parse(JSON.stringify(value))
const contextKey = context => context ? `${context.url}\n${context.userId}` : ''
const changed = () => Object.assign(new Error('在线身份或本地档案已变化，请重新同步'), { code: 'CLOUD_CONTEXT_CHANGED' })
const waiting = () => Object.assign(new Error('本地档案正在计算或修改，等待同步'), { code: 'PROFILE_BUSY' })
const domainPattern = /^mona_account_(artifacts|presets|kumi|miyoushe|comparison_settings|team_dps_configurations|team_dps_tasks)_(\d+)$/

export function createProfileSync({ api, storage, capture, restore, createLocal, currentAccountId, accountNames, canRestore, historySync, makeReactive = value => value, uuid = () => crypto.randomUUID(), state = { bindings: [], profiles: [], busy: false, error: '' } }) {
    let metadata, context = null, epoch = 0, queue = Promise.resolve(), initialized, timer, debounce, started = false, names = {}, unsubscribe, mutationSequence = 0
    function visible() { const bindings = metadata.bindings.filter(binding => binding.scope === contextKey(context)); state.bindings = bindings; return bindings }
    async function init() {
        if (!initialized) initialized = (async () => {
            metadata = makeReactive(await storage.getItem(SYNC_KEY) || { version: 1, deviceId: uuid(), bindings: [], deletions: [] })
            names = accountNames(); await persist()
        })()
        await initialized
    }
    function persist() { return storage.setItem(SYNC_KEY, clone(metadata), { source: 'cloud-sync' }) }
    function invalidateContext() { epoch++; context = null; state.bindings = []; state.profiles = []; wake() }
    async function identity() {
        const config = await api('config')
        const next = config.url && config.user ? { url: config.url, userId: config.user.id } : null
        if (contextKey(next) !== contextKey(context)) { epoch++; context = next; state.profiles = [] }
        visible(); return context ? { ...context, epoch } : null
    }
    async function assertCurrent(scope, binding) {
        const config = await api('config')
        if (scope.epoch !== epoch || config.url !== scope.url || config.user?.id !== scope.userId || (binding && !metadata.bindings.some(item => item.bindingId === binding.bindingId))) throw changed()
    }
    function localGuard(scope, binding, generation) {
        if (scope.epoch !== epoch || !metadata.bindings.some(item => item.bindingId === binding.bindingId)) throw changed()
        if (binding.localGeneration !== generation || !canRestore(binding.localAccountId)) throw waiting()
    }
    async function request(scope, path, method = 'GET', body, binding) {
        if (scope.epoch !== epoch) throw changed()
        const result = await api(path.replace(/^\//, ''), method, body, scope)
        await assertCurrent(scope, binding)
        return result
    }
    function enqueue(action, report = true) {
        const task = queue.then(async () => {
            await init(); state.busy = true
            if (report) state.error = ''
            try { return await action() }
            catch (error) { if (report && error.code !== 'CLOUD_CONTEXT_CHANGED') state.error = error.message; throw error }
            finally { state.busy = false }
        })
        queue = task.then(() => undefined, () => undefined)
        return task
    }
    function bindingForCurrent() { return visible().find(binding => binding.localAccountId === currentAccountId()) }
    async function snapshot(binding) {
        const generation = binding.localGeneration, data = await capture(binding.localAccountId)
        if (generation !== binding.localGeneration) throw waiting()
        return { data, generation }
    }
    function payload(binding, captured) {
        return { operationId: uuid(), baseRevision: binding.baseRevision, deviceId: metadata.deviceId, schemaVersion: 1, appVersion: '7.2.4', engineVersion: 'mona-team-engine/58', data: captured.data, generation: captured.generation }
    }
    async function ensureCreated(binding, scope) {
        if (binding.profileId) return
        const result = await request(scope, 'v1/profiles', 'POST', { operationId: binding.createOperationId, name: binding.createName }, binding)
        binding.profileId = result.profile.id; binding.baseRevision = 0; await persist(); visible()
    }
    async function push(binding, scope) {
        await ensureCreated(binding, scope)
        if (!binding.pending) { binding.pending = payload(binding, await snapshot(binding)); await persist() }
        const pending = binding.pending, { generation, ...body } = pending
        try {
            const result = await request(scope, `v1/profiles/${binding.profileId}/revisions`, 'PUT', body, binding)
            binding.baseRevision = result.revision.revision
            binding.syncedGeneration = generation; binding.pending = null; binding.conflictRevision = null; binding.conflictGeneration = null
            binding.status = binding.localGeneration === generation ? 'synced' : 'dirty'; binding.error = ''; await persist()
        } catch (error) {
            if (error.code === 'PROFILE_CONFLICT') {
                binding.status = 'conflict'; binding.conflictRevision = error.revision?.revision; binding.conflictGeneration = generation
                binding.error = error.message; await persist()
            }
            throw error
        }
    }
    function revisionData(revision) {
        if (!revision || revision.schemaVersion !== 1 || !revision.data || typeof revision.data.name !== 'string') throw new Error('云档案格式或版本不受支持')
        return revision.data
    }
    async function apply(binding, scope, revision, generation, automatic = false) {
        const data = revisionData(revision), sequence = mutationSequence
        const guard = () => {
            localGuard(scope, binding, generation)
            if (sequence !== mutationSequence || (automatic && (binding.pending || binding.syncedGeneration !== binding.localGeneration))) throw waiting()
        }
        await assertCurrent(scope, binding); guard()
        const next = clone(metadata), nextBinding = next.bindings.find(item => item.bindingId === binding.bindingId)
        Object.assign(nextBinding, { baseRevision: revision.revision, syncedGeneration: generation, pending: null, conflictRevision: null, conflictGeneration: null, status: 'synced', error: '' })
        await restore(binding.localAccountId, data, [[SYNC_KEY, next]], guard)
        Object.assign(binding, nextBinding); names = accountNames(); visible(); await persist()
    }
    async function history(binding, scope) {
        if (!binding.profileId || !historySync || !canRestore(binding.localAccountId)) return
        await historySync({ accountId: binding.localAccountId, profileId: binding.profileId, metadata: clone(binding.history || {}),
            request: (path, options = {}) => request(scope, path, options.method || 'GET', options.body, binding),
            assertCurrent: () => assertCurrent(scope, binding),
            beforeWrite: () => { if (scope.epoch !== epoch || !metadata.bindings.some(item => item.bindingId === binding.bindingId)) throw changed() },
            onMetadata: async value => { await assertCurrent(scope, binding); binding.history = clone(value); await persist() },
        })
    }
    function recordError(binding, error) {
        if (error.code === 'CLOUD_CONTEXT_CHANGED') return
        if (error.code === 'PROFILE_BUSY' || error.code === 'HISTORY_BUSY') { binding.status = 'waiting'; binding.error = ''; return }
        if (error.code === 'PROFILE_CONFLICT') return
        binding.status = error.code === 'PROFILE_DELETED' ? 'deleted' : !error.status || error.status >= 500 ? 'offline' : 'error'
        binding.error = error.message
    }
    async function syncBinding(binding, scope) {
        if (!binding.enabled || ['conflict', 'deleted'].includes(binding.status)) return
        binding.status = 'syncing'; binding.error = ''
        try {
            if (binding.pending || binding.localGeneration > binding.syncedGeneration || !binding.profileId) await push(binding, scope)
            else {
                const generation = binding.localGeneration
                const remote = await request(scope, `v1/profiles/${binding.profileId}`, 'GET', undefined, binding)
                if (remote.profile.deletedAt) throw Object.assign(new Error('云档案已删除，本地数据保留'), { code: 'PROFILE_DELETED', status: 410 })
                if (remote.revision && remote.revision.revision > binding.baseRevision) await apply(binding, scope, remote.revision, generation, true)
                else binding.status = 'synced'
            }
            await history(binding, scope)
        } catch (error) { recordError(binding, error); await persist(); if (error.code === 'CLOUD_CONTEXT_CHANGED') throw error }
    }
    async function loadProfiles(scope) { state.profiles = (await request(scope, 'v1/profiles?includeDeleted=true')).profiles }
    async function deleteOperation(operation, scope) {
        try {
            await request(scope, `v1/profiles/${operation.profileId}`, 'DELETE', { operationId: operation.operationId, baseRevision: operation.baseRevision, deviceId: operation.deviceId })
        } catch (error) {
            if (error.code !== 'PROFILE_DELETED') {
                if (error.code === 'PROFILE_CONFLICT') { operation.blocked = true; operation.error = error.message; await persist() }
                throw error
            }
        }
        metadata.deletions = metadata.deletions.filter(item => item.operationId !== operation.operationId)
        for (const binding of visible()) if (binding.profileId === operation.profileId) { binding.status = 'deleted'; binding.error = '云档案已删除，本地数据保留' }
        await persist()
    }
    async function tick() {
        const scope = await identity(); if (!scope) return
        for (const operation of [...metadata.deletions]) if (operation.scope === contextKey(scope) && !operation.blocked) {
            try { await deleteOperation(operation, scope) } catch (error) { if (error.code === 'CLOUD_CONTEXT_CHANGED') throw error; state.error = error.message }
        }
        for (const binding of [...visible()]) await syncBinding(binding, scope)
    }
    function wake() {
        if (!started) return
        clearTimeout(debounce)
        debounce = setTimeout(() => enqueue(tick, false).catch(error => { if (error.code !== 'CLOUD_CONTEXT_CHANGED' && visible().some(binding => binding.enabled)) state.error = error.message }), 2000)
    }
    function mutation(event) {
        if (event.source !== 'local') { if (event.keys.includes('mona_accounts')) names = accountNames(); return }
        mutationSequence++
        const ids = new Set(event.keys.map(key => domainPattern.exec(key)?.[2]).filter(Boolean).map(Number))
        const accountEntry = event.entries?.find(([key]) => key === 'mona_accounts')
        if (accountEntry) {
            const next = Object.fromEntries(accountEntry[1].allAccounts.map(account => [account.id, account.name]))
            for (const [id, name] of Object.entries(next)) if (names[id] !== undefined && names[id] !== name) ids.add(Number(id))
            names = next
        }
        let dirty = false
        for (const binding of metadata.bindings) if (ids.has(binding.localAccountId)) {
            binding.localGeneration++; if (!['conflict', 'deleted'].includes(binding.status)) binding.status = binding.enabled ? 'dirty' : 'disabled'; dirty = true
        }
        if (dirty) { persist().catch(error => { state.error = error.message }); wake() }
    }
    async function createBinding(scope, accountId, replace) {
        const existing = visible().find(item => item.localAccountId === accountId)
        if (existing && !replace) throw new Error('当前本地账号已关联云档案')
        const data = await capture(accountId)
        await assertCurrent(scope)
        if (existing) metadata.bindings.splice(metadata.bindings.findIndex(item => item.bindingId === existing.bindingId), 1)
        let binding = { bindingId: uuid(), scope: contextKey(scope), localAccountId: accountId, profileId: null, baseRevision: 0, localGeneration: 1, syncedGeneration: 0, enabled: true, status: 'dirty', error: '', createOperationId: uuid(), createName: data.name, history: {} }
        metadata.bindings.push(binding); binding = metadata.bindings[metadata.bindings.length - 1]; await persist(); visible()
        await syncBinding(binding, scope); await loadProfiles(scope)
        return binding
    }
    return {
        state,
        refresh: () => enqueue(async () => { const scope = await identity(); if (scope) { await request(scope, 'v1/me'); await loadProfiles(scope) } }),
        createCurrent: () => enqueue(async () => { const scope = await identity(); if (!scope) throw new Error('请先登录在线账号'); return createBinding(scope, currentAccountId(), false) }),
        downloadNew: (profileId, revisionNumber) => enqueue(async () => {
            const scope = await identity(); if (!scope) throw new Error('请先登录在线账号')
            const result = await request(scope, revisionNumber ? `v1/profiles/${profileId}/revisions/${revisionNumber}` : `v1/profiles/${profileId}`)
            const revision = result.revision, data = revisionData(revision)
            let binding = { bindingId: uuid(), scope: contextKey(scope), localAccountId: null, profileId, baseRevision: revision.revision, localGeneration: 0, syncedGeneration: 0, enabled: true, status: 'synced', error: '', history: {} }
            await assertCurrent(scope)
            const next = clone(metadata), sequence = mutationSequence
            await createLocal(data, accountId => { binding.localAccountId = accountId; next.bindings.push(clone(binding)); return [[SYNC_KEY, next]] }, () => { if (scope.epoch !== epoch) throw changed(); if (sequence !== mutationSequence) throw waiting() })
            metadata.bindings.push(binding); binding = metadata.bindings[metadata.bindings.length - 1]; names = accountNames(); visible(); await persist(); await history(binding, scope)
            return binding.localAccountId
        }),
        syncCurrent: () => enqueue(async () => { const scope = await identity(), binding = bindingForCurrent(); if (!scope || !binding) throw new Error('当前本地账号未关联云档案'); const enabled = binding.enabled; binding.enabled = true; try { await syncBinding(binding, scope); await loadProfiles(scope) } finally { binding.enabled = enabled; await persist() } }),
        setEnabled: (accountId, enabled) => enqueue(async () => { await identity(); const binding = visible().find(item => item.localAccountId === accountId); if (!binding) return; binding.enabled = enabled; if (!['conflict', 'deleted'].includes(binding.status)) binding.status = enabled ? 'dirty' : 'disabled'; await persist(); if (enabled) wake() }),
        unlink: accountId => enqueue(async () => { await identity(); metadata.bindings = metadata.bindings.filter(binding => !(binding.scope === contextKey(context) && binding.localAccountId === accountId)); await persist(); visible() }),
        deleteCloud: profileId => enqueue(async () => {
            const scope = await identity(); if (!scope) throw new Error('请先登录在线账号')
            const profile = state.profiles.find(item => item.id === profileId) || (await request(scope, `v1/profiles/${profileId}`)).profile
            const operation = { scope: contextKey(scope), profileId, operationId: uuid(), baseRevision: profile.revision, deviceId: metadata.deviceId }
            metadata.deletions = metadata.deletions.filter(item => !(item.scope === operation.scope && item.profileId === profileId))
            metadata.deletions.push(operation); await persist()
            await deleteOperation(operation, scope); await loadProfiles(scope)
        }),
        resolveCurrent: choice => enqueue(async () => {
            const scope = await identity(), binding = bindingForCurrent()
            if (!scope || !binding) throw new Error('当前本地账号未关联云档案')
            if (choice === 'copy') return createBinding(scope, binding.localAccountId, true)
            if (choice === 'remote') {
                if (binding.localGeneration > (binding.conflictGeneration ?? binding.syncedGeneration)) {
                    binding.pending = payload(binding, await snapshot(binding)); await persist()
                    try { await push(binding, scope) } catch (error) { if (error.code !== 'PROFILE_CONFLICT') throw error }
                }
                const generation = binding.localGeneration
                const remote = await request(scope, `v1/profiles/${binding.profileId}`, 'GET', undefined, binding)
                await apply(binding, scope, remote.revision, generation); await history(binding, scope)
            } else if (choice === 'local') {
                const remote = await request(scope, `v1/profiles/${binding.profileId}`, 'GET', undefined, binding)
                binding.baseRevision = remote.profile.revision; binding.pending = null; binding.status = 'dirty'
                await push(binding, scope); await history(binding, scope)
            } else throw new Error('未知冲突处理方式')
            await loadProfiles(scope)
        }),
        start: async () => {
            if (started) return
            await init(); started = true; unsubscribe = storage.subscribeMutations(mutation)
            timer = setInterval(() => enqueue(tick, false).catch(error => { if (error.code !== 'CLOUD_CONTEXT_CHANGED' && state.bindings.some(binding => binding.enabled)) state.error = error.message }), 15000)
            if (typeof window !== 'undefined') { window.addEventListener('online', wake); window.addEventListener('mona-cloud-context-change', invalidateContext); document.addEventListener('visibilitychange', wake) }
            wake()
        },
        stop: () => { started = false; epoch++; clearInterval(timer); clearTimeout(debounce); unsubscribe?.(); if (typeof window !== 'undefined') { window.removeEventListener('online', wake); window.removeEventListener('mona-cloud-context-change', invalidateContext); document.removeEventListener('visibilitychange', wake) } },
        tick: () => enqueue(tick, false),
        invalidateContext,
    }
}
