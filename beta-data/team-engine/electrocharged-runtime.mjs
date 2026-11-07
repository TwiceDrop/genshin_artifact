import {actionTime} from './rule-utils.mjs';
import {eventKey} from './event-order.mjs';
import {reactionDamageEvent} from './reaction-events.mjs';

// Each target owns one clock and one latest-applicator distribution. A tick
// is damage, not another application, reaction fact or character contact.
export function createElectrochargedRuntime({math:m,targets,actorIds,enqueue,emitReaction}){
 const and=(a,b)=>m.choose(a,b,0),possible=x=>typeof x==='object'||!!x;
 const states=targets.map(()=>({running:0,next:Infinity,last:-Infinity,early:0,auraEpoch:0,owners:[],times:new Set(),earlyWindows:new Set(),wanes:new Map()})),scheduled=new Set(),sources=new Map();
 const both=id=>and(m.gt(targets[id].Hydro.amount,0),m.gt(targets[id].Electro.amount,0));
 const live=id=>and(both(id),m.eq(targets[id].Frozen.amount,0));
 const capture=e=>({time:e.time,rootOrder:e.rootOrder,order:e.order,step:e.step??0,fields:['em','electro_charged_bonus']});
 function assign(state,source,gate){
  if(!possible(gate))return;
  for(const entry of state.owners)entry.active=m.choose(gate,0,entry.active);
  const entry=state.owners.find(entry=>entry.key===source.key);
  if(entry)entry.active=m.max(entry.active,gate);else state.owners.push({...source,active:gate});
 }
 function timer(id,time,type){
  time=actionTime(time);const key=JSON.stringify(['ec',type,id,time]);if(scheduled.has(key))return;scheduled.add(key);
  enqueue({kind:'timer',mechanic:'reaction.ec.'+type,ecTarget:id,time,rootOrder:-Infinity,eventId:key});
 }
 function emit(source,id,time,gate,{initial=false,chain=false,origin=id,cause}={}){
  if(!possible(gate))return;
  const hit=reactionDamageEvent(source.fact,{damageModel:'reaction.electroCharged',element:'Electro',label:chain?'感电·连锁':'感电',enabled:gate,targetIds:[id],key:JSON.stringify(['ec',origin,id,time,chain,cause&&eventKey(cause)]),reactionSnapshot:source.snapshot},{actorIds,math:m});
  sources.set(source.key,source);
  enqueue({...hit,time:actionTime(time),rootOrder:initial?hit.rootOrder:-Infinity,...(chain?{step:(cause.step??0)+1}:{}),followup:initial,completionRoot:initial?hit.completionRoot:undefined,persistent:!initial,
   hitTriggers:false,noImpulse:initial,ecTarget:id,ecOrigin:origin,ecChain:chain,ecSourceKey:source.key,...(!chain&&cause?.mechanic==='reaction.ec.early'?{ecTerminal:true,ecAuraEpoch:states[id].auraEpoch}:{})});
 }
 function watch(id,time){
  const state=states[id],target=targets[id];if(!possible(state.running))return;
  const life=aura=>m.div(aura.amount,m.choose(m.eq(aura.amount,0),1,aura.decay));
  const end=m.add(time,m.min(life(target.Hydro),life(target.Electro)));
  state.early=and(state.running,and(m.gt(state.last,-Infinity),and(m.gt(end,m.add(state.last,.5)),m.lt(end,state.next))));
  if(!possible(state.early))return;
  if(typeof end==='number'){
   const at=Math.ceil((end-1e-10)*60)/60;
   if(at>time)timer(id,at,'early');
  }else{
   // Only candidate-dependent depletion needs frame slots. Normal fixed axes
   // schedule the analytically determined expiry frame above.
   for(const deadline of state.times)if(!state.earlyWindows.has(deadline)&&deadline>time&&deadline<=time+1.000000001){
    state.earlyWindows.add(deadline);
    for(let frame=Math.ceil((deadline-.5)*60-1e-9);frame<deadline*60-1e-9;frame++){const at=actionTime(frame/60);if(at>time)timer(id,at,'early');}
   }
  }
 }
 function sync(id,time,gate=1){
  const state=states[id],stop=and(gate,m.choose(live(id),0,1));state.running=m.choose(stop,0,state.running);state.next=m.choose(stop,Infinity,state.next);watch(id,time);
 }
 return {
  apply(e,id,gate){
   if(!possible(gate))return;
   const state=states[id],fact=emitReaction(e,{reactionType:'ElectroCharged',elements:['Hydro','Electro'],targetIds:[id],enabled:gate,instanceId:'ec/'+id});
   const source={key:eventKey(fact),fact,snapshot:capture(e)},start=and(gate,m.choose(state.running,0,1));
   assign(state,source,gate);state.running=m.choose(gate,1,state.running);
   const next=actionTime(e.time+10/60+1);state.next=m.choose(start,next,state.next);
   if(possible(start)){state.times.add(next);timer(id,next,'tick');}
   emit(source,id,e.time+10/60,start,{initial:true});watch(id,e.time);
  },
  changed(id,time,gate){states[id].auraEpoch++;sync(id,time,gate);},
  prepare(e){
   if(e.damageModel==='reaction.electroCharged'&&e.ecTarget!==undefined){
    e.enabled=and(e.enabled??1,m.ge(e.time,m.add(states[e.ecTarget].last,.5-1e-9)));return;
   }
   if(!e.mechanic?.startsWith('reaction.ec.'))return;
   const id=e.ecTarget,state=states[id],target=targets[id];
   if(e.mechanic==='reaction.ec.wane'){
    const gate=and(state.wanes.get(e.time),both(id));
    for(const element of ['Hydro','Electro'])target[element].amount=m.choose(gate,m.max(0,m.sub(target[element].amount,.4)),target[element].amount);
    sync(id,e.time);return;
   }
   const early=e.mechanic==='reaction.ec.early',due=and(e.enabled??1,early?and(m.lt(e.time,state.next),m.ge(e.time,m.add(state.last,.5))):m.eq(state.next,e.time));
   const gate=and(due,early?and(state.early,m.choose(both(id),0,1)):live(id));
   for(const source of state.owners)emit(source,id,e.time,and(gate,source.active),{cause:e});
  },
  after(e){
   if(e.damageModel!=='reaction.electroCharged'||e.ecTarget===undefined)return;
   // prepare() already applied the target damage ICD to enabled. Damage is
   // an observation, not a second eligibility test for this reaction tick.
   const id=e.ecTarget,state=states[id],gate=e.enabled??1;if(!possible(gate))return;
   // An early tick is emitted only when an aura has depleted. Its own clock
   // cannot continue; a secondary arc may still take over another live target.
   const liveAfter=e.ecTerminal&&e.ecAuraEpoch===state.auraEpoch?0:live(id),active=and(gate,liveAfter),next=actionTime(e.time+1);
   state.last=m.choose(gate,e.time,state.last);state.running=m.choose(gate,liveAfter,state.running);state.next=m.choose(gate,m.choose(liveAfter,next,Infinity),state.next);
   const source=sources.get(e.ecSourceKey);
   if(e.ecChain)assign(state,source,active);
   if(possible(active)){state.times.add(next);timer(id,next,'tick');}
   const wane=actionTime(e.time+.1);state.wanes.set(wane,m.max(state.wanes.get(wane)??0,gate));timer(id,wane,'wane');watch(id,e.time);
   if(!e.ecChain)for(let victim=0;victim<targets.length;victim++)if(victim!==id){
    const chain=and(gate,m.gt(targets[victim].Hydro.amount,0));
    emit(source,victim,e.time,chain,{initial:e.followup,chain:true,origin:id,cause:e});
   }
  },
 };
}
