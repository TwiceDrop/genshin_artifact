import {normalizeBuild,clone,matchesSets,inferPiece} from './rules.mjs'
import {createMonaEvaluator} from './evaluator.mjs'
import {createMeasurements,searchReference,searchReplacement} from './search.mjs'
import {baselineBuild,shapley,normalizeGain,pieceEfficiency} from './metrics.mjs'
import {createScoreCache,canonical,referenceKey,SCORE_VERSION} from './cache.mjs'

export function createDynamicScoreService(makeEvaluator,{cache=createScoreCache(8),results=createScoreCache(12)}={}) {
    function score(request,onProgress=()=>{}) {
        const started=performance.now(),key=canonical({version:SCORE_VERSION,request}),saved=results.get(key)
        if(saved)return {...saved,timing:{...saved.timing,totalMs:performance.now()-started,resultCacheHit:true}}
        const current=normalizeBuild(request.input.artifacts),evaluator=makeEvaluator(request),measurements=createMeasurements(evaluator)
        const currentValue=measurements.measure(current),basis=request.basis||'A',refKey=referenceKey(request,basis)
        let reference=cache.get(refKey),referenceCacheHit=Boolean(reference),referenceMs=0
        if(!reference) {
            const begin=performance.now()
            reference=searchReference(current,measurements.measure,{...request,basis},onProgress)
            referenceMs=performance.now()-begin
            cache.set(refKey,reference)
        }
        const baseline=measurements.measure(baselineBuild(current,basis)).damage
        const referenceFeasible=reference.violation===0&&(basis==='A'||matchesSets(reference.build,request.constraints?.set_mode))
        const attribution=shapley(current,build=>measurements.measure(build).damage,basis)
        const rows=current.map((item,i)=>{
            onProgress({stage:'replacement',slot:i+1,basis})
            const replacement=searchReplacement(current,i,reference,measurements.measure,{basis,passes:request.search?.passes??3,constraints:request.constraints})
            const without=current.flatMap((a,j)=>i!==j?[a]:basis==='A'?[{...a,sub_stats:[]}]:[])
            const zero=measurements.measure(without).damage
            const replacementFeasible=replacement.violation===0&&(basis==='A'||matchesSets(replacement.build,request.constraints?.set_mode))
            const efficiency=pieceEfficiency(currentValue.damage,zero,replacement.damage)
            return {slot:item.slot,...efficiency,score:replacementFeasible?efficiency.score:null,
                shapleyDamage:attribution.contributions[i],shapleyPoints:referenceFeasible?normalizeGain(attribution.contributions[i],0,reference.damage-baseline):null,
                replacement:replacement.build[i],replacementFeasible,
                baseline:zero,referenceDamage:replacement.damage}
        })
        const result={version:SCORE_VERSION,scope:evaluator.scope||'personal-damage',basis,
            score:referenceFeasible?normalizeGain(currentValue.damage,baseline,reference.damage):null,qualityTotal:rows.every(r=>r.score!==null)?rows.reduce((n,r)=>n+r.score,0):null,
            currentDamage:currentValue.damage,baselineDamage:baseline,referenceDamage:reference.damage,
            gainToReference:reference.damage-currentValue.damage,improvement:currentValue.damage>0?reference.damage/currentValue.damage-1:null,
            currentFeasible:currentValue.violation===0&&(basis==='A'||matchesSets(current,request.constraints?.set_mode)),
            referenceFeasible,reference,rows,attribution,
            currentPanel:evaluator.panel?.(current)||{},referencePanel:evaluator.panel?.(reference.build)||{},
            conditions:clone(request),timing:{referenceMs,totalMs:performance.now()-started,evaluations:measurements.evaluations,referenceCacheHit,resultCacheHit:false}}
        results.set(key,result);return result
    }
    // Batch candidates share the same environment and theoretical reference.
    // This intentionally computes replacement damage only, not five searches
    // and 32 Shapley evaluations for every inventory row.
    function scoreBatch(request,candidates,referenceResult) {
        const evaluator=makeEvaluator(request),current=normalizeBuild(request.input.artifacts),basis=request.basis||'A'
        const refKey=referenceKey(request,basis)
        if(referenceResult.basis!==basis||referenceKey(referenceResult.conditions,basis)!==refKey)throw Error('批量评分参照的计算条件已经变化')
        const currentDamage=evaluator.evaluate(current),baselineDamage=evaluator.evaluate(baselineBuild(current,basis))
        return candidates.map(candidate=>{
            inferPiece(candidate)
            const original=current.find(a=>a.slot===candidate.slot)
            const comparable=basis==='B'||(original.set_name===candidate.set_name&&canonical(original.main_stat)===canonical(candidate.main_stat))
            const build=current.map(a=>a.slot===candidate.slot?candidate:a),value=evaluator.evaluate(build)
            return {id:candidate.id,slot:candidate.slot,damage:value,gain:value-currentDamage,
                comparable,score:comparable&&referenceResult.referenceFeasible?normalizeGain(value,baselineDamage,referenceResult.referenceDamage):null,
                feasible:(evaluator.violation?.(build)??0)===0&&(basis==='A'||matchesSets(build,request.constraints?.set_mode))}
        })
    }
    return {score,scoreBatch,clear(){cache.clear();results.clear()}}
}
export const createMonaScoreService = mona => createDynamicScoreService(request=>createMonaEvaluator(mona,request))
