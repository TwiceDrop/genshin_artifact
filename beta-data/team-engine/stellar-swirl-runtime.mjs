import {actionTime} from './rule-utils.mjs';
import {eventKey} from './event-order.mjs';
import {reactionDamageEvent} from './reaction-events.mjs';
import {elementalApplication} from './ice-electro-reactions.mjs';

// One encounter-wide vortex, with candidate-valued participants and stacks.
// Aura ownership is per source; a party slot alone never makes a contributor.
export function createStellarSwirlRuntime({math:m,targets,actorIds,actorElements,enqueue,emitReaction}){
 const and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v;
 const sources=targets.map(()=>actorIds.map(()=>({amount:0,decay:0,frozen:0}))),births=new Map();
 const s={until:-Infinity,count:0,token:0,owner:0,contributors:actorIds.map(()=>0),radianceUntil:-Infinity,supportUntil:-Infinity,wandering:0,wanderingAfter:-Infinity,anemoShredUntil:-Infinity};let serial=0,clock=0;
 const snapshot=e=>({time:e.time,rootOrder:e.rootOrder,order:e.order,step:e.step??0});
 function damage(e,owner,contributors,mult,element,enabled,key,delay=0){
  if(!possible(enabled))return;
  const fact={...e,role:owner,ownerActorId:actorIds[owner],sourceActorId:actorIds[owner],triggerActorId:actorIds[owner],reactionType:'StellarSwirl',reactionOrigin:'resolved',targetIds:targets.map((_,i)=>i),contributors:contributors.map((gate,r)=>({actorId:actorIds[r],role:r,enabled:gate})),enabled};
  enqueue({...reactionDamageEvent(fact,{damageModel:'reaction.stellarSwirl',element,label:element==='Anemo'?'星扩散·风伤':'星涡爆发',hitTriggers:false,application:element==='Cryo'?elementalApplication():null,stellarSwirlMultiplier:mult,stellarSnapshot:snapshot(e),enabled,key},{actorIds,math:m}),time:actionTime(e.time+delay),followup:element==='Anemo',...(element==='Cryo'?{completionRoot:undefined}:{})});
 }
 function explode(e,gate){
  const mult=m.choose(m.ge(s.count,3),3,2);
  const wandering=and(gate,s.wandering);
  s.wanderingAfter=m.choose(wandering,actionTime(e.time+5),s.wanderingAfter);s.anemoShredUntil=m.choose(wandering,actionTime(e.time+6),s.anemoShredUntil);
  for(let owner=0;owner<actorIds.length;owner++)damage(e,owner,[...s.contributors],mult,'Cryo',and(gate,m.eq(s.owner,owner)),'vortex/'+s.token+'/'+owner);
  s.until=m.choose(gate,-Infinity,s.until);s.count=m.choose(gate,0,s.count);s.contributors=s.contributors.map(v=>m.choose(gate,0,v));
 }
 return {
  enableWandering(e,duration,gate){
   s.supportUntil=m.choose(gate,actionTime(e.time+duration),s.supportUntil);
   const convert=and(gate,m.lt(e.time,s.until));s.wandering=m.choose(convert,1,s.wandering);
   s.anemoShredUntil=m.choose(convert,actionTime(e.time+6),s.anemoShredUntil);
  },
  state:()=>({vortexUntil:s.until,wandering:s.wandering,wanderingAfter:s.wanderingAfter,anemoShredUntil:s.anemoShredUntil}),
  prepare(e){
   const elapsed=e.time-clock;for(const rows of sources)for(const a of rows)a.amount=m.max(0,m.sub(a.amount,m.mul(elapsed,a.decay)));clock=e.time;
   for(const [id,rows]of sources.entries())for(const a of rows){a.amount=m.min(a.amount,targets[id].Cryo.amount);a.frozen=m.min(a.frozen,targets[id].Frozen.amount);}
   if(e.mechanic==='reaction.vortex.expire')explode(e,and(e.enabled??1,and(m.eq(s.token,e.token),m.eq(e.time,s.until))));
  },
  record(e,id,pass,attach,frozen){
   if(e.element!=='Cryo')return;const a=sources[id][e.role];
   a.decay=m.choose(and(attach,m.eq(a.amount,0)),m.div(m.mul(.8,e.application.gauge),m.add(m.mul(2.5,e.application.gauge),7)),a.decay);
   a.amount=m.choose(attach,m.max(a.amount,m.mul(.8,e.application.gauge)),a.amount);
   if(actorElements[e.role]==='Cryo')a.frozen=m.choose(and(pass,frozen),targets[id].Frozen.amount,a.frozen);
  },
  apply(e,id,gate){
   const members=sources[id].map((a,r)=>r===e.role?1:m.gt(m.add(a.amount,a.frozen),0));
   const fact=emitReaction(e,{reactionType:'StellarSwirl',elements:['Anemo','Cryo'],targetIds:[id],enabled:gate,instanceId:'stellar-swirl/'+id,contributors:members.map((enabled,r)=>({role:r,actorId:actorIds[r],enabled}))});
   damage(fact,e.role,members,.75,'Anemo',gate,'initial/'+id,3/60);
   const create=and(gate,m.ge(e.time,s.until)),token=++serial;
   s.token=m.choose(create,token,s.token);s.until=m.choose(create,actionTime(e.time+181/60),s.until);s.owner=m.choose(gate,e.role,s.owner);
   const supported=m.lt(e.time,s.supportUntil);s.wandering=m.choose(create,supported,s.wandering);
   s.anemoShredUntil=m.choose(and(create,supported),actionTime(e.time+6),s.anemoShredUntil);
   // The first contact creates one vortex level even when it hits several foes.
   const contact=eventKey(e),birth=m.max(births.get(contact)??0,create);births.set(contact,birth);const increment=m.choose(birth,0,1);
   s.count=m.choose(create,1,m.choose(gate,m.add(s.count,increment),s.count));
   s.contributors=s.contributors.map((old,r)=>m.choose(gate,m.max(m.choose(create,0,old),members[r]),old));
   s.radianceUntil=m.choose(gate,m.add(actionTime(e.time+8),m.choose(supported,4,0)),s.radianceUntil);
   if(possible(create))enqueue({kind:'timer',time:actionTime(e.time+181/60),rootOrder:e.rootOrder,role:e.role,eventId:eventKey(fact)+'/vortex-expiry',mechanic:'reaction.vortex.expire',token,enabled:create});
   explode(e,and(gate,m.ge(s.count,6)));
  },
  radiance:time=>m.lt(time,s.radianceUntil),
  until:()=>s.radianceUntil,
 };
}
