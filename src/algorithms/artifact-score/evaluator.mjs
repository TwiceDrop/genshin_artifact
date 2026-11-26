import {dslObjective} from '../single-result-comparison.mjs'
import {clone} from './rules.mjs'
import {PANEL_STATS} from '../../../beta-data/panel-search.mjs'
export function createMonaEvaluator(mona,request) {
    const input=clone(request.input),objective=request.objective
    const limits=PANEL_STATS.map(({key,minimum})=>({key,min:request.constraints?.[minimum],max:request.constraints?.panel_max?.[key]}))
        .filter(({min,max})=>min>0||max!=null)
    if(['single_hit_context','ordinary_bloom_context','lunar_crystallize_context','direct_lunar_context','lunar_electro_context','direct_stellar_context','stellar_swirl_context'].some(key=>input[key]))throw Error('手填固定面板不会随候选装备变化，不能用于动态评分')
    const dslTarget=objective.kind==='dsl'
        ? mona.DSLInterface.prepareObjective?.(input.target_function.dsl_source,input) : null
    function config(artifacts) {return {...input,artifacts}}
    function panel(artifacts) {
        return Object.fromEntries(Object.entries(mona.CommonInterface.get_attribute(config(artifacts)))
            .filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(Number.isFinite))
            .map(([key,values])=>[key,Object.values(values).reduce((a,b)=>a+b,0)]))
    }
    return {scope:'personal-damage',panel,
        close: dslTarget?.close,
        evaluate(artifacts) {
            let value
            if(objective.kind==='dsl')value=dslTarget ? dslTarget.evaluate(artifacts) : dslObjective(mona,config(artifacts),artifacts)
            else {
                const result=mona.CalculatorInterface.get_damage_analysis(config(artifacts),objective.infusion==='None'?null:objective.infusion)
                if(result.is_heal||result.is_shield)throw Error('当前技能为治疗／护盾，请使用喵喵评分或选择伤害目标')
                value=result[objective.reaction]?.expectation
            }
            if(!Number.isFinite(value))throw Error('动态评分目标未返回有限数值，请检查技能、反应或 DSL result')
            return value
        },
        violation(artifacts) {
            if(!limits.length)return 0
            const values=panel(artifacts)
            return limits.reduce((sum,{key,min,max})=>{
                const gap=min>0&&values[key]<min?(min-values[key])/min
                    :max!=null&&values[key]>max?(values[key]-max)/(Math.abs(max)||1):0
                return sum+(gap>32*Number.EPSILON?gap:0)
            },0)
        },
    }
}
