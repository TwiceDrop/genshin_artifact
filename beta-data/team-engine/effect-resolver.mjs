import {effect} from './rule-utils.mjs';
import {effectApplies} from './effect-state.mjs';
import {scoredTargets,scoredUses} from './hit-targets.mjs';

// Pure reads: displaying a hit, resolving its source panel, or requesting the
// same contribution twice never advances a lifetime or spends a use.
export function createEffectResolver(plan,state,m){
 const stages=new Map();
 for(const source of state.sources){const stage=source.definition.stage;if(!stages.has(stage))stages.set(stage,[]);stages.get(stage).push(source);}
 // Observation shape is structural. A spent/disabled numeric pool must not
 // turn three contacts into one row only on the scalar or one candidate path.
 const individual=plan.sources.filter(({definition:d})=>d.uses!==undefined&&(d.targetAggregation!=='linearFlat'||d.stacking&&(d.stacking.mode??'highest')!=='sum'));
 const needsIndividualTargets=(role,event)=>individual.some(source=>effectApplies(source.definition,source,role,event,plan.rotation.activeRole));
  function resolve(stage,role,event,read,targetIds=scoredTargets(event,plan.settings)){
  if(stage==='damage'&&targetIds.length>1&&needsIndividualTargets(role,event))throw Error('有限次数效果需要逐目标求值：'+(event.eventId??event.id));
  const grouped=new Map();
  for(const source of stages.get(stage)||[]){
   const {definition}=source;
   if(!effectApplies(definition,source,role,event,plan.rotation.activeRole))continue;
   const status=state.at(source,event);
   let gate=status.active;
   if(definition.uses!==undefined){
     const targets=targetIds.length;
     gate=targets?m.div(scoredUses(event,status.usage?.used??0,plan.settings,m,targetIds),targets):0;
   }
   if(typeof gate!=='object'&&!gate)continue;
   const liveReads=status.stackCaptures?new Map():null;
   const value=(captures,stacks)=>definition.value({m,stacks,read:name=>{
    const dependency=definition.reads[name];
    if(dependency.timing==='stack')return captures[name];
    if(dependency.timing==='activation')return status.captures[name];
    if(!liveReads)return read(source.role,dependency,event);
    if(!liveReads.has(name))liveReads.set(name,read(source.role,dependency,event));
    return liveReads.get(name);
   }});
   // A stack-timed read defines one contribution per live layer. Apply caps
   // and other nonlinear expressions before summing, never to an averaged capture.
   const values=status.stackCaptures?status.stackCaptures.reduce((total,captures,i)=>{
    const live=m.lt(event.time,status.stackExpiries[i]);if(typeof live!=='object'&&!live)return total;
    for(const [attribute,amount]of Object.entries(value(captures,1)))total[attribute]=m.add(total[attribute]??0,m.choose(live,amount,0));
    return total;
   },{}):value(undefined,status.stacks??1);
   if(definition.targetAggregation==='linearFlat'&&Object.keys(values).some(key=>key!=='ExtraDmgBase'))throw Error('线性目标汇总仅支持追加基础伤害：'+definition.id);
   const scaled=gate===1?values:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,m.mul(gate,value)]));
   const key=definition.stacking?.group??source.key,previous=grouped.get(key);
   if(previous)for(const [attribute,value]of Object.entries(scaled))previous.values[attribute]=definition.stacking?.mode==='sum'?m.add(previous.values[attribute]??0,value):m.max(previous.values[attribute]??value,value);
   else grouped.set(key,{label:definition.label,values:scaled});
  }
  return [...grouped.values()].map(({label,values})=>effect(label,values));
 }
 return {resolve,needsIndividualTargets};
}
