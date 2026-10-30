import {afterEvent,compareEventPosition,eventKey} from './event-order.mjs';
import {hitTargets} from './hit-targets.mjs';
import {observeProcHit} from './proc-outcomes.mjs';
import {initialEffectStacks,activateEffectStacks,effectStackCount} from './effect-stacks.mjs';
import {matchesEffect as match} from './effect-contract.mjs';

export const effectApplies=(definition,source,role,event,activeRole)=>{
 const target=definition.target,onField=activeRole(event.time,event.rootOrder)===role;
 if(target==='self'&&role!==source.role||target==='other'&&role===source.role)return false;
 if(target==='selfOnField'&&(role!==source.role||!onField)||target==='selfOffField'&&(role!==source.role||onField))return false;
 if(target==='otherOnField'&&(role===source.role||!onField))return false;
 if(target==='otherOffField'&&(role===source.role||onField))return false;
 if(target==='teamOnField'&&!onField||target==='teamOffField'&&onField)return false;
 return !definition.filter||match(definition.filter,event);
};

// Each candidate gets its own state. All mutable numeric values use m, so
// disabled activations and consumption retain the same semantics in a DAG.
export function createEffectState(plan,{math:m,enabled,read,trace=false,events=plan.schedule}){
 const records=new Map();
 for(const source of plan.sources){
  const gate=enabled(source);if(typeof gate!=='object'&&!gate)continue;
  const captures=Object.fromEntries(Object.entries(source.definition.reads).filter(([,d])=>d.timing==='activation').map(([name])=>[name,0]));
  const stackReads=Object.entries(source.definition.reads).filter(([,d])=>d.timing==='stack').map(([name])=>name),stackCaptures=stackReads.length?Object.fromEntries(stackReads.map(name=>[name,0])):undefined;
  const stacks=initialEffectStacks(source.definition.stacks,stackCaptures);
  records.set(source.key,{source,gate,stackReads,initialCaptures:captures,initialStacks:stacks,current:{expires:-Infinity,ready:-Infinity,remaining:0,generation:0,captures,...stacks},cooldowns:new Map(),history:[],usage:new Map()});
 }
 const changes=[];
 function publish(event){
  const certain=(event.probability??1)===1;
  const occurred=gate=>certain?gate:typeof gate!=='object'&&!gate?0:m.choose(gate,observeProcHit(event),0);
  for(const record of records.values()){
   const {source}=record,{definition}=source;
   // A hit spends the pool that existed before it. A trigger on that same
   // hit may then refresh the pool, but cannot retroactively enhance the hit.
   if(event.kind==='hit'&&definition.uses!==undefined&&effectApplies(definition,source,event.role,event,plan.rotation.activeRole)){
    const old=record.current,live=m.choose(event.enabled??1,m.lt(event.time,old.expires),0),spend=certain?live:occurred(m.choose(live,m.gt(old.remaining,0),0)),used=m.choose(spend,m.min(old.remaining,hitTargets(event,plan.settings).length),0);
    record.current={...old,remaining:m.sub(old.remaining,used)};
    record.usage.set(eventKey(event),{used,before:old.remaining,after:record.current.remaining});
    record.history.push({at:afterEvent(event),state:record.current});
    if(trace&&used)changes.push({effectId:definition.id,label:definition.label,role:source.role,sourceActorId:source.actorId,instanceKey:source.key,generation:old.generation,enabled:m.gt(used,0),eventId:eventKey(event),kind:'consume',time:event.time,used,before:old.remaining,after:record.current.remaining});
   }
   if(event.role===source.role&&match(definition.trigger,event)){
    const old=record.current,cooldownKey=definition.cooldownKey?.(event),ready=definition.cooldownKey?(record.cooldowns.get(cooldownKey)??-Infinity):old.ready;
    const gate=m.choose(event.enabled??1,record.gate,0),activate=occurred(m.choose(gate,m.ge(event.time,ready),0));
    const captures={...old.captures};
    if(typeof activate==='object'||activate)for(const name of Object.keys(captures))captures[name]=m.choose(activate,read(source.role,definition.reads[name],event),old.captures[name]);
    const stackCaptures=Object.fromEntries(record.stackReads.map(name=>[name,typeof activate==='object'||activate?read(source.role,definition.reads[name],event):0]));
    const stacks=activateEffectStacks(definition.stacks&&{...definition.stacks,duration:definition.duration},old,event,activate,m,stackCaptures);
    const nextReady=m.choose(activate,event.time+(definition.cooldown??0),ready);
    if(definition.cooldownKey)record.cooldowns.set(cooldownKey,nextReady);
    record.current={expires:m.choose(activate,event.time+definition.duration,old.expires),ready:nextReady,remaining:m.choose(activate,definition.uses??0,old.remaining),generation:m.choose(activate,m.add(old.generation,1),old.generation),captures,...stacks};
    record.history.push({at:afterEvent(event),state:record.current});
    if(trace&&activate)changes.push({effectId:definition.id,label:definition.label,role:source.role,sourceActorId:source.actorId,instanceKey:source.key,generation:record.current.generation,enabled:activate,activationId:eventKey(event),kind:'activate',time:event.time,expires:record.current.expires,...stacks,...(Object.keys(captures).length?{captures}:{})});
   }
  }
 }
 events.forEach(publish);
 return {
  publish,changes,sources:[...records.values()].map(record=>record.source),
  at(source,event){
   const record=records.get(source.key);
   const state=record.history.findLast(row=>compareEventPosition(row.at,event)<=0)?.state;
   const layers=state??record.initialStacks;
   return {active:state?m.lt(event.time,state.expires):0,usage:record.usage.get(eventKey(event)),captures:state?.captures??record.initialCaptures,...(source.definition.stacks?{stacks:state?effectStackCount(state,event.time,m):0}:{}),...(layers.stackCaptures?{stackCaptures:layers.stackCaptures,stackExpiries:layers.stackExpiries}:{}),...(plan.rotation.model!=='actions'&&source.definition.legacy?source.definition.legacy(plan.rotation,event):{})};
  },
 };
}
