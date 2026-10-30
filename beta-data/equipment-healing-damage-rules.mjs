import {scalarMath} from './team-dps-numeric-rules.mjs';
import {createEventScheduler} from './team-engine/scheduler.mjs';
import {hitTargets,scoredTargets,scoredUses} from './team-engine/hit-targets.mjs';
import {actionTime} from './team-engine/rule-utils.mjs';
import {eventKey} from './team-engine/event-order.mjs';

// Healing creates candidate-owned accumulators. Timers have static reachable
// times; their enabled state and recorded amounts remain numeric expressions.
export function createEquipmentHealingDamage(profiles,rotation,healAmount,has,settings={},math=scalarMath){
 const m=math,and=(a,b)=>m.choose(a,b,0),enabled=h=>h.enabled??1;
 const waves=[],procs=[],flat=new Map(),usage=new Map(),amounts=new Map(),timers=new Set();
 let songActive=0,songEnd=Infinity,songStart=0,songAmount=0,bubbleActive=0,bubbleEnd=Infinity,bubbleOwner=-1,bubbleAmount=0;
 let echoEnd=-Infinity,echoAmount=0,remaining=0;
 const cooldowns=profiles.map(()=>-Infinity),put=(list,row,gate)=>{
  if(typeof gate!=='object'){if(gate)list.push(row);}else list.push({...row,enabled:gate});
 };
 function timer(kind,time,enqueue){
  const id=kind+'/'+time;if(timers.has(id))return;timers.add(id);
  enqueue({kind,time,role:0,rootOrder:-Infinity,order:-Infinity,eventId:id});
 }
 function afterEvent(h,enqueue){
  if(h.kind==='song_end'){
   const due=and(enabled(h),and(songActive,m.eq(songEnd,h.time)));
   put(waves,{start:songStart,end:h.time,amount:songAmount},due);
   echoEnd=m.choose(due,actionTime(h.time+10),echoEnd);echoAmount=m.choose(due,songAmount,echoAmount);remaining=m.choose(due,5,remaining);
   songActive=m.choose(due,0,songActive);return;
  }
  if(h.kind==='bubble_end'){
   const due=and(enabled(h),and(bubbleActive,m.eq(bubbleEnd,h.time)));
   for(let r=0;r<profiles.length;r++){
    const owner=and(due,m.eq(bubbleOwner,r));
    if(typeof owner!=='object'&&!owner)continue;
    const id='artifact.clam/'+rotation.slots[r]+'/'+h.time;
    const event={kind:'hit',category:'equipment',element:'Physical',onField:rotation.activeRole(h.time,-1)===r,eventId:id,eventKey:id,parentEventId:h.eventId,time:h.time,role:r,label:'海染砗磲·海染泡沫',fixed:m.mul(.9,m.min(30000,bubbleAmount)),enabled:owner,ignoreDefense:true,noCrit:true,rootOrder:-1,order:-1};
    procs.push(event);enqueue(event);
   }
   bubbleActive=m.choose(due,0,bubbleActive);return;
  }
  if(h.kind!=='heal')return;
  const song=and(enabled(h),has(h.role,'SongOfDaysPast')),clam=and(enabled(h),has(h.role,'OceanHuedClam'));
  if(typeof song!=='object'&&!song&&typeof clam!=='object'&&!clam)return;
  const amount=healAmount(h);
  if(typeof song==='object'||song){
   timer('song_end',actionTime(h.time+6),enqueue);
   const start=and(song,m.eq(songActive,0));
   songStart=m.choose(start,h.time,songStart);songEnd=m.choose(start,actionTime(h.time+6),songEnd);songAmount=m.choose(start,0,songAmount);
   songAmount=m.add(songAmount,m.choose(song,amount,0));songActive=m.max(songActive,song);
  }
  if(typeof clam==='object'||clam){
   timer('bubble_end',actionTime(h.time+3),enqueue);
   const spawn=and(clam,and(m.eq(bubbleActive,0),m.ge(h.time,cooldowns[h.role])));
   bubbleEnd=m.choose(spawn,actionTime(h.time+3),bubbleEnd);bubbleOwner=m.choose(spawn,h.role,bubbleOwner);bubbleAmount=m.choose(spawn,0,bubbleAmount);
   bubbleAmount=m.add(bubbleAmount,m.choose(and(clam,m.eq(bubbleOwner,h.role)),amount,0));bubbleActive=m.max(bubbleActive,spawn);cooldowns[h.role]=m.choose(spawn,actionTime(h.time+3.5),cooldowns[h.role]);
  }
 }
 function beforeHit(e){
  if(!e.onField||!['normal','charged','plunge','skill','burst'].includes(e.category))return;
  const active=and(enabled(e),and(m.lt(e.time,echoEnd),m.gt(remaining,0))),used=m.choose(active,m.min(hitTargets(e,settings).length,remaining),0);
  const key=eventKey(e);amounts.set(key,echoAmount);
  usage.set(key,{used,before:remaining,after:m.sub(remaining,used)});remaining=m.sub(remaining,used);
  if(typeof active==='object'||active)flat.set(key,flatFor(e,scoredTargets(e,settings)));
 }
 function flatFor(e,targets){
  const key=eventKey(e),used=usage.get(key)?.used??0,amount=amounts.get(key)??0;
  return targets.length?m.div(m.mul(m.mul(.08,m.min(15000,amount)),scoredUses(e,used,settings,m,targets)),targets.length):0;
 }
 return {afterEvent,beforeHit,waves,procs,flat,flatFor,usage};
}

// Read-only callers of the old helper replay the same state transitions.
export function equipmentHealingDamage(profiles,rotation,healAmount,has,settings={},math=scalarMath){
 const state=createEquipmentHealingDamage(profiles,rotation,healAmount,has,settings,math);
 const scheduler=createEventScheduler([...rotation.heals.map(h=>({...h,kind:'heal'})),...rotation.events.map(e=>({...e,kind:'hit'}))]);
 for(const e of scheduler.events()){
  if(e.kind==='hit')state.beforeHit(e);
  state.afterEvent(e,scheduler.enqueue);
 }
 return state;
}
