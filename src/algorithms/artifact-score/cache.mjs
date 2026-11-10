export const SCORE_VERSION='damage-increment/3'
// Canonical strings are compared directly. No hash, account data persistence,
// or dependency on object insertion order.
export function canonical(value) {
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
    if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'
    return JSON.stringify(value)
}
export function referenceKey(request,basis) {
    const {artifacts,...environment}=request.input
    return canonical({version:SCORE_VERSION,environment,objective:request.objective,constraints:request.constraints,
        search:request.search,sets:request.sets,basis,
        // The starts are deterministic and independent of current substats.
        templates:artifacts.map(a=>[a.slot,a.set_name,a.main_stat])})
}
export function createScoreCache(limit=8) {
    const entries=new Map()
    return {
        get(key){if(!entries.has(key))return undefined;const value=entries.get(key);entries.delete(key);entries.set(key,value);return structuredClone(value)},
        set(key,value){entries.delete(key);entries.set(key,structuredClone(value));while(entries.size>limit)entries.delete(entries.keys().next().value)},
        clear(){entries.clear()},get size(){return entries.size},
    }
}
