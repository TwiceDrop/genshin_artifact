import {damageComparison} from './damage-comparison.mjs'
import {visibleDamageReactionKeys} from './reaction-labels.mjs'

// A history row stores gear, not a previously measured skill. Both analyses must
// be evaluated with today's skill/options; an infusion or heal change may still
// produce different kinds of hits from the two equipment sets.
export function sameHitBaseline(analysis, baseline, reaction) {
    if (!visibleDamageReactionKeys(analysis).includes(reaction) || !visibleDamageReactionKeys(baseline).includes(reaction)) return null
    if (Boolean(analysis.is_heal) !== Boolean(baseline.is_heal) || analysis.element !== baseline.element) return null
    return baseline[reaction].expectation
}

export function changedAffixes(oldItem, newItem) {
    const lines=[]
    if(oldItem?.mainTag.name!==newItem?.mainTag.name || oldItem?.mainTag.value!==newItem?.mainTag.value)
        lines.push({kind:'主词条',old:oldItem?.mainTag,now:newItem?.mainTag})
    const previous=new Map((oldItem?.normalTags||[]).map(t=>[t.name,t]))
    const current=new Map((newItem?.normalTags||[]).map(t=>[t.name,t]))
    for(const name of new Set([...previous.keys(),...current.keys()])) {
        const old=previous.get(name),now=current.get(name)
        if(old?.value!==now?.value)lines.push({kind:'副词条',old,now})
    }
    return lines
}

// Read the DSL VM's actual result variable (the program may already print other
// values); never substitute the selected hit or a search rank ratio for it.
export function dslObjective(mona,input,artifacts) {
    const r=mona.DSLInterface.run(input.target_function.dsl_source+'\nprint(result)',input,artifacts)
    if(r.is_error)throw new Error(r.error_msg)
    const printed=r.output.trim().split(/\r?\n/).at(-1)?.replace(/^MONA:\s*/,'').trim()
    const n=Number(printed)
    if(!printed||!Number.isFinite(n))throw new Error('DSL 的 result 不是有限数值：'+printed)
    return n
}
export function percentChange(value,baseline) {
    if(!Number.isFinite(value)||!Number.isFinite(baseline)||baseline===0)return ''
    return damageComparison(value,baseline).percent
}
export const displayScore = n => Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—'

