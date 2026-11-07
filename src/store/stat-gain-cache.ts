import { createStatGainCache } from '@/algorithms/stat-gain/cache.mjs'
import { calculationSession } from '@/platform/native.mjs'

export const statGainCache = createStatGainCache(sessionStorage, calculationSession)
