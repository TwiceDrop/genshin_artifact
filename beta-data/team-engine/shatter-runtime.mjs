import {actionTime} from './rule-utils.mjs';
import {reactionDamageEvent} from './reaction-events.mjs';

// Shatter removes Frozen before the contact's elemental application, while
// the contact's own stat read still observes the pre-reaction target state.
export function createShatterRuntime({math:m,targets,actorIds,emitReaction,enqueue,observeHit}){
 const ready=targets.map(()=>-Infinity),damageClocks=new Map();
 const and=(a,b)=>m.choose(a,b,0),possible=x=>typeof x==='object'||!!x;
 return {apply(e,ids){
  if(!e.blunt&&e.element!=='Geo'||e.hitTriggers===false)return false;
  const gate=and(e.enabled??1,observeHit(e));if(!possible(gate))return false;
  let changed=false;
  for(const id of ids){
   const aura=targets[id].Frozen,trigger=and(gate,m.gt(aura.amount,0));if(!possible(trigger))continue;
   changed=true;aura.amount=m.choose(trigger,m.max(0,m.sub(aura.amount,8)),aura.amount);
   const fact=emitReaction(e,{reactionType:'Shatter',reactionTriggers:false,elements:['Cryo','Physical'],targetIds:[id],enabled:trigger,instanceId:'shatter/'+id});
   const attempt=and(trigger,m.ge(e.time,ready[id]));ready[id]=m.choose(attempt,actionTime(e.time+.2),ready[id]);
   const key=JSON.stringify([actorIds[e.role],id]),old=damageClocks.get(key)??{count:0,until:-Infinity},reset=m.ge(e.time,old.until),count=m.choose(reset,0,old.count),enabled=and(attempt,m.lt(count,2));
   damageClocks.set(key,{count:m.choose(attempt,m.min(2,m.add(count,1)),old.count),until:m.choose(and(attempt,reset),actionTime(e.time+.5),old.until)});
   if(!possible(enabled))continue;
   const reactionSnapshot={time:e.time,rootOrder:e.rootOrder,order:e.order,step:e.step??0,fields:['em','shatter_bonus']};
   enqueue(reactionDamageEvent(fact,{damageModel:'reaction.shatter',element:'Physical',label:'碎冰',hitTriggers:false,reactionSnapshot,enabled,targetIds:[id]},{actorIds,math:m}));
  }
  return changed;
 }};
}
