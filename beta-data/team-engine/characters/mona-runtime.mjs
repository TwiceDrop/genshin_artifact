import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

export const MONA_BUBBLE_APPLICATION_DELAY=107/60;
export const omenDuration=level=>[4,4,4,4.5,4.5,4.5,5,5,5,5,5,5,5,5,5][level];
export const monaBubbleCompletion=action=>actionTime(action.time+MONA_BUBBLE_APPLICATION_DELAY+(action.params?.bubbleDelayMs??8000)/1000+1/60);

// Definitions and fixed action times are shared; every target's actual bubble,
// Omen and completion are owned by this candidate runtime.
export function createMonaRuntime({role,profile,hit,addWindow,activeRole,enqueue,reactions,settings={},
 math:m=scalarMath,complete=(action,time)=>{action.completionTime=time;},observeHit=event=>event.enabled??1}){
 const and=(a,b)=>m.choose(a,b,0),possible=x=>typeof x==='object'||!!x;
 const cycles=new Map(),scheduled=new Set(),history=[],empty=Array.from({length:settings.enemy_count??1},()=>-Infinity);
 let omenUntil=[...empty],stacks=0,expiry=-Infinity,nextTick=Infinity;
 const remember=e=>history.push({at:afterEvent(e),until:[...omenUntil]});
 const stateAt=e=>({omen:(history.findLast(row=>compareEventPosition(row.at,e)<=0)?.until??empty).map(until=>m.lt(e.time,until))});
 const covered=(time,rootOrder=Infinity)=>stateAt({time,rootOrder}).omen.reduce((a,b)=>m.max(a,b),0);
 function tick(time){
  if(scheduled.has(time))return;scheduled.add(time);
  enqueue({kind:'timer',mechanic:'mona.c6',role,time,rootOrder:-Infinity,eventId:'mona.c6/'+time});
 }
 function finish(cycle){complete(cycle.action,[...cycle.targets.values()].reduce((end,target)=>m.max(end,target.completion),cycle.action.time));}
 function pop(cycle,id,gate,cause){
  if(!possible(gate))return;
  const target=cycle.targets.get(id),at=actionTime(cause.time+1/60),end=actionTime(cause.time+omenDuration(profile.character.skill3));
  target.window.end=m.choose(gate,end,target.window.end);
  omenUntil[id]=m.choose(gate,end,omenUntil[id]);remember(cause);
  target.completion=m.choose(gate,at,target.completion);target.active=m.choose(gate,0,target.active);finish(cycle);
  hit(cycle.action,{index:10,category:'burst',parts:1,element:'Hydro',application:application(2,'mona.burst',3,2.5),monaBubble:true,targetIds:[id],
   resolvedInstances:['mona.bubble/'+cycle.action.id+'/'+id],enabled:gate,label:'星命定轨·泡影破裂',triggerEventId:eventKey(cause)},
   at-cycle.action.time,'bubble/'+id+'/'+eventKey(cause));
 }
 function affected(e,visit){
  for(const cycle of cycles.values()){
   if(!cycle.auto||e.time>cycle.deadline)continue;
   for(const id of hitTargets(e,settings)){
    if(e.resolvedInstances?.includes('mona.bubble/'+cycle.action.id+'/'+id))continue;
    const target=cycle.targets.get(id);if(!target)continue;
    const enabled=and(target.active,e.enabled??1);if(possible(enabled))visit(cycle,id,enabled);
   }
  }
 }
 return {
  covered,stateAt,
  onEvent(e){
   if(e.role!==role)return;
   const gate=e.enabled??1;if(!possible(gate))return;
   if(e.kind==='cast'&&e.action==='burst'){
    const deadline=actionTime(e.time+MONA_BUBBLE_APPLICATION_DELAY+(e.params?.bubbleDelayMs??8000)/1000);
    const cycle={action:e,auto:e.params?.bubbleDelayMs===undefined,deadline,targets:new Map()};cycles.set(e.id,cycle);
    complete(e,m.choose(gate,actionTime(deadline+1/60),e.time));
    enqueue({kind:'timer',mechanic:'mona.bubble',role,time:deadline,rootOrder:e.rootOrder+19,eventId:e.id+'/bubble-timer',castId:e.id,enabled:gate});
   }else if(e.mechanic==='mona.bubble'){
    const cycle=cycles.get(e.castId);
    for(const [id,target]of cycle.targets)pop(cycle,id,and(gate,target.active),e);
   }else if(e.mechanic==='mona.c6'){
    const due=and(gate,m.eq(nextTick,e.time)),live=and(due,covered(e.time,e.rootOrder));
    const old=m.choose(m.ge(e.time,expiry),0,stacks),gain=and(live,activeRole(e.time,e.rootOrder)===role);
    stacks=m.choose(live,m.choose(gain,m.min(3,m.add(old,1)),old),stacks);expiry=m.choose(gain,actionTime(e.time+8),expiry);
    nextTick=m.choose(due,m.choose(live,actionTime(e.time+1),Infinity),nextTick);
    if(possible(live))tick(actionTime(e.time+1));
   }
  },
  afterEvent(e){
   if(e.kind==='application'&&e.role===role&&e.monaBubbleApplication){
    const cycle=cycles.get(e.castId),gate=e.enabled??1,continuing=covered(e.time,e.rootOrder),ids=hitTargets(e,settings);
    for(const id of ids){
     // Replacement happens on application, and only on the affected targets.
     for(const other of cycles.values()){
      const target=other.targets.get(id);if(!target)continue;
      const cancel=and(gate,target.active);target.active=m.choose(cancel,0,target.active);
      target.window.end=m.choose(cancel,e.time,target.window.end);
      target.completion=m.choose(cancel,other.action.time,target.completion);finish(other);
     }
     const end=actionTime(cycle.deadline+omenDuration(profile.character.skill3));
     const window=addWindow('monaOmen',e,end-e.time,0,{targetId:id});
     cycle.targets.set(id,{active:gate,completion:m.choose(gate,actionTime(cycle.deadline+1/60),cycle.action.time),window});
     omenUntil[id]=m.choose(gate,end,omenUntil[id]);
    }
    remember(e);finish(cycle);reactions.watchFrozen(ids,cycle.deadline);
    if(profile.character.constellation>=6){
     const start=and(gate,m.choose(m.eq(nextTick,Infinity),1,m.choose(continuing,0,1))),next=actionTime(e.time+1);
     nextTick=m.choose(start,next,nextTick);if(possible(start))tick(next);
    }
   }else if(e.kind==='aura_change'&&e.element==='Frozen'&&e.change==='expire'){
    affected(e,(cycle,id,gate)=>pop(cycle,id,gate,e));
   }else if(e.kind==='hit'&&e.noImpulse!==true){
    // Reaction ticks can exert impulse without being normal hit triggers.
    // Read Frozen after this hit's application/shatter has resolved.
    affected(e,(cycle,id,gate)=>{
     const eligible=and(gate,m.eq(reactions.currentAura('Frozen',id),0));
     if(possible(eligible))pop(cycle,id,and(eligible,observeHit(e,eligible)),e);
    });
   }
  },
  prepareHit(e){
   if(profile.character.constellation<6||e.category!=='charged')return;
   e.monaC6Stacks=m.choose(m.ge(e.time,expiry),0,stacks);
   stacks=m.choose(e.enabled??1,0,stacks);
  },
 };
}
