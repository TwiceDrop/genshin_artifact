import {actionTime} from './rule-utils.mjs';
import {eventKey} from './event-order.mjs';
import {reactionDamageEvent} from './reaction-events.mjs';
import {elementalApplication} from './ice-electro-reactions.mjs';

export function createSwirlRuntime({math:m,targets,actorIds,enqueue,emitReaction,stellar}){
 const and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v,damageICDs=new Map(),triggerICDs=new Map();
 return {prepare(e){
  if(e.mechanic!=='reaction.swirl.hit')return;
  const {fact,element,victim}=e,key=actorIds[fact.role]+'/'+element+'/'+victim,s=damageICDs.get(key)??{until:-Infinity,count:0},reset=m.ge(e.time,s.until),count=m.choose(reset,0,s.count),enabled=and(e.enabled,m.lt(count,2));
  s.count=m.choose(e.enabled,m.add(count,1),s.count);s.until=m.choose(and(e.enabled,reset),actionTime(e.time+.5),s.until);damageICDs.set(key,s);
  if(possible(enabled))enqueue({...reactionDamageEvent(fact,{damageModel:'reaction.swirl'+element,element,label:element+'扩散',hitTriggers:false,application:null,targetIds:[victim],enabled,reactionSnapshot:e.snapshot,key:'aoe/'+victim},{actorIds,math:m}),time:e.time});
 },apply(e,id,pass){
  const target=targets[id],frozen=m.gt(target.Frozen.amount,0);
  let remaining=e.application.gauge;
  // Frozen shields underlying Hydro; Electro can coexist and swirl too.
  for(const element of ['Cryo','Electro','Hydro']){
   const amount=element==='Cryo'?m.max(target.Cryo.amount,target.Frozen.amount):target[element].amount;
   const gate=and(pass,and(m.gt(remaining,0),and(m.gt(amount,0),element==='Hydro'?m.choose(frozen,0,1):1)));if(!possible(gate))continue;
   const gauge=m.mul(remaining,.5),cost=m.min(remaining,m.mul(2,amount)),spread=m.add(.95,m.mul(1.25,m.choose(m.lt(cost,remaining),m.mul(.5,cost),remaining)));
   remaining=m.choose(gate,m.sub(remaining,cost),remaining);
   if(element==='Cryo'){
    target.Frozen.amount=m.choose(and(gate,frozen),m.max(0,m.sub(target.Frozen.amount,gauge)),target.Frozen.amount);
    target.Cryo.amount=m.choose(and(gate,m.choose(frozen,0,1)),m.max(0,m.sub(target.Cryo.amount,gauge)),target.Cryo.amount);
   }else target[element].amount=m.choose(gate,m.max(0,m.sub(target[element].amount,gauge)),target[element].amount);
   if(element==='Cryo'&&stellar){stellar.apply(e,id,gate);continue;}
   const fact=emitReaction(e,{reactionType:'Swirl',elements:['Anemo',element],targetIds:[id],enabled:gate,instanceId:'swirl/'+element+'/'+id});
   const triggerKey=element+'/'+id,ready=triggerICDs.get(triggerKey)??-Infinity,trigger=and(gate,m.ge(e.time,ready));triggerICDs.set(triggerKey,m.choose(trigger,actionTime(e.time+.1),ready));
   for(let victim=0;victim<targets.length;victim++){
    if(element!=='Hydro'||victim===id){
     if(possible(trigger))enqueue({kind:'timer',role:e.role,time:actionTime(e.time+(victim===id?1:5)/60),rootOrder:e.rootOrder,order:e.order,eventId:eventKey(fact)+'/hit/'+victim,mechanic:'reaction.swirl.hit',fact,element,victim,enabled:trigger,snapshot:{time:e.time,rootOrder:e.rootOrder,order:e.order,step:e.step??0,fields:['em','swirl_bonus']}});
    }
    if(victim!==id)enqueue({kind:'application',role:e.role,time:actionTime(e.time+5/60),rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+12,element,application:elementalApplication(spread),enabled:trigger,targetIds:[victim],eventId:eventKey(e)+'/swirl-spread/'+element+'/'+id+'/'+victim,parentEventId:eventKey(e),swirlSpread:true});
   }
  }
 }};
}
