import {clone,inferPiece,toArtifact,seedPiece,neighbors,setPatterns,matchesSets,validatePiece} from './rules.mjs'

export const SEARCH_DEFAULTS=Object.freeze({starts:3,passes:12,finalists:3})
export function compareValues(a,b) {return a.violation-b.violation||b.damage-a.damage}
function compareSearchValues(a,b) {
    if(a.violation!==b.violation)return a.violation-b.violation
    const delta=b.damage-a.damage,tolerance=32*Number.EPSILON*Math.max(Math.abs(a.damage),Math.abs(b.damage))
    return Math.abs(delta)<=tolerance?0:delta
}
export function createMeasurements(evaluator) {
    const cache=new Map()
    let evaluations=0
    function measure(build) {
        const key=JSON.stringify(build.map(a=>[a.slot,a.set_name,a.main_stat,a.sub_stats]))
        if(cache.has(key))return cache.get(key)
        const damage=evaluator.evaluate(build),violation=evaluator.violation?.(build)??0
        if(!Number.isFinite(damage)||!Number.isFinite(violation))throw Error('评分求值器返回非有限数值')
        const value={damage,violation};evaluations++
        if(cache.size>=12000)cache.delete(cache.keys().next().value)
        cache.set(key,value);return value
    }
    return {measure,get evaluations(){return evaluations}}
}
const materialize=pieces=>pieces.map((p,i)=>toArtifact(p,i+1))
function improve(pieces,measure,{passes,mainStats,slots=[0,1,2,3,4]},onProgress) {
    pieces=clone(pieces)
    let build=materialize(pieces),value=measure(build),converged=false
    for(let pass=0;pass<passes;pass++) {
        let changed=false
        for(const i of slots) {
            let best=pieces[i],bestValue=value
            for(const candidate of neighbors(pieces[i],{mainStats})) {
                const variant=[...build];variant[i]=toArtifact(candidate,i+1)
                const next=measure(variant)
                if(compareSearchValues(next,bestValue)<0){best=candidate;bestValue=next}
            }
            if(best!==pieces[i]){pieces[i]=best;build[i]=toArtifact(best,i+1);value=bestValue;changed=true}
        }
        onProgress?.({pass:pass+1,damage:value.damage,violation:value.violation})
        if(!changed){converged=true;break}
    }
    return {pieces,build,...value,converged}
}
export function searchReference(templates,measure,{basis,sets,constraints={},search={}},onProgress=()=>{}) {
    const settings={...SEARCH_DEFAULTS,...search},seeds=[]
    for(let n=0;n<settings.starts;n++) {
        const pieces=templates.map((a,i)=>seedPiece({slot:a.slot,set_name:a.set_name,main_stat:a.main_stat},n*3+i,n===1?3:4))
        seeds.push(pieces)
    }
    if(basis==='B') {
        const patterns=setPatterns(sets,constraints.set_mode)
        // Every configured set pattern is evaluated. Only selected finalists get
        // neighborhood search; this is a heuristic, never a global certificate.
        const ranked=patterns.map(pattern=>{
            const pieces=seeds[0].map((p,i)=>({...clone(p),set_name:pattern[i]}))
            return {pieces,...measure(materialize(pieces))}
        }).sort(compareSearchValues)
        seeds.push(...ranked.slice(0,settings.finalists).map(row=>row.pieces))
    }
    let best=null
    for(let i=0;i<seeds.length;i++) {
        if(basis==='B'&&!matchesSets(materialize(seeds[i]),constraints.set_mode))continue
        const result=improve(seeds[i],measure,{...settings,mainStats:basis==='B'},event=>onProgress({stage:'reference',basis,start:i+1,starts:seeds.length,...event}))
        if(!best||compareSearchValues(result,best)<0)best=result
    }
    if(!best)throw Error('理论参照候选未满足所选套装约束')
    best.pieces.forEach(validatePiece)
    return {...best,certified:false,method:'deterministic-legal-neighborhood',termination:best.converged?'local-stationary':'pass-budget',settings,
        scope:{basis,sets:basis==='A'?[...new Set(templates.map(a=>a.set_name))]:sets,setMode:basis==='A'?'fixed':constraints.set_mode||'Any',tiers:'all-four',initial:[3,4]}}
}
export function searchReplacement(current,index,reference,measure,{basis,passes=3,constraints={}}) {
    const actual=inferPiece(current[index]),starts=[actual,reference.pieces[index]]
    if(basis==='B')for(const name of new Set(current.map(a=>a.set_name)))if(name!==actual.set_name&&name!==reference.pieces[index].set_name)starts.push({...clone(actual),set_name:name})
    // A keeps this item's main/set; B may replace its main and set. Only the
    // selected slot changes, so the returned gain is actionable for this build.
    const setMode=basis==='A'?'Any':constraints.set_mode
    let best=matchesSets(current,setMode)?{build:clone(current),...measure(current),converged:true}:null
    for(const seed of starts) {
        const pieces=current.map(inferPiece);pieces[index]=clone(seed)
        if(basis==='A'){pieces[index].set_name=actual.set_name;pieces[index].main_stat=[...actual.main_stat]}
        if(!matchesSets(materialize(pieces),setMode))continue
        // Preserve current display inputs in all four unchanged pieces.
        const score=build=>measure(build.map((a,i)=>i===index?a:current[i]))
        const candidate=improve(pieces,score,{passes,mainStats:basis==='B',slots:[index]})
        candidate.build=candidate.build.map((a,i)=>i===index?a:clone(current[i]))
        if(!best||compareSearchValues(candidate,best)<0)best=candidate
    }
    return {...(best||{build:clone(current),...measure(current),converged:false}),certified:false}
}

// Exact oracle over an explicitly supplied finite legal domain. No pruning,
// monotonicity assumption or hidden evaluation/time limit.
export function enumerateOptimum(domains,evaluator,{setMode='Any'}={}) {
    let best=null,evaluations=0
    const build=[]
    function visit(i) {
        if(i===domains.length) {
            if(!matchesSets(build,setMode))return
            const value={damage:evaluator.evaluate(build),violation:evaluator.violation?.(build)??0};evaluations++
            if(!Number.isFinite(value.damage))throw Error('枚举目标非有限')
            if(!best||compareValues(value,best)<0)best={...value,build:clone(build)}
            return
        }
        for(const piece of domains[i]) {validatePiece(piece);build[i]=toArtifact(piece,i+1);visit(i+1)}
    }
    visit(0)
    return {best,evaluations,certified:true,scope:'supplied-finite-domains'}
}
