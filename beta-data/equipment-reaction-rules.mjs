import {TEAM_DPS_REACTIONS} from './team-dps-config.mjs';
// User-selected theory: a wielder's elemental hit reacts with the compatible
// elements present in the party. The hit owner owns the reaction.
const pairs=['Frozen','Melt','Vaporize','Superconduct','ElectroCharged','Overloaded','Bloom','Quicken','Burning'];
export function equipmentReactionFacts(events,elements,roots=[]){
 // The action engine supplies actual post-ICD reactions. A multi-target hit
 // remains one trigger for wearer buffs; its separate target facts stay in Debug.
 if(events.some(h=>Array.isArray(h.reactionFacts)))return events.flatMap(h=>[...new Map((h.reactionFacts??[]).map(f=>[f.reaction,f])).values()].map(f=>({...h,...f,kind:'reaction',order:h.order+.01}))).sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||a.order-b.order);
 const available=new Set(elements);
 const explicit=roots.filter(h=>h.kind==='reaction').map(h=>({...h,elements:TEAM_DPS_REACTIONS[h.reaction]}));
 return [...explicit,...events.flatMap(h=>pairs.filter(name=>{
  const pair=TEAM_DPS_REACTIONS[name];return pair.includes(h.element??elements[h.role])&&pair.every(el=>available.has(el))&&!explicit.some(e=>e.role===h.role&&e.time===h.time&&e.reaction===name);
 }).map(reaction=>({...h,kind:'reaction',reaction,elements:TEAM_DPS_REACTIONS[reaction],order:h.order+.01})))].sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||a.order-b.order);
}
