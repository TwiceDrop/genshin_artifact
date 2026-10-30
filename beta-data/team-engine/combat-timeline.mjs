import {createIceElectroReactions} from './ice-electro-reactions.mjs';
import {actionTime,chronological} from './rule-utils.mjs';

// Character hooks consume the same chronological stream as aura and reaction
// events. Derived attacks go back into that stream, never switch the on-fielder.
export function resolveCombatTimeline(contexts,rules,{duration,endHit}){
 if(!rules.some(rule=>rule.createCombat))return null;
 const base=contexts[0],{roots,events,heals,activeRole,settings}=base;
 const reactions=createIceElectroReactions({stellarEnabled:rules.some(rule=>rule.enablesStellarConduct),targetCount:settings.enemy_count??1});
 const inside=t=>t<duration||(t===duration&&endHit==='include');
 let serial=0;
 const queue=[...roots.map(e=>({...e,originActionId:e.id,extendsAxis:true,combatKind:'command'})),...events.map(e=>({...e,combatKind:'hit'}))].map(e=>({...e,combatSerial:serial++}));
 const output=[],history=[];
 function schedule(e){e.time=actionTime(e.time);if(inside(e.time))queue.push({...e,combatSerial:serial++});}
 function addHit(parent,values,delay=0){
  schedule({role:parent.role,element:parent.element,originActionId:parent.originActionId,extendsAxis:parent.extendsAxis,...values,time:actionTime(parent.time+delay),rootOrder:values.rootOrder??parent.rootOrder+.01,serial,part:values.part??0,parts:values.parts??1,eventId:values.eventId??parent.eventId+'/'+values.label,parentEventId:parent.eventId,combatKind:'hit'});
 }
 function addHeal(parent,values,delay=0){
  const time=actionTime(parent.time+delay);if(inside(time))heals.push({role:parent.role,...values,time,kind:'heal',rootOrder:values.rootOrder??parent.rootOrder+.02,eventId:values.eventId??parent.eventId+'/'+values.healing,parentEventId:parent.eventId});
 }
 const shared={...base,reactions,schedule,addHit,addHeal};
 const handlers=contexts.map((ctx,i)=>rules[i].createCombat?.({...shared,...ctx})??{state:{}});
 const snapshot=time=>({time,states:handlers.map(h=>structuredClone(h.state??{})),reaction:reactions.view(time)});
 const initial=snapshot(0);
 function remember(e){history.push({time:e.time,rootOrder:e.rootOrder,combatSerial:e.combatSerial,...snapshot(e.time)});}
 while(queue.length){
  queue.sort((a,b)=>chronological(a,b)||a.combatSerial-b.combatSerial);
  const e=queue.shift();if(e.time>duration)break;
  reactions.advance(e.time);
  for(const handler of handlers)handler.advance?.(e);
  if(e.combatKind==='command'){
   e.onField=activeRole(e.time,e.rootOrder)===e.role;
   for(const handler of handlers)handler.onCommand?.(e);
   const root=roots.find(a=>a.id===e.id&&a.kind===e.kind);
   if(root)root.combat=snapshot(e.time);
  }else if(e.combatKind==='hit'){
   if(!inside(e.time))continue;
   e.onField=activeRole(e.time,e.rootOrder)===e.role;
   e.element??=rules[e.role].element;
   if(e.damageKind==='stellarConduct')e.category='reaction';
   if(e.element==='Physical')e.nativeElement='Physical';
   for(const handler of handlers)handler.beforeHit?.(e);
   if(e.omitHit)continue;
   if(e.extendsAxis){const root=roots.find(a=>a.id===e.originActionId);if(root)root.completionTime=Math.max(root.completionTime??root.time,e.time);}
   e.combat=snapshot(e.time);
   const application=reactions.apply(e);
   e.applicationTargets=application.applied;
   e.reactionFacts=application.triggered;
   e.auraBefore=application.before.targets;
   e.auraAfter=application.after.targets;
   e.stellar=e.damageKind==='stellarConduct';
   output.push(e);
   for(const d of application.damage)schedule({originActionId:e.originActionId,extendsAxis:e.extendsAxis,...d,parts:1,part:0,combatKind:'hit'});
   for(const handler of handlers)handler.afterHit?.(e);
  }else e.run();
  remember(e);
 }
 reactions.advance(duration);
 events.splice(0,events.length,...output);
 const at=e=>{
  if(e.combat&&e.combat.time===e.time)return e.combat;
  const last=history.findLast(h=>chronological(h,e)<=0);
  return {time:e.time,states:last?.states??initial.states,reaction:reactions.at(e)};
 };
 return {at,history,reactions,initial};
}
