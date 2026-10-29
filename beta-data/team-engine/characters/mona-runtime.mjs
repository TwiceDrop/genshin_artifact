import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {actionTime,chronological} from '../rule-utils.mjs';

export const omenDuration=level=>[4,4,4,4.5,4.5,4.5,5,5,5,5,5,5,5,5,5][level];

// The preview and candidate runtime execute this same state machine. Time slots
// are concrete; existence, Omen expiry, resources and completion remain numeric.
export function createMonaRuntime({role,profile,hit,addWindow,activeRole,enqueue,
 math:m=scalarMath,complete=(action,time)=>{action.completionTime=time;},
 observeHit=event=>event.enabled??1}){
 const and=(a,b)=>m.choose(a,b,0),possible=x=>typeof x==='object'||!!x;
 const cycles=[],scheduled=new Set();
 let bubble,stacks=0,expiry=-Infinity,nextTick=Infinity;
 const covered=(time,rootOrder=Infinity)=>cycles.reduce((value,cycle)=>{
  const w=cycle.window;
  if(time<w.start||time===w.start&&rootOrder<w.rootOrder)return value;
  const inside=m.choose(m.lt(time,w.end),1,and(m.eq(time,w.end),m.lt(rootOrder,w.endOrder??-Infinity)));
  return m.max(value,and(cycle.enabled,inside));
 },0);
 function tick(time){
  if(scheduled.has(time))return;scheduled.add(time);
  enqueue({kind:'timer',mechanic:'mona.c6',role,time,rootOrder:-Infinity,eventId:'mona.c6/'+time});
 }
 function pop(time,gate,cause){
  if(!possible(gate))return;
  const cycle=bubble,at=actionTime(time+1/60);
  cycle.window.end=m.choose(gate,actionTime(time+omenDuration(profile.character.skill3)),cycle.window.end);
  cycle.completion=m.choose(gate,at,cycle.completion);complete(cycle.action,cycle.completion);
  cycle.active=m.choose(gate,0,cycle.active);
  hit(cycle.action,{index:10,category:'burst',parts:1,element:'Hydro',monaBubble:true,resolvedInstances:['mona.bubble/'+cycle.action.id],enabled:gate,
   label:'星命定轨·泡影破裂',triggerEventId:cause},at-cycle.action.time,'bubble');
 }
 return {
  covered,
  onEvent(e){
   if(e.role!==role)return;
   const gate=e.enabled??1;if(!possible(gate))return;
   if(e.kind==='cast'&&e.action==='burst'){
    const continuing=covered(e.time,e.rootOrder);
    if(bubble){
     const cancel=and(gate,bubble.active);
     bubble.window.end=m.choose(cancel,e.time,bubble.window.end);bubble.window.endOrder=m.choose(cancel,e.rootOrder,bubble.window.endOrder??-Infinity);
     bubble.completion=m.choose(cancel,bubble.action.time,bubble.completion);complete(bubble.action,bubble.completion);
     bubble.active=m.choose(gate,0,bubble.active);
    }
    const delay=(e.params?.bubbleDelayMs??8000)/1000,deadline=actionTime(e.time+delay);
    bubble={action:e,auto:e.params?.bubbleDelayMs===undefined,deadline,active:gate,enabled:gate,
     completion:actionTime(deadline+1/60),window:addWindow('monaOmen',e,delay+omenDuration(profile.character.skill3))};
    cycles.push(bubble);complete(e,bubble.completion);
    enqueue({kind:'timer',mechanic:'mona.bubble',role,time:deadline,rootOrder:e.rootOrder+19,eventId:e.id+'/bubble-timer',castId:e.id});
    if(profile.character.constellation>=6){
     const start=and(gate,m.choose(m.eq(nextTick,Infinity),1,m.choose(continuing,0,1))),next=actionTime(e.time+1);
     nextTick=m.choose(start,next,nextTick);if(possible(start))tick(next);
    }
   }else if(e.mechanic==='mona.bubble'&&bubble?.action.id===e.castId)pop(e.time,and(gate,bubble.active),e.eventId);
   else if(e.mechanic==='mona.c6'){
    const due=and(gate,m.eq(nextTick,e.time)),live=and(due,covered(e.time,e.rootOrder));
    const old=m.choose(m.ge(e.time,expiry),0,stacks),gain=and(live,activeRole(e.time,e.rootOrder)===role);
    stacks=m.choose(live,m.choose(gain,m.min(3,m.add(old,1)),old),stacks);
    expiry=m.choose(gain,actionTime(e.time+8),expiry);
    nextTick=m.choose(due,m.choose(live,actionTime(e.time+1),Infinity),nextTick);
    if(possible(live))tick(actionTime(e.time+1));
   }
  },
  onHit(e){
   if(!bubble?.auto||chronological(e,bubble.action)<=0||e.time>bubble.deadline)return;
   // A possible pop and its still-active alternative are mutually exclusive.
   // Its own child cannot pop the same cast again during symbolic lowering.
   // A delayed pop from an earlier cast can still contact a newer bubble.
   if(e.resolvedInstances?.includes('mona.bubble/'+bubble.action.id))return;
   const eligible=and(bubble.active,e.enabled??1);
   if(possible(eligible))pop(e.time,and(eligible,observeHit(e,eligible)),e.eventId);
  },
  prepareHit(e){
   if(profile.character.constellation<6||e.category!=='charged')return;
   const gate=e.enabled??1;
   e.monaC6Stacks=m.choose(m.ge(e.time,expiry),0,stacks);
   const omen=covered(e.time,e.rootOrder);e.monaC6Omen=typeof omen==='object'?omen:!!omen;
   stacks=m.choose(gate,0,stacks);
  },
 };
}
