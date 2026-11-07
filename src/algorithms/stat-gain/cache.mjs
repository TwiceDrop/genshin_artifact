export const statGainCacheKey = accountId => `mona_stat_gain_cache_${accountId}`

// Inventory identity is compared once on load/change, not on every curve lookup.
const inventoryKey = items => JSON.stringify([...items].sort((a,b) => a.id-b.id).map(a =>
    [a.id,a.setName,a.position,a.star,a.level,a.mainTag,a.normalTags,a.unactivatedTags,a.omit]))

export function createStatGainCache(storage, getSession) {
    const accounts = new Map()
    function setInventory(accountId, items) {
        const inventory = inventoryKey(items), current = accounts.get(accountId)
        if (current?.inventory === inventory) return
        const saved = JSON.parse(storage.getItem(statGainCacheKey(accountId)) || 'null')
        const matching = saved?.inventory === inventory
        accounts.set(accountId, { inventory, session: matching ? saved.session : null,
            entries: new Map(matching ? saved.entries : []) })
        if (!matching) storage.removeItem(statGainCacheKey(accountId))
    }
    async function open(accountId) {
        const session = await getSession(), state = accounts.get(accountId)
        if (state.session !== session) {
            state.session = session; state.entries.clear()
            storage.removeItem(statGainCacheKey(accountId))
        }
        return {
            get: key => state.entries.get(key),
            set(key, value) {
                // An inventory change or restart during a calculation invalidates its write.
                if (accounts.get(accountId) !== state || state.session !== session) return
                state.entries.set(key, value)
                storage.setItem(statGainCacheKey(accountId), JSON.stringify({session,inventory:state.inventory,entries:[...state.entries]}))
            },
        }
    }
    function remove(accountId) {
        accounts.delete(accountId)
        storage.removeItem(statGainCacheKey(accountId))
    }
    return { setInventory, open, remove }
}
