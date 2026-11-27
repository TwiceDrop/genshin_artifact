import backend from './backend'
import type { DslLibraryEntry } from '@/types/dsl-library'

export const dslLibraryKey = (accountId: number) => `mona_account_dsl_library_${accountId}`

export async function listDslEntries(accountId: number): Promise<DslLibraryEntry[]> {
    return await backend.getItem(dslLibraryKey(accountId)) ?? []
}

export function saveDslEntry(accountId: number, entry: DslLibraryEntry, existing: boolean) {
    return backend.updateAccountItem<DslLibraryEntry[]>(accountId, dslLibraryKey(accountId), data => {
        const entries = data ?? []
        const index = entries.findIndex(item => item.id === entry.id)
        if (index < 0 && existing) return undefined
        if (index < 0) return [...entries, entry]
        return entries.map((item, position) => position === index ? entry : item)
    })
}

export function removeDslEntry(accountId: number, id: string) {
    return backend.updateAccountItem<DslLibraryEntry[]>(accountId, dslLibraryKey(accountId), entries => (entries ?? []).filter(item => item.id !== id))
}
