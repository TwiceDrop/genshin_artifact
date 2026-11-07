import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {triggersReaction} from '../reaction-events.mjs';

export const qiqiApplication=()=>application(1,'qiqi.elementalArt',2,2);
export const qiqiSnapshot=a=>({time:actionTime(a.time+32/60),rootOrder:a.rootOrder+19.9,order:0,step:0});
export function createQiqiRuntime({role,profile,profiles,math:m=scalarMath,reactions,enqueue,activeRole,observeHit=e=>e.enabled??1}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v;
 const coordinateReady=profiles.map(()=>-Infinity),incomingUntil=profiles.map(()=>-Infinity),bursts=new Map(),history=[];
 let heraldUntil=-Infinity,snapshot;
 const remember=e=>history.push({at:afterEvent(e),heraldUntil,snapshot,incomingUntil:[...incomingUntil]});
 const emit=(e,values,delay,key)=>enqueue({kind:'hit',followup:true,role,time:actionTime(e.time+delay),rootOrder:e.rootOrder,order:e.order,step:delay?0:(e.step??0)+1,part:0,element:'Cryo',...values,eventId:eventKey(e)+'/'+key,parentEventId:eventKey(e)});
 return {
  stateAt(e){const row=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {herald:row?m.lt(e.time,row.heraldUntil):0,snapshot:row?.snapshot?.time<=e.time?row.snapshot:undefined,incoming:profiles.map((_,r)=>row?m.lt(e.time,row.incomingUntil[r]):0)};},
  onEvent(e){
   const gate=e.enabled??1;
   if(triggersReaction(e)&&teamTalentUnlocked(c,1)&&activeRole(e.time,e.rootOrder)===e.role){
    const active=and(gate,m.lt(e.time,heraldUntil));incomingUntil[e.role]=m.choose(active,actionTime(e.time+8),incomingUntil[e.role]);remember(e);return;
   }
   if(e.role!==role||e.kind!=='cast')return;
   if(e.action==='skill'){heraldUntil=m.choose(gate,actionTime(e.time+15),heraldUntil);snapshot=qiqiSnapshot(e);remember(e);}
   if(e.action==='burst')bursts.set(e.id,and(gate,reactions.view().radiance));
  },
  onHit(e){
   const gate=and(e.enabled??1,observeHit(e));if(!possible(gate))return;
   if(e.role===role&&e.qiqiBurst){const enabled=and(gate,bursts.get(e.qiqiBurst));if(possible(enabled))emit(e,{index:19,category:'burst',damageModel:'reaction.stellarConduct',application:null,enabled,label:'救苦度厄·星超导'},0,'burst-star');}
   if(e.role!==activeRole(e.time,e.rootOrder)||e.damageModel==='reaction.superconduct'||e.noCoordinate)return;
   const enabled=and(gate,and(m.lt(e.time,heraldUntil),m.ge(e.time,coordinateReady[e.role])));
   coordinateReady[e.role]=m.choose(enabled,actionTime(e.time+2.2),coordinateReady[e.role]);
   if(possible(enabled))emit(e,{index:16,category:'skill',application:qiqiApplication(),noCoordinate:true,enabled,label:'寒病鬼差·协同攻击'},1/60,'coordinate');
  },
 };
}
