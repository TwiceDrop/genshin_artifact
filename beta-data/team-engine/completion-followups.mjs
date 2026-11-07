import {actionTime} from './rule-utils.mjs';

// Only finite causal descendants inherit action completion. A summon clock is
// a new persistent source and does not carry this provenance into its ticks.
export function inheritCompletion(event,cause){
 if(event.persistent||event.completionRoot!==undefined)return event;
 const root=event.followup?cause?.completionRoot:(event.kind==='hit'&&['cast','action'].includes(cause?.kind)?cause.id:undefined);
 return root===undefined?event:{...event,completionRoot:root};
}
export function completionAllowance(profiles,packages){
 const delays=profiles.map(p=>packages[p.character.name].finiteFollowupDelay?.(p)??0);
 // EC's first finite damage follows its application by ten frames; subsequent
 // periodic ticks do not extend the user's axis.
 const elements=new Set(profiles.map(p=>packages[p.character.name].element));
 const reaction=elements.has('Hydro')&&elements.has('Electro')?10/60:profiles.some(p=>packages[p.character.name].usesElementalApplications)?1/60:0;
 return actionTime(delays.reduce((n,v)=>n+v,reaction));
}
export const visibleAtEnd=(m,event,duration,include)=>include?m.ge(duration,event.time):m.lt(event.time,duration);
