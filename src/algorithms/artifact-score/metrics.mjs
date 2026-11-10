import {clone} from './rules.mjs'

export const zeroSubstats = build => build.map(a=>({...clone(a),sub_stats:[]}))
export function baselineBuild(build,basis) {return basis==='A'?zeroSubstats(build):[]}
export function normalizeGain(actual,baseline,reference,scale=350) {
    const denominator=reference-baseline
    return denominator>0?scale*(actual-baseline)/denominator:null
}
export function shapley(build,evaluate,basis) {
    const values=[],n=build.length,factorial=[1,1,2,6,24,120]
    for(let mask=0;mask<1<<n;mask++) {
        const coalition=build.flatMap((a,i)=>mask&(1<<i)?[a]:basis==='A'?[{...a,sub_stats:[]}]:[])
        values[mask]=evaluate(coalition)
    }
    const contributions=build.map((_,i)=>{
        let value=0
        for(let mask=0;mask<1<<n;mask++)if(!(mask&(1<<i))) {
            let size=0;for(let x=mask;x;x>>=1)size+=x&1
            value+=factorial[size]*factorial[n-size-1]/factorial[n]*(values[mask|(1<<i)]-values[mask])
        }
        return value
    })
    return {baseline:values[0],damage:values.at(-1),contributions,residual:values.at(-1)-values[0]-contributions.reduce((a,b)=>a+b,0)}
}
export function pieceEfficiency(current,baseline,replacement) {
    const best=Math.max(current,replacement),increment=current-baseline,denominator=best-baseline
    return {score:denominator>0&&increment>=0?70*increment/denominator:null,increment,denominator,
        replacementGain:replacement-current,replacementPercent:current>0?replacement/current-1:null}
}
