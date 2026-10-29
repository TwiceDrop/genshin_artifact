// Encounter targets and scored targets are independent. A hit can spend a
// finite pool on enemies whose damage is not selected for the result.
export const hitTargets=(event,settings)=>event.targetIds??Array.from({length:settings.enemy_count??1},(_,i)=>i);
export const scoredTargets=(event,settings)=>{
 const targets=hitTargets(event,settings);
 return settings.damage_scope==='all'?targets:targets.filter(id=>id===0);
};
export function scoredUses(event,used,settings,m,scored=scoredTargets(event,settings)){
 const targets=hitTargets(event,settings);
 return scored.reduce((n,id)=>m.add(n,m.choose(m.gt(used,targets.indexOf(id)),1,0)),0);
}
